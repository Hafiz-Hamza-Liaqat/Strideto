const BRAND = 'Strideto';
const PRIMARY = '#2563EB';
const TAGLINE = 'Every Step Toward Success.';
const SITE = process.env.SITE_URL || 'https://strideto.com';

function layout({ title, bodyHtml, lang = 'en', footerText }) {
  const dir = lang === 'ur' ? 'rtl' : 'ltr';
  const font = lang === 'ur' ? "'Noto Nastaliq Urdu', 'Segoe UI', Tahoma, sans-serif" : "'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  const logoUrl = `${SITE.replace(/\/$/, '')}/branding/logo-symbol.svg`;
  return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title}</title>
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
  return `<p style="margin:24px 0;"><a href="${href}" style="display:inline-block;background:${PRIMARY};color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">${label}</a></p>`;
}

const TEMPLATES = {
  welcome: {
    en: ({ name }) => ({
      subject: `${BRAND} – Welcome!`,
      html: layout({
        title: 'Welcome',
        bodyHtml: `<p>Hi ${name || 'there'},</p><p>Welcome to ${BRAND}! Explore jobs, scholarships, admissions, and career tools tailored for Pakistan.</p>${btn(process.env.SITE_URL || 'https://strideto.com', 'Get started')}`,
      }),
      text: `Welcome to ${BRAND}! Visit ${process.env.SITE_URL || 'https://strideto.com'}`,
    }),
    ur: ({ name }) => ({
      subject: `${BRAND} – خوش آمدید!`,
      html: layout({
        lang: 'ur',
        title: 'خوش آمدید',
        bodyHtml: `<p>السلام علیکم ${name || ''}،</p><p>${BRAND} میں خوش آمدید! پاکستان کے لیے نوکریاں، اسکالرشپس اور داخلہ مواقع دریافت کریں۔</p>${btn(process.env.SITE_URL || 'https://strideto.com', 'شروع کریں')}`,
        footerText: 'یہ ای میل Strideto کی طرف سے بھیجی گئی ہے۔',
      }),
      text: `${BRAND} میں خوش آمدید`,
    }),
  },
  emailVerification: {
    en: ({ name, url }) => ({
      subject: `${BRAND} – Verify your email`,
      html: layout({ title: 'Verify email', bodyHtml: `<p>Hi ${name || 'there'},</p><p>Please verify your email address:</p>${btn(url, 'Verify email')}` }),
      text: `Verify your email: ${url}`,
    }),
    ur: ({ name, url }) => ({
      subject: `${BRAND} – ای میل کی تصدیق`,
      html: layout({ lang: 'ur', title: 'تصدیق', bodyHtml: `<p>${name || 'محترم صارف'}، براہ کرم اپنی ای میل کی تصدیق کریں:</p>${btn(url, 'تصدیق کریں')}` }),
      text: `تصدیق لنک: ${url}`,
    }),
  },
  passwordReset: {
    en: ({ url }) => ({
      subject: `${BRAND} – Reset your password`,
      html: layout({ title: 'Password reset', bodyHtml: `<p>You requested a password reset. Click below (valid 1 hour):</p>${btn(url, 'Reset password')}<p style="color:#6b7280;font-size:13px;">If you didn't request this, ignore this email.</p>` }),
      text: `Reset password: ${url}`,
    }),
    ur: ({ url }) => ({
      subject: `${BRAND} – پاس ورڈ ری سیٹ`,
      html: layout({ lang: 'ur', title: 'پاس ورڈ', bodyHtml: `<p>آپ نے پاس ورڈ ری سیٹ کی درخواست کی ہے (1 گھنٹے کے لیے درست):</p>${btn(url, 'پاس ورڈ ری سیٹ')}` }),
      text: `ری سیٹ لنک: ${url}`,
    }),
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
    en: ({ name, jobTitle, when, link }) => ({
      subject: `${BRAND} – Interview invitation`,
      html: layout({ title: 'Interview', bodyHtml: `<p>Hi ${name || 'there'},</p><p>You are invited for an interview for <strong>${jobTitle}</strong>${when ? ` on ${when}` : ''}.</p>${link ? btn(link, 'Join / Details') : ''}` }),
      text: `Interview for ${jobTitle}${when ? ` on ${when}` : ''}`,
    }),
    ur: ({ name, jobTitle, when }) => ({
      subject: `${BRAND} – انٹرویو کی دعوت`,
      html: layout({ lang: 'ur', title: 'انٹرویو', bodyHtml: `<p>${name || ''}، <strong>${jobTitle}</strong> کے لیے انٹرویو${when ? ` (${when})` : ''}۔</p>` }),
      text: `انٹرویو: ${jobTitle}`,
    }),
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
