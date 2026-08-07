import { createHash } from 'node:crypto';
import { User } from '../models/User.js';
import { Job } from '../models/Job.js';
import { Employer } from '../models/Employer.js';
import { notifyStaff } from './notificationService.js';
import { enqueueJob } from './jobQueueService.js';
import { isSmtpConfigured, sendTemplatedEmail, sendEmail } from './emailService.js';
import { formatAppointmentTime } from '../utils/appointmentTime.js';

/** Templates that embed one-time secrets in `vars.url` — never persist raw URLs in BackgroundJob. */
const SENSITIVE_EMAIL_TEMPLATES = new Set(['emailVerification', 'passwordReset', 'staffInvitation']);

export async function queueEmail({ to, templateKey, lang, vars, dedupKey, subject, body, text, template, scheduledAt }) {
  if (!to) return { enqueued: false };

  if (templateKey && SENSITIVE_EMAIL_TEMPLATES.has(templateKey)) {
    try {
      const result = await sendTemplatedEmail(to, templateKey, lang || 'en', vars || {});
      return {
        enqueued: false,
        sentDirect: true,
        sent: !!result?.sent,
        placeholder: !!result?.placeholder,
        smtpConfigured: isSmtpConfigured(),
      };
    } catch (err) {
      return {
        enqueued: false,
        sentDirect: true,
        sent: false,
        error: err?.message || 'send_failed',
        smtpConfigured: isSmtpConfigured(),
      };
    }
  }

  // Raw HTML/text payloads may also contain secrets (e.g. admin-composed); prefer templateKey path.
  if (!templateKey && (text || body) && /[?&]token=/.test(`${text || ''}${body || ''}`)) {
    try {
      const result = await sendEmail({ to, subject, body, text, template });
      return {
        enqueued: false,
        sentDirect: true,
        sent: !!result?.sent,
        placeholder: !!result?.placeholder,
        smtpConfigured: isSmtpConfigured(),
      };
    } catch (err) {
      return {
        enqueued: false,
        sentDirect: true,
        sent: false,
        error: err?.message || 'send_failed',
        smtpConfigured: isSmtpConfigured(),
      };
    }
  }

  return enqueueJob({
    type: 'email',
    dedupKey,
    scheduledAt,
    payload: {
      to,
      templateKey,
      lang: lang || 'en',
      vars: vars || {},
      subject,
      body,
      text,
      template,
    },
  });
}

export function queueNotification({ dedupKey, ...payload }) {
  return enqueueJob({
    type: 'notification',
    dedupKey,
    payload,
  });
}

export async function onUserRegistered(user) {
  // Verification email is issued by auth register / resend flows (hashed token + FRONTEND_URL).
  // Keep this hook as a no-op for email so registration does not double-send or grant sessions.
  if (!user?._id) return;
}

export async function onJobApplication({ applicationId, opportunityApplicationId, userId, jobId, userName, userEmail }) {
  const job = await Job.findById(jobId).populate('employerId', 'email companyName').lean();
  if (!job) return;

  await queueNotification({
    dedupKey: `application:student:${applicationId}`,
    recipientType: 'user',
    userId,
    category: 'application',
    type: 'application.submitted',
    title: `Application submitted: ${job.title}`,
    body: `Your application for ${job.title} was received.`,
    link: opportunityApplicationId ? `/applications/${opportunityApplicationId}` : '/dashboard',
    metadata: { applicationId, jobId, opportunityApplicationId: opportunityApplicationId || null },
  });

  await queueEmail({
    to: userEmail,
    templateKey: 'applicationReceived',
    vars: { name: userName, jobTitle: job.title },
    dedupKey: `email:application:student:${applicationId}`,
  });

  const employerId = job.employerId?._id || job.employerId;
  if (employerId) {
    await queueNotification({
      dedupKey: `application:employer:${applicationId}`,
      recipientType: 'employer',
      employerId,
      category: 'job',
      type: 'application.new',
      title: `New application: ${job.title}`,
      body: `${userName || 'A candidate'} applied for ${job.title}.`,
      link: '/employer/applications',
      metadata: { applicationId, jobId, userId },
    });

    const employerEmail = job.employerId?.email;
    if (employerEmail) {
      await queueEmail({
        to: employerEmail,
        templateKey: 'employerApplicationReceived',
        vars: { jobTitle: job.title, applicantName: userName || 'Candidate' },
        dedupKey: `email:application:employer:${applicationId}`,
      });
    }
  }
}

