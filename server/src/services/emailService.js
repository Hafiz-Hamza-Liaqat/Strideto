import nodemailer from 'nodemailer';
import { FailedEmail } from '../models/FailedEmail.js';
import { renderEmailTemplate } from '../templates/emailTemplates.js';
import { logger } from '../utils/logger.js';

/** Dev/test fallback when verification sender env is unset (never used in production). */
export const DEFAULT_DEV_VERIFICATION_EMAIL_FROM = 'Strideto <strideto@gmail.com>';

/** Legacy personal Gmail that must not be used for verification mail. */
export const LEGACY_PERSONAL_AUTH_SENDER = 'hamza4h761@gmail.com';

/** Templates routed through the dedicated verification SMTP transport. */
export const VERIFICATION_EMAIL_TEMPLATE_KEYS = new Set(['emailVerification']);

let defaultTransporter = null;
let verificationTransporter = null;

function getVerificationMailHost() {
  return process.env.VERIFICATION_MAIL_HOST?.trim() || process.env.MAIL_HOST?.trim() || '';
}

function getVerificationMailPort() {
  const raw = process.env.VERIFICATION_MAIL_PORT?.trim() || process.env.MAIL_PORT?.trim() || '587';
  return Number(raw);
}

function isVerificationMailSecure() {
  const explicit = process.env.VERIFICATION_MAIL_SECURE?.trim();
  if (explicit !== undefined && explicit !== '') {
    return explicit === 'true';
  }
  return process.env.MAIL_SECURE === 'true';
}

/**
 * Verification SMTP credentials — production requires VERIFICATION_MAIL_USER/PASS only.
 * Non-production may reuse MAIL_USER/PASS for local Mailpit when verification creds are unset.
 */
export function getVerificationSmtpCredentials() {
  const user = process.env.VERIFICATION_MAIL_USER?.trim();
  const pass = process.env.VERIFICATION_MAIL_PASS?.trim();
  if (user && pass) {
    return { user, pass };
  }
  if (isProductionMailRuntime()) {
    return null;
  }
  const mailUser = process.env.MAIL_USER?.trim();
  const mailPass = process.env.MAIL_PASS?.trim();
  if (mailUser && mailPass) {
    return { user: mailUser, pass: mailPass };
  }
  return null;
}

export function getDefaultTransport() {
  if (defaultTransporter) return defaultTransporter;
  const host = process.env.MAIL_HOST;
  const user = process.env.MAIL_USER;
  const pass = process.env.MAIL_PASS;
  if (!host || !user || !pass) return null;

  defaultTransporter = nodemailer.createTransport({
    host,
    port: Number(process.env.MAIL_PORT || 587),
    secure: process.env.MAIL_SECURE === 'true',
    auth: { user, pass },
  });
  return defaultTransporter;
}

export function getVerificationTransport() {
  if (verificationTransporter) return verificationTransporter;
  const host = getVerificationMailHost();
  const creds = getVerificationSmtpCredentials();
  if (!host || !creds) return null;
  if (isProductionMailRuntime() && isLegacyPersonalAuthSender(creds.user)) {
    return null;
  }

  verificationTransporter = nodemailer.createTransport({
    host,
    port: getVerificationMailPort(),
    secure: isVerificationMailSecure(),
    auth: creds,
  });
  return verificationTransporter;
}

function getFromAddress() {
  return process.env.MAIL_FROM || process.env.MAIL_USER || 'noreply@strideto.com';
}

export function isProductionMailRuntime() {
  return process.env.NODE_ENV === 'production';
}

export function isVerificationEmailFromConfigured() {
  return !!(
    process.env.VERIFICATION_EMAIL_FROM?.trim()
    || process.env.VERIFICATION_EMAIL_FROM_ADDRESS?.trim()
  );
}

/**
 * Visible From for user email verification (registration + resend).
 * Production requires explicit VERIFICATION_EMAIL_FROM* configuration.
 */
