import { User } from '../models/User.js';
import { Job } from '../models/Job.js';
import { Employer } from '../models/Employer.js';
import { notifyStaff } from './notificationService.js';
import { enqueueJob } from './jobQueueService.js';
import { isSmtpConfigured, sendTemplatedEmail, sendEmail } from './emailService.js';

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

export async function onApplicationStatusChange({ applicationId, userId, status, jobTitle, interviewWhen, interviewLink }) {
  const titles = {
    shortlisted: `Shortlisted for ${jobTitle}`,
    rejected: `Update on ${jobTitle}`,
    interview: `Interview invitation: ${jobTitle}`,
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

  if (status === 'interview') {
    const user = await User.findById(userId).select('email name').lean();
    if (user?.email) {
      await queueEmail({
        to: user.email,
        templateKey: 'interviewInvitation',
        vars: { name: user.name, jobTitle, when: interviewWhen, link: interviewLink },
        dedupKey: `email:interview:${applicationId}`,
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