/**
 * PF-EMP-INT-B3: the interview invitation is deduplicated on the *appointment*, not
 * on the application.
 *
 * The previous key was `email:interview:<applicationId>`, so the first invitation an
 * application ever queued permanently blocked every later one. A genuine reschedule
 * therefore emitted a fresh in-app `InterviewScheduled` notification while the only
 * queued email still carried the superseded time — recorded as the open behaviour in
 * docs/STRIDETO_PF_EMP_INT_B2_LIVE_ACCEPTANCE.md §8.
 *
 * PF-EMP-INT-B3A: the identity is the *candidate-facing* appointment — every field the
 * invitation actually communicates. Keying on the instant and joining link alone left
 * a real gap: an Employer switching an appointment from video to in-person, or moving
 * the address, changes what the candidate must do to attend without changing the time,
 * and that produced no updated invitation.
 *
 * The instant stays legible in the key so a queued job can be correlated to an
 * appointment by inspection. Everything else is folded into one fixed-width digest,
 * which keeps raw meeting URLs and physical addresses out of the key, keeps the key
 * index-safe whatever the field lengths, and still changes whenever the instructions
 * change. `mode` normalizes to the schema default so an absent method and an explicit
 * `video` are one appointment, not two.
 *
 * PF-EMP-INT-B3B: the appointment's timezone joins the identity, because it changes
 * what the invitation says without changing the instant — the same moment announced as
 * 7:30 PM Asia/Karachi and as 2:30 PM UTC is two different sets of joining
 * instructions. The zone is folded into the digest like the link and location, never
 * written into the key text.
 *
 * The function is pure and deterministic — the same effective appointment always
 * produces the same key, so an identical save can never queue a second email, while a
 * genuine change to any communicated field always produces a new one. Historical keys
 * are left untouched.
 */
export function interviewInvitationDedupKey(applicationId, appointment = {}) {
  const { when, mode, link, location, timeZone } = appointment;
  const instant = when instanceof Date ? when : new Date(when);
  const iso = Number.isNaN(instant.getTime()) ? 'invalid' : instant.toISOString();
  const zone = String(timeZone || '').trim();
  const details = [
    String(mode || '').trim() || 'video',
    String(link || '').trim(),
    String(location || '').trim(),
    // PF-EMP-INT-B3B: appended only when the appointment actually carries a zone, so
    // pre-B3B appointments keep producing byte-identical B3A keys and nothing already
    // queued is orphaned or re-sent by this change alone.
    ...(zone ? [zone] : []),
  ].join('\u0000'); // NUL cannot occur in a trimmed field, so the framing is unambiguous
  const digest = createHash('sha1').update(details).digest('hex').slice(0, 12);
  return `email:interview:${applicationId}:${iso}:${digest}`;
}

export async function onApplicationStatusChange({ applicationId, userId, status, jobTitle, interviewWhen, interviewLink, interviewMode, interviewLocation, interviewTimeZone }) {
  // PF-EMP-INT-B1: an appointment exists only when a real datetime was supplied.
  // Reaching the interview stage is not the same as having an interview booked,
  // so invitation wording is reserved for the case where one actually is.
  const hasAppointment = Boolean(interviewWhen);

  const titles = {
    shortlisted: `Shortlisted for ${jobTitle}`,
    rejected: `Update on ${jobTitle}`,
    interview: hasAppointment
      ? `Interview invitation: ${jobTitle}`
      : `Moved to interview stage: ${jobTitle}`,
    hired: `Offer for ${jobTitle}`,
  };

  await queueNotification({
    dedupKey: `application:status:${applicationId}:${status}`,
    recipientType: 'user',
    userId,
    category: status === 'interview' ? 'interview' : 'application',
    type: `application.${status}`,
    title: titles[status] || `Application update: ${jobTitle}`,
    body: `Your application status is now: ${status}.`,
    link: '/dashboard',
    metadata: { applicationId, status },
  });

  // PF-EMP-INT-B1: only invite to an interview that actually has a time. A bare
  // stage move previously queued this email with `when` undefined, producing a
  // dateless "you are invited" message for an appointment that did not exist.
  if (status === 'interview' && hasAppointment) {
    const user = await User.findById(userId).select('email name').lean();
    if (user?.email) {
      // PF-EMP-INT-B3A: one appointment object drives both what the candidate is told
      // and the dedup identity, so the two cannot drift apart.
      const appointment = {
        when: interviewWhen,
        mode: interviewMode,
        link: interviewLink,
        location: interviewLocation,
        timeZone: interviewTimeZone,
      };
      // PF-EMP-INT-B3B: render the wall clock here, at queue time, while the
      // appointment's zone is in hand. The worker that eventually delivers this runs
      // in its own container zone and must never be the thing that decides what time
      // the candidate is told — it just prints the string that was agreed now.
      const whenLabel = formatAppointmentTime(interviewWhen, interviewTimeZone);
      await queueEmail({
        to: user.email,
        templateKey: 'interviewInvitation',
        vars: {
          name: user.name,
          jobTitle,
          // `when` stays the raw ISO instant for internal correlation and debugging;
          // `whenLabel` is the only form a human is shown.
          when: interviewWhen,
          whenLabel: whenLabel?.text || '',
          timeZone: whenLabel?.zone || '',
          link: interviewLink,
          mode: interviewMode,
          location: interviewLocation,
        },
        dedupKey: interviewInvitationDedupKey(applicationId, appointment),
      });
    }
  }

  if (status === 'hired') {
    const user = await User.findById(userId).select('email name').lean();
    if (user?.email) {
      await queueEmail({
        to: user.email,
        templateKey: 'offerLetter',
        vars: { name: user.name, jobTitle },
        dedupKey: `email:offer:${applicationId}`,
      });
    }
  }
}