export function getVerificationEmailFromAddress() {
  const explicit = process.env.VERIFICATION_EMAIL_FROM?.trim();
  if (explicit) return explicit;

  const address = process.env.VERIFICATION_EMAIL_FROM_ADDRESS?.trim();
  if (address) {
    const name = (process.env.VERIFICATION_EMAIL_FROM_NAME || 'Strideto').trim() || 'Strideto';
    return `${name} <${address}>`;
  }

  if (isProductionMailRuntime()) {
    return null;
  }

  return DEFAULT_DEV_VERIFICATION_EMAIL_FROM;
}

export function isLegacyPersonalAuthSender(value) {
  return String(value || '').toLowerCase().includes(LEGACY_PERSONAL_AUTH_SENDER);
}

export function isSmtpConfigured() {
  return !!(process.env.MAIL_HOST && process.env.MAIL_USER && process.env.MAIL_PASS);
}

export function isVerificationSmtpConfigured() {
  return !!(getVerificationMailHost() && getVerificationSmtpCredentials());
}

export function isVerificationMailReady() {
  if (!getVerificationEmailFromAddress()) return false;
  if (!isVerificationSmtpConfigured()) return false;
  const creds = getVerificationSmtpCredentials();
  if (creds && isLegacyPersonalAuthSender(creds.user)) return false;
  return true;
}

export function assessVerificationMailReadiness() {
  if (!getVerificationEmailFromAddress()) {
    return {
      sent: false,
      error: 'verification_sender_not_configured',
      smtpConfigured: isVerificationSmtpConfigured(),
    };
  }
  if (!isVerificationSmtpConfigured()) {
    return {
      sent: false,
      error: 'verification_smtp_not_configured',
      smtpConfigured: false,
    };
  }
  const creds = getVerificationSmtpCredentials();
  if (creds && isLegacyPersonalAuthSender(creds.user)) {
    return {
      sent: false,
      error: 'verification_smtp_not_configured',
      smtpConfigured: false,
    };
  }
  return null;
}

/**
 * Send email via SMTP when configured; otherwise log (dev).
 */
export async function sendEmail({
  to,
  subject,
  body,
  text,
  template,
  from,
  transportKind = 'default',
}) {
  const transport = transportKind === 'verification'
    ? getVerificationTransport()
    : getDefaultTransport();

  if (!transport) {
    // Never log body/text — auth templates embed one-time URLs.
    console.log('[Email dev placeholder]', { to, subject, template });
    return { sent: false, placeholder: true };
  }

  const fromAddress = from || getFromAddress();

  try {
    const info = await transport.sendMail({
      from: fromAddress,
      to,
      subject,
      text: text || undefined,
      html: body || undefined,
    });
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    if (transportKind === 'verification') {
      logger.warn('verification_email_send_failed', {
        template,
        errorCategory: err?.code || 'send_failed',
      });
    }
    await FailedEmail.create({
      to,
      subject,
      template,
      error: err.message,
    }).catch(() => {});
    throw err;
  }
}

export async function sendTemplatedEmail(to, templateKey, lang = 'en', vars = {}, options = {}) {
  const useVerificationTransport = options.useVerificationTransport
    ?? VERIFICATION_EMAIL_TEMPLATE_KEYS.has(templateKey);

  if (useVerificationTransport) {
    if (!getVerificationEmailFromAddress()) {
      const blocked = {
        sent: false,
        error: 'verification_sender_not_configured',
        smtpConfigured: isVerificationSmtpConfigured(),
      };
      logger.warn(blocked.error, { template: templateKey });
      return blocked;
    }
    if (isProductionMailRuntime()) {
      const blocked = assessVerificationMailReadiness();
      if (blocked) {
        logger.warn(blocked.error, { template: templateKey });
        return blocked;
      }
    }
    const from = getVerificationEmailFromAddress();
    const { subject, html, text } = renderEmailTemplate(templateKey, lang, vars);
    return sendEmail({
      to,
      subject,
      body: html,
      text,
      template: templateKey,
      from,
      transportKind: 'verification',
    });
  }

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
  const transport = getDefaultTransport();
  if (!transport) return { configured: false, status: 'not_configured' };
  try {
    await transport.verify();
    return { configured: true, status: 'up' };
  } catch (err) {
    return { configured: true, status: 'down', error: err.message };
  }
}
