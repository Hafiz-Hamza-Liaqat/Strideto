const BRAND = 'Strideto';
const PRIMARY = '#2563EB';
const TAGLINE = 'Every Step Toward Success.';
const SITE = process.env.SITE_URL || process.env.FRONTEND_URL || 'https://strideto.com';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function layout({ title, bodyHtml, lang = 'en', footerText }) {
  const dir = lang === 'ur' ? 'rtl' : 'ltr';
  const font = lang === 'ur' ? "'Noto Nastaliq Urdu', 'Segoe UI', Tahoma, sans-serif" : "'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  const logoUrl = `${SITE.replace(/\/$/, '')}/branding/logo-symbol.svg`;
  return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:${font};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #E2E8F0;">
<tr><td style="background:#ffffff;padding:28px 24px 16px;text-align:center;border-bottom:1px solid #E2E8F0;">
<img src="${logoUrl}" width="48" height="48" alt="${BRAND}" style="display:block;margin:0 auto 12px;border:0;"/>
<div style="font-family:Manrope,Inter,Segoe UI,sans-serif;font-size:22px;font-weight:700;color:#0F172A;letter-spacing:-0.02em;">${BRAND}</div>
<div style="margin-top:6px;font-size:14px;color:#64748B;">${TAGLINE}</div>
</td></tr>
<tr><td style="padding:28px 24px;color:#334155;font-size:15px;line-height:1.6;">${bodyHtml}</td></tr>
<tr><td style="padding:16px 24px 24px;border-top:1px solid #E2E8F0;color:#64748B;font-size:12px;line-height:1.5;">
${footerText || (lang === 'ur' ? 'یہ ای میل Strideto کی طرف سے بھیجی گئی ہے۔' : 'This email was sent by Strideto.')}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function btn(href, label) {
  const safeHref = escapeHtml(href);
  return `<p style="margin:24px 0;"><a href="${safeHref}" style="display:inline-block;background:${PRIMARY};color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">${escapeHtml(label)}</a></p>`;
}

/** Interview methods the appointment subdocument supports, in the candidate's language. */
const INTERVIEW_MODE_LABELS = {
  en: { video: 'Video call', phone: 'Phone call', in_person: 'In person', other: 'Other' },
  ur: { video: 'ویڈیو کال', phone: 'فون کال', in_person: 'بالمشافہ', other: 'دیگر' },
};

function interviewModeLabel(mode, lang = 'en') {
  const key = String(mode || '').trim();
  if (!key) return '';
  return INTERVIEW_MODE_LABELS[lang]?.[key] || INTERVIEW_MODE_LABELS.en[key] || key;
}

const TEMPLATES = {
  welcome: {
    en: ({ name }) => {
      const safeName = escapeHtml(name || 'there');
      const home = (process.env.FRONTEND_URL || process.env.SITE_URL || 'https://strideto.com').replace(/\/$/, '');
      return {
        subject: `${BRAND} – Welcome!`,
        html: layout({
          title: 'Welcome',
          bodyHtml: `<p>Hi ${safeName},</p><p>Your email is verified. Welcome to ${BRAND}! Explore jobs, scholarships, admissions, and career tools.</p>${btn(home, 'Get started')}`,
        }),
        text: `Welcome to ${BRAND}! Visit ${home}`,
      };
    },
    ur: ({ name }) => {
      const safeName = escapeHtml(name || '');
      const home = (process.env.FRONTEND_URL || process.env.SITE_URL || 'https://strideto.com').replace(/\/$/, '');
      return {
        subject: `${BRAND} – خوش آمدید!`,
        html: layout({
          lang: 'ur',
          title: 'خوش آمدید',
          bodyHtml: `<p>السلام علیکم ${safeName}،</p><p>${BRAND} میں خوش آمدید! پاکستان کے لیے نوکریاں، اسکالرشپس اور داخلہ مواقع دریافت کریں۔</p>${btn(home, 'شروع کریں')}`,
          footerText: 'یہ ای میل Strideto کی طرف سے بھیجی گئی ہے۔',
        }),
        text: `${BRAND} میں خوش آمدید`,
      };
    },
  },
  emailVerification: {
    en: ({ name, url, expiresMinutes = 30 }) => {
      const safeName = escapeHtml(name || 'there');
      const mins = Number(expiresMinutes) || 30;
      return {
        subject: `${BRAND} – Verify your email`,
        html: layout({
          title: 'Verify email',
          bodyHtml: `<p>Hi ${safeName},</p><p>Please verify your email address to finish creating your ${BRAND} account.</p>${btn(url, 'Verify email')}<p style="color:#64748B;font-size:13px;">This link expires in ${mins} minutes and can be used once.</p><p style="color:#64748B;font-size:13px;">If you did not create an account, you can ignore this email.</p>`,
        }),
        text: `Verify your email (expires in ${mins} minutes): ${url}\n\nIf you did not create an account, ignore this email.`,
      };
    },
    ur: ({ name, url, expiresMinutes = 30 }) => {
      const safeName = escapeHtml(name || 'محترم صارف');
      const mins = Number(expiresMinutes) || 30;
      return {
        subject: `${BRAND} – ای میل کی تصدیق`,
        html: layout({
          lang: 'ur',
          title: 'تصدیق',
          bodyHtml: `<p>${safeName}، براہ کرم اپنی ای میل کی تصدیق کریں:</p>${btn(url, 'تصدیق کریں')}<p style="font-size:13px;color:#64748B;">یہ لنک ${mins} منٹ میں ختم ہو جائے گا۔</p>`,
        }),
        text: `تصدیق لنک: ${url}`,
      };
    },
  },
  passwordReset: {
    en: ({ url, expiresMinutes = 60 }) => {
      const mins = Number(expiresMinutes) || 60;
      return {
        subject: `${BRAND} – Reset your password`,
        html: layout({
          title: 'Password reset',
          bodyHtml: `<p>You requested a password reset for your ${BRAND} account.</p>${btn(url, 'Reset password')}<p style="color:#64748B;font-size:13px;">This link expires in ${mins} minutes and can be used once.</p><p style="color:#6b7280;font-size:13px;">If you didn't request this, ignore this email.</p>`,
        }),
        text: `Reset password (expires in ${mins} minutes): ${url}\n\nIf you didn't request this, ignore this email.`,
      };
    },
    ur: ({ url, expiresMinutes = 60 }) => {
      const mins = Number(expiresMinutes) || 60;
      return {
        subject: `${BRAND} – پاس ورڈ ری سیٹ`,
        html: layout({
          lang: 'ur',
          title: 'پاس ورڈ',
          bodyHtml: `<p>آپ نے پاس ورڈ ری سیٹ کی درخواست کی ہے (${mins} منٹ کے لیے درست):</p>${btn(url, 'پاس ورڈ ری سیٹ')}`,
        }),
        text: `ری سیٹ لنک: ${url}`,
      };
    },
  },
  applicationReceived: {
    en: ({ name, jobTitle }) => ({
      subject: `${BRAND} – Application received`,
      html: layout({ title: 'Application', bodyHtml: `<p>Hi ${name || 'there'},</p><p>We received your application for <strong>${jobTitle}</strong>. The employer will review it soon.</p>` }),
      text: `Application received for ${jobTitle}`,
    }),
    ur: ({ name, jobTitle }) => ({
      subject: `${BRAND} – درخواست موصول`,
      html: layout({ lang: 'ur', title: 'درخواست', bodyHtml: `<p>${name || ''}، آپ کی <strong>${jobTitle}</strong> کے لیے درخواست موصول ہو گئی۔</p>` }),
      text: `${jobTitle} کے لیے درخواست موصول`,
    }),
  },
  interviewInvitation: {
    // PF-EMP-INT-B3A: the invitation has to carry every instruction the candidate
    // needs to attend. Time and joining link were already here; method and physical
    // location were not, so an in-person invitation never said where to go — and the
    // Urdu variant dropped the joining link entirely.
    en: ({ name, jobTitle, when, link, mode, location }) => {
      const modeLabel = interviewModeLabel(mode, 'en');
      const safeLocation = escapeHtml(location || '');
      return {
        subject: `${BRAND} – Interview invitation`,
        html: layout({
          title: 'Interview',
          bodyHtml: `<p>Hi ${escapeHtml(name || 'there')},</p><p>You are invited for an interview for <strong>${escapeHtml(jobTitle)}</strong>${when ? ` on ${escapeHtml(when)}` : ''}.</p>`
            + (modeLabel ? `<p style="margin:4px 0;"><strong>Method:</strong> ${escapeHtml(modeLabel)}</p>` : '')
            + (safeLocation ? `<p style="margin:4px 0;"><strong>Location:</strong> ${safeLocation}</p>` : '')
            + (link ? btn(link, 'Join / Details') : ''),
        }),
        text: [
          `Interview for ${jobTitle}${when ? ` on ${when}` : ''}`,
          modeLabel ? `Method: ${modeLabel}` : '',
          location ? `Location: ${location}` : '',
          link ? `Link: ${link}` : '',
        ].filter(Boolean).join('\n'),
      };
    },
    ur: ({ name, jobTitle, when, link, mode, location }) => {
      const modeLabel = interviewModeLabel(mode, 'ur');
      const safeLocation = escapeHtml(location || '');
      return {
        subject: `${BRAND} – انٹرویو کی دعوت`,
        html: layout({
          lang: 'ur',
          title: 'انٹرویو',
          bodyHtml: `<p>${escapeHtml(name || '')}، <strong>${escapeHtml(jobTitle)}</strong> کے لیے انٹرویو${when ? ` (${escapeHtml(when)})` : ''}۔</p>`
            + (modeLabel ? `<p style="margin:4px 0;"><strong>طریقہ:</strong> ${escapeHtml(modeLabel)}</p>` : '')
            + (safeLocation ? `<p style="margin:4px 0;"><strong>مقام:</strong> ${safeLocation}</p>` : '')
            + (link ? btn(link, 'شامل ہوں / تفصیلات') : ''),
        }),
        text: [
          `انٹرویو: ${jobTitle}${when ? ` (${when})` : ''}`,
          modeLabel ? `طریقہ: ${modeLabel}` : '',
          location ? `مقام: ${location}` : '',
          link ? `${link}` : '',
        ].filter(Boolean).join('\n'),
      };
    },
  },
  jobApproved: {
    en: ({ jobTitle }) => ({
      subject: `${BRAND} – Job approved`,
      html: layout({ title: 'Job approved', bodyHtml: `<p>Your job listing <strong>${jobTitle}</strong> has been approved and is now live.</p>` }),
      text: `Job approved: ${jobTitle}`,
    }),
    ur: ({ jobTitle }) => ({
      subject: `${BRAND} – نوکری منظور`,
      html: layout({ lang: 'ur', title: 'منظور', bodyHtml: `<p>آپ کی نوکری <strong>${jobTitle}</strong> منظور ہو گئی اور شائع ہے۔</p>` }),
      text: `نوکری منظور: ${jobTitle}`,
    }),
  },
  jobSubmitted: {
    en: ({ jobTitle, companyName }) => ({
      subject: `${BRAND} – Job pending review: ${jobTitle}`,
      html: layout({
        title: 'Job pending review',
        bodyHtml: `<p>A new job listing <strong>${jobTitle}</strong>${companyName ? ` from <strong>${companyName}</strong>` : ''} was submitted and is awaiting moderation.</p>${btn(`${process.env.SITE_URL || ''}/admin/moderation`, 'Review in admin')}`,
      }),
      text: `Job pending review: ${jobTitle}${companyName ? ` from ${companyName}` : ''}`,
    }),
    ur: ({ jobTitle, companyName }) => ({
      subject: `${BRAND} – نظرثانی کے منتظر نوکری: ${jobTitle}`,
      html: layout({
        lang: 'ur',
        title: 'نظرثانی درکار',
        bodyHtml: `<p>نئی نوکری <strong>${jobTitle}</strong>${companyName ? ` بذریعہ <strong>${companyName}</strong>` : ''} جمع کرائی گئی اور نظرثانی کی منتظر ہے۔</p>${btn(`${process.env.SITE_URL || ''}/admin/moderation`, 'ایڈمن میں دیکھیں')}`,
      }),
      text: `نظرثانی کے منتظر: ${jobTitle}`,
    }),
  },
  jobSubmittedEmployer: {
    en: ({ jobTitle }) => ({
      subject: `${BRAND} – Job submitted: ${jobTitle}`,
      html: layout({
        title: 'Job submitted',
        bodyHtml: `<p>Your job listing <strong>${jobTitle}</strong> was submitted successfully and is awaiting Admin review. It is not yet published.</p>${btn(`${process.env.SITE_URL || ''}/employer/jobs`, 'View my jobs')}`,
      }),
      text: `Job submitted: ${jobTitle}. Awaiting Admin review — not yet published.`,
    }),
    ur: ({ jobTitle }) => ({
      subject: `${BRAND} – نوکری جمع کرائی گئی: ${jobTitle}`,
      html: layout({
        lang: 'ur',
        title: 'جمع کرائی گئی',
        bodyHtml: `<p>آپ کی نوکری <strong>${jobTitle}</strong> کامیابی سے جمع کرائی گئی اور ایڈمن کی نظرثانی کی منتظر ہے۔ ابھی شائع نہیں ہوئی۔</p>${btn(`${process.env.SITE_URL || ''}/employer/jobs`, 'میری نوکریاں دیکھیں')}`,
      }),
      text: `نوکری جمع کرائی گئی: ${jobTitle}۔ ایڈمن کی نظرثانی کی منتظر — ابھی شائع نہیں ہوئی۔`,
    }),
  },
  jobRejectedEmployer: {
    en: ({ jobTitle, reason }) => {
      const safeReason = reason ? escapeHtml(reason) : 'The Job was not approved during review. Open your Employer Jobs page to review its status.';
      return {
        subject: `${BRAND} – Job not approved: ${jobTitle}`,
        html: layout({
          title: 'Job not approved',
          bodyHtml: `<p>Your job listing <strong>${jobTitle}</strong> was not approved during review.</p><p>${safeReason}</p>${btn(`${process.env.SITE_URL || ''}/employer/jobs`, 'View my jobs')}`,
        }),
        text: `Job not approved: ${jobTitle}. ${reason || 'Open your Employer Jobs page to review its status.'}`,
      };
    },
    ur: ({ jobTitle, reason }) => {
      const safeReason = reason ? escapeHtml(reason) : 'نظرثانی میں نوکری منظور نہیں ہوئی۔ اپنی ایمپلائر جابز پیج پر صورتحال دیکھیں۔';
      return {
        subject: `${BRAND} – نوکری منظور نہیں ہوئی: ${jobTitle}`,
        html: layout({
          lang: 'ur',
          title: 'منظور نہیں ہوئی',
          bodyHtml: `<p>آپ کی نوکری <strong>${jobTitle}</strong> نظرثانی میں منظور نہیں ہوئی۔</p><p>${safeReason}</p>${btn(`${process.env.SITE_URL || ''}/employer/jobs`, 'میری نوکریاں دیکھیں')}`,
        }),
        text: `نوکری منظور نہیں ہوئی: ${jobTitle}`,
      };
    },
  },
  employerVerification: {
    en: ({ companyName }) => ({
      subject: `${BRAND} – Employer verified`,
      html: layout({ title: 'Verified', bodyHtml: `<p><strong>${companyName}</strong> has been verified on ${BRAND}. You can now post jobs with a verified badge.</p>` }),
      text: `${companyName} verified`,
    }),
    ur: ({ companyName }) => ({
      subject: `${BRAND} – آجر کی تصدیق`,
      html: layout({ lang: 'ur', title: 'تصدیق', bodyHtml: `<p><strong>${companyName}</strong> کی تصدیق ہو گئی۔</p>` }),
      text: `${companyName} تصدیق شدہ`,
    }),
  },
  contactConfirmation: {
    en: ({ name, subject }) => ({
      subject: `${BRAND} – We received your message`,
      html: layout({ title: 'Contact', bodyHtml: `<p>Hi ${name},</p><p>Thank you for contacting us regarding "<strong>${subject}</strong>". Our team will respond within 1–2 business days.</p>` }),
      text: `We received your message about ${subject}`,
    }),
    ur: ({ name, subject }) => ({
      subject: `${BRAND} – آپ کا پیغام موصول`,
      html: layout({ lang: 'ur', title: 'رابطہ', bodyHtml: `<p>${name}، "<strong>${subject}</strong>" کے بارے میں شکریہ۔ ہم جلد جواب دیں گے۔</p>` }),
      text: `پیغام موصول: ${subject}`,
    }),
  },
  formConfirmation: {
    en: ({ formName, message }) => ({
      subject: `${BRAND} – ${formName} received`,
      html: layout({ title: formName, bodyHtml: `<p>${message || 'Thank you for your submission.'}</p>` }),
      text: message || 'Thank you for your submission.',
    }),
    ur: ({ formName, message }) => ({
      subject: `${BRAND} – ${formName}`,
      html: layout({ lang: 'ur', title: formName, bodyHtml: `<p>${message || 'آپ کی درخواست موصول ہو گئی۔'}</p>` }),
      text: message || 'شکریہ',
    }),
  },
  formAdminAlert: {
    en: ({ formName, summary }) => ({
      subject: `${BRAND} – New ${formName} submission`,
      html: layout({ title: 'Form submission', bodyHtml: `<p><strong>${formName}</strong></p><pre style="white-space:pre-wrap;font-family:inherit">${summary}</pre>` }),
      text: summary,
    }),
    ur: ({ formName, summary }) => ({
      subject: `${BRAND} – نیا ${formName}`,
      html: layout({ lang: 'ur', title: formName, bodyHtml: `<pre style="white-space:pre-wrap">${summary}</pre>` }),
      text: summary,
    }),
  },
  employerApplicationReceived: {
    en: ({ jobTitle, applicantName }) => ({
      subject: `${BRAND} – New application for ${jobTitle}`,
      html: layout({ title: 'New application', bodyHtml: `<p><strong>${applicantName}</strong> applied for <strong>${jobTitle}</strong>.</p>${btn(`${process.env.SITE_URL || ''}/employer/applications`, 'View applications')}` }),
      text: `New application from ${applicantName} for ${jobTitle}`,
    }),
    ur: ({ jobTitle, applicantName }) => ({
      subject: `${BRAND} – نئی درخواست: ${jobTitle}`,
      html: layout({ lang: 'ur', title: 'درخواست', bodyHtml: `<p><strong>${applicantName}</strong> نے <strong>${jobTitle}</strong> کے لیے درخواست دی۔</p>` }),
      text: `نئی درخواست`,
    }),
  },
  offerLetter: {
    en: ({ name, jobTitle }) => ({
      subject: `${BRAND} – Offer for ${jobTitle}`,
      html: layout({ title: 'Offer', bodyHtml: `<p>Hi ${name || 'there'},</p><p>Congratulations! You have been selected for <strong>${jobTitle}</strong>. The employer will share next steps with you.</p>` }),
      text: `Offer for ${jobTitle}`,
    }),
    ur: ({ name, jobTitle }) => ({
      subject: `${BRAND} – ${jobTitle} کی پیشکش`,
      html: layout({ lang: 'ur', title: 'پیشکش', bodyHtml: `<p>${name || ''}، مبارک ہو! <strong>${jobTitle}</strong> کے لیے آپ کو منتخب کیا گیا۔</p>` }),
      text: `پیشکش: ${jobTitle}`,
    }),
  },
  supportTicketUpdate: {
    en: ({ name, ticketNumber, subject }) => ({
      subject: `${BRAND} – Ticket ${ticketNumber} updated`,
      html: layout({ title: 'Support', bodyHtml: `<p>Hi ${name || 'there'},</p><p>Your support ticket <strong>${ticketNumber}</strong> (${subject}) has been updated.</p>${btn(`${process.env.SITE_URL || ''}/support/tickets`, 'View ticket')}` }),
      text: `Ticket ${ticketNumber} updated`,
    }),
    ur: ({ name, ticketNumber, subject: _subject }) => ({
      subject: `${BRAND} – ٹکٹ ${ticketNumber} اپ ڈیٹ`,
      html: layout({ lang: 'ur', title: 'سپورٹ', bodyHtml: `<p>${name || ''}، ٹکٹ <strong>${ticketNumber}</strong> اپ ڈیٹ ہو گئی۔</p>` }),
      text: `ٹکٹ اپ ڈیٹ`,
    }),
  },
  staffInvitation: {
    en: ({ url, role, inviterName, message, expiresHours }) => ({
      subject: `${BRAND} – Staff invitation (${role})`,
      html: layout({
        title: 'Staff invitation',
        bodyHtml: `<p>You have been invited to join ${BRAND} as <strong>${role}</strong> by ${inviterName || 'an administrator'}.</p>${message ? `<p><em>${message}</em></p>` : ''}<p>This link expires in ${expiresHours || 72} hours.</p>${btn(url, 'Accept invitation')}`,
      }),
      text: `Staff invitation (${role}): ${url}`,
    }),
    ur: ({ url, role, inviterName, expiresHours }) => ({
      subject: `${BRAND} – اسٹaff دعوت (${role})`,
      html: layout({
        lang: 'ur',
        title: 'دعوت',
        bodyHtml: `<p>آپ کو ${inviterName || 'منتظم'} کی طرف سے <strong>${role}</strong> کے طور پر ${BRAND} میں شامل ہونے کی دعوت دی گئی ہے۔</p><p>یہ لنک ${expiresHours || 72} گھنٹوں میں ختم ہو جائے گا۔</p>${btn(url, 'دعوت قبول کریں')}`,
      }),
      text: `اسٹaff دعوت: ${url}`,
    }),
  },
  temporaryPassword: {
    en: ({ name, tempPassword, expiresAt, loginUrl }) => ({
      subject: `${BRAND} – Temporary password`,
      html: layout({
        title: 'Temporary password',
        bodyHtml: `<p>Hi ${name || 'there'},</p><p>An administrator reset your password.</p><p><strong>Temporary password:</strong> <code style="background:#f3f4f6;padding:4px 8px;border-radius:4px;">${tempPassword}</code></p><p>You must change this password on first login${expiresAt ? ` (expires ${expiresAt})` : ''}.</p>${btn(loginUrl, 'Sign in')}`,
      }),
      text: `Temporary password: ${tempPassword}. Sign in: ${loginUrl}`,
    }),
    ur: ({ name, tempPassword, loginUrl }) => ({
      subject: `${BRAND} – عارضی پاس ورڈ`,
      html: layout({
        lang: 'ur',
        title: 'عارضی پاس ورڈ',
        bodyHtml: `<p>${name || ''}، آپ کا پاس ورڈ ری سیٹ کیا گیا ہے۔</p><p><strong>عارضی پاس ورڈ:</strong> ${tempPassword}</p><p>پہلی لاگ ان پر نیا پاس ورڈ سیٹ کریں۔</p>${btn(loginUrl, 'لاگ ان')}`,
      }),
      text: `عارضی پاس ورڈ: ${tempPassword}`,
    }),
  },
};

export function renderEmailTemplate(templateKey, lang = 'en', vars = {}) {
  const tpl = TEMPLATES[templateKey];
  if (!tpl) throw new Error(`Unknown email template: ${templateKey}`);
  const fn = tpl[lang] || tpl.en;
  return fn(vars);
}

export { layout as emailLayout };