export async function onPaymentSuccess({ paymentId, employerId, jobId, amount }) {
  const job = jobId ? await Job.findById(jobId).select('title').lean() : null;
  await queueNotification({
    dedupKey: `payment:success:${paymentId}`,
    recipientType: 'employer',
    employerId,
    category: 'payment',
    type: 'payment.success',
    title: 'Payment confirmed',
    body: job ? `Payment for "${job.title}" was successful.` : `Payment of ${amount} confirmed.`,
    link: '/employer/jobs',
    metadata: { paymentId, jobId },
  });
}

export async function onResumeAnalysisComplete({ userId, scanId, score }) {
  await queueNotification({
    dedupKey: `resume:analysis:${scanId}`,
    recipientType: 'user',
    userId,
    category: 'general',
    type: 'resume.analysis_complete',
    title: 'Resume analysis complete',
    body: score != null ? `Your resume score: ${score}/100.` : 'Your resume analysis is ready.',
    link: '/resume-analyzer',
    metadata: { scanId },
  });
}

export async function onEmployerVerificationChange({ employerId, verificationLevel, companyName }) {
  const employer = await Employer.findById(employerId).select('email companyName').lean();
  if (!employer) return;

  await queueNotification({
    dedupKey: `employer:verify:${employerId}:${verificationLevel}`,
    recipientType: 'employer',
    employerId,
    category: 'verification',
    type: 'employer.verification',
    title: `Verification updated: ${verificationLevel}`,
    body: `Your employer account verification level is now ${verificationLevel}.`,
    link: '/employer/settings',
    metadata: { verificationLevel },
  });

  if (verificationLevel !== 'basic' && employer.email) {
    await queueEmail({
      to: employer.email,
      templateKey: 'employerVerification',
      vars: { companyName: companyName || employer.companyName },
      dedupKey: `email:employer:verify:${employerId}:${verificationLevel}`,
    });
  }
}

export async function onJobApproved({ jobId, employerId, jobTitle }) {
  if (!employerId) return;
  const employer = await Employer.findById(employerId).select('email').lean();

  await queueNotification({
    dedupKey: `job:approved:${jobId}`,
    recipientType: 'employer',
    employerId,
    category: 'job',
    type: 'job.approved',
    title: `Job approved: ${jobTitle}`,
    body: 'Your job listing is now live.',
    link: '/employer/jobs',
    metadata: { jobId },
  });

  if (employer?.email) {
    await queueEmail({
      to: employer.email,
      templateKey: 'jobApproved',
      vars: { jobTitle },
      dedupKey: `email:job:approved:${jobId}`,
    });
  }
}

const REJECTION_FALLBACK_MESSAGE = 'The Job was not approved during review. Open your Employer Jobs page to review its status.';

