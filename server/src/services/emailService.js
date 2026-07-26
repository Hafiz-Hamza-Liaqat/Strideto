import nodemailer from 'nodemailer';
import { FailedEmail } from '../models/FailedEmail.js';
import { renderEmailTemplate } from '../templates/emailTemplates.js';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  const host = process.env.MAIL_HOST;
  const user = process.env.MAIL_USER;
  const pass = process.env.MAIL_PASS;
  if (!host || !user || !pass) return null;

  transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.MAIL_PORT || 587),
    secure: process.env.MAIL_SECURE === 'true',
    auth: { user, pass },
  });
  return transporter;
}

function getFromAddress() {
  return process.env.MAIL_FROM || process.env.MAIL_USER || 'noreply@strideto.com';
}

export function isSmtpConfigured() {
  return !!(process.env.MAIL_HOST && process.env.MAIL_USER && process.env.MAIL_PASS);
}

/**
 * Send email via SMTP when configured; otherwise log (dev).
 */
export async function sendEmail({ to, subject, body, text, template }) {
  const transport = getTransporter();
  if (!transport) {
    // Never log body/text — auth templates embed one-time URLs.
    console.log('[Email dev placeholder]', { to, subject, template });
    return { sent: false, placeholder: true };
  }

  try {
    const info = await transport.sendMail({
      from: getFromAddress(),
      to,
      subject,
      text: text || undefined,
      html: body || undefined,
    });
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    await FailedEmail.create({
      to,
      subject,
      template,
      error: err.message,
    }).catch(() => {});
    throw err;
  }
}

export async function sendTemplatedEmail(to, templateKey, lang = 'en', vars = {}) {
  const { subject, html, text } = renderEmailTemplate(templateKey, lang, vars);
  return sendEmail({ to, subject, body: html, text, template: templateKey });
}

export async function sendPasswordResetEmail(to, resetUrl, lang = 'en') {
  return sendTemplatedEmail(to, 'passwordReset', lang, { url: resetUrl });
}

export async function sendWelcomeEmail(to, name, lang = 'en') {
  return sendTemplatedEmail(to, 'welcome', lang, { name });
}

export async function sendEmailVerificationEmail(to, name, url, lang = 'en') {
  return sendTemplatedEmail(to, 'emailVerification', lang, { name, url });
}

export async function sendApplicationReceivedEmail(to, name, jobTitle, lang = 'en') {
  return sendTemplatedEmail(to, 'applicationReceived', lang, { name, jobTitle });
}

export async function sendInterviewInvitationEmail(to, vars, lang = 'en') {
  return sendTemplatedEmail(to, 'interviewInvitation', lang, vars);
}

export async function sendJobApprovedEmail(to, jobTitle, lang = 'en') {
  return sendTemplatedEmail(to, 'jobApproved', lang, { jobTitle });
}

export async function sendEmployerVerificationEmail(to, companyName, lang = 'en') {
  return sendTemplatedEmail(to, 'employerVerification', lang, { companyName });
}

export async function sendContactConfirmationEmail(to, { name, subject }, lang = 'en') {
  return sendTemplatedEmail(to, 'contactConfirmation', lang, { name, subject });
}

export async function sendContactAdminAlertEmail({ name, email, subject, message }) {
  const adminEmail = process.env.CONTACT_ADMIN_EMAIL || process.env.MAIL_USER;
  if (!adminEmail) return { sent: false };
  const site = process.env.SITE_URL || '';
  return sendEmail({
    to: adminEmail,
    subject: `[Contact] ${subject}`,
    text: `From: ${name} <${email}>\n\n${message}`,
    body: `<p><strong>From:</strong> ${name} &lt;${email}&gt;</p><p><strong>Subject:</strong> ${subject}</p><p>${message.replace(/\n/g, '<br/>')}</p>${site ? `<p><a href="${site}/admin/contact-messages">View in admin</a></p>` : ''}`,
    template: 'contactAdmin',
  });
}

export async function sendFormAdminAlertEmail({ to, subject, formName, submissionId: _submissionId, summary }) {
  if (!to) return { sent: false };
  const site = process.env.SITE_URL || '';
  return sendEmail({
    to,
    subject: subject || `[Form] ${formName}`,
    text: summary,
    body: `<p><strong>Form:</strong> ${formName}</p><pre style="white-space:pre-wrap">${summary}</pre>${site ? `<p><a href="${site}/admin/forms/submissions">View submissions</a></p>` : ''}`,
    template: 'formAdmin',
  });
}

export async function verifySmtpConnection() {
  const transport = getTransporter();
  if (!transport) return { configured: false, status: 'not_configured' };
  try {
    await transport.verify();
    return { configured: true, status: 'up' };
  } catch (err) {
    return { configured: true, status: 'down', error: err.message };
  }
}