/** Called after a Job durably transitions to `rejected` moderation status. */
export async function onJobRejected({ jobId, employerId, jobTitle, reason }) {
  if (!jobId || !employerId) return;

  const safeReason = typeof reason === 'string' && reason.trim() ? reason.trim() : '';

  await queueNotification({
    dedupKey: `job:rejected:${jobId}`,
    recipientType: 'employer',
    employerId,
    category: 'job',
    type: 'job.rejected',
    title: `Job not approved: ${jobTitle}`,
    body: safeReason || REJECTION_FALLBACK_MESSAGE,
    link: '/employer/jobs',
    metadata: { jobId },
  });

  const employer = await Employer.findById(employerId).select('email').lean();
  if (employer?.email) {
    await queueEmail({
      to: employer.email,
      templateKey: 'jobRejectedEmployer',
      vars: { jobTitle, reason: safeReason },
      dedupKey: `email:job:rejected:${jobId}`,
    });
  }
}

/** Called after a Job durably persists in `pending` moderation status. */
export async function onJobSubmitted({ jobId, jobTitle, companyName, employerId }) {
  if (!jobId) return;

  await notifyStaff({
    category: 'job',
    type: 'job.submitted',
    title: `New job pending review: ${jobTitle}`,
    body: companyName ? `Submitted by ${companyName}.` : 'A new job listing needs moderation.',
    link: '/admin/moderation',
    metadata: { jobId },
  });

  const adminEmail = process.env.CONTACT_ADMIN_EMAIL || process.env.MAIL_FROM || process.env.MAIL_USER;
  if (adminEmail) {
    await queueEmail({
      to: adminEmail,
      templateKey: 'jobSubmitted',
      vars: { jobTitle, companyName: companyName || '' },
      dedupKey: `email:job:submitted:${jobId}`,
    });
  }

  if (employerId) {
    await queueNotification({
      dedupKey: `job:submitted:pending:${jobId}`,
      recipientType: 'employer',
      employerId,
      category: 'job',
      type: 'job.submitted.pending',
      title: `Job submitted: ${jobTitle}`,
      body: 'Your job listing was submitted and is awaiting Admin review.',
      link: '/employer/jobs',
      metadata: { jobId },
    });

    const employer = await Employer.findById(employerId).select('email').lean();
    if (employer?.email) {
      await queueEmail({
        to: employer.email,
        templateKey: 'jobSubmittedEmployer',
        vars: { jobTitle },
        dedupKey: `email:job:submitted:pending:${jobId}`,
      });
    }
  }
}

export async function onWebinarPublished({ webinarId, title }) {
  await notifyStaff({
    category: 'general',
    type: 'webinar.published',
    title: `Webinar published: ${title}`,
    body: 'A new webinar is scheduled on the public site.',
    link: '/admin/webinars',
    metadata: { webinarId },
  });
}

export async function onSupportTicketUpdate({ ticketId, ticketNumber, userId, employerId, subject, isReply }) {
  const payload = {
    dedupKey: `support:${ticketId}:${Date.now()}`,
    category: 'support',
    type: isReply ? 'support.reply' : 'support.update',
    title: `Ticket ${ticketNumber} updated`,
    body: subject,
    link: '/support/tickets',
    metadata: { ticketId },
  };

  if (userId) {
    await queueNotification({ ...payload, recipientType: 'user', userId, dedupKey: `support:user:${ticketId}:${isReply ? 'reply' : 'update'}` });
    const user = await User.findById(userId).select('email name').lean();
    if (user?.email) {
      await queueEmail({
        to: user.email,
        templateKey: 'supportTicketUpdate',
        vars: { name: user.name, ticketNumber, subject },
        dedupKey: `email:support:user:${ticketId}`,
      });
    }
  }
  if (employerId) {
    await queueNotification({ ...payload, recipientType: 'employer', employerId, dedupKey: `support:employer:${ticketId}:${isReply ? 'reply' : 'update'}` });
  }
}

export async function onSubscriptionExpiring({ jobId, employerId, jobTitle, expiresAt }) {
  await queueNotification({
    dedupKey: `subscription:expiry:${jobId}:${expiresAt?.toISOString?.()?.slice(0, 10)}`,
    recipientType: 'employer',
    employerId,
    category: 'payment',
    type: 'subscription.expiring',
    title: `Listing expiring: ${jobTitle}`,
    body: `Your job listing expires on ${expiresAt ? new Date(expiresAt).toLocaleDateString() : 'soon'}.`,
    link: '/employer/jobs',
    metadata: { jobId, expiresAt },
  });
}
