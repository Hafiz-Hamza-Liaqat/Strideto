import { asyncHandler } from '../utils/asyncHandler.js';
import { sanitizeString } from '../utils/sanitize.js';
import { getPublishedFormBySlug, getPublishedFormById, hashIp } from '../services/formService.js';
import { createFormSubmission, uploadFormFile } from '../services/formSubmissionService.js';
import { checkFormSpam } from '../services/formSpamService.js';
import { sendFormNotifications } from '../services/formNotificationService.js';
import { validateSubmission, toPublicFormDefinition, getInputFields } from '../../../shared/formSchema.js';
import { resolveLocalizedFormDefinition } from '../../../shared/formLocalization.js';
import { resolveLocaleFromRequest } from '../../../shared/localization/localeResolver.js';
import { scheduleAnalyticsEvent } from '../services/analytics/AnalyticsEventService.js';

function publicFormResponse(form, req) {
  const locale = resolveLocaleFromRequest(req);
  const localized = resolveLocalizedFormDefinition(form, locale);
  return toPublicFormDefinition(localized);
}

export const getPublicForm = asyncHandler(async (req, res) => {
  const form = await getPublishedFormBySlug(req.params.slug);
  if (!form) return res.status(404).json({ error: 'Form not found' });
  res.json({ form: publicFormResponse(form, req) });
});

export const getPublicFormById = asyncHandler(async (req, res) => {
  const form = await getPublishedFormById(req.params.id);
  if (!form) return res.status(404).json({ error: 'Form not found' });
  res.json({ form: publicFormResponse(form, req) });
});

export const submitForm = asyncHandler(async (req, res) => {
  const form = await getPublishedFormBySlug(req.params.slug);
  if (!form) return res.status(404).json({ error: 'Form not found' });

  const body = req.body || {};
  // CAPTCHA verification is a real network round trip (STRIDETO-SEC-2) and
  // must be awaited: without this, `spam` would be a pending Promise whose
  // `.blocked`/`.silent` are both undefined, silently letting every
  // submission through regardless of verification outcome.
  const spam = await checkFormSpam(form, body);
  if (spam.blocked && spam.silent) {
    return res.status(201).json({
      message: form.successMessage || 'Thank you!',
      redirectUrl: form.redirectUrl || '',
    });
  }
  if (spam.blocked) {
    return res.status(400).json({ error: 'Submission blocked', reason: spam.reason });
  }

  const values = { ...body };
  // The CAPTCHA token is anti-abuse metadata, not form content — never
  // persist it into the submission record, notifications, or audit trail.
  delete values.captchaToken;
  delete values['g-recaptcha-response'];
  delete values.cfTurnstileResponse;
  const files = [];

  // Process file fields from multipart (req.files) or JSON references
  const fileFields = getInputFields(form.fields).filter((f) => f.type === 'file');
  for (const field of fileFields) {
    const uploaded = req.files?.find?.((f) => f.fieldname === field.name)
      || (Array.isArray(req.files) ? req.files.find((f) => f.fieldname === field.name) : null);
    if (uploaded) {
      const stored = await uploadFormFile({
        buffer: uploaded.buffer,
        originalname: uploaded.originalname,
        mimetype: uploaded.mimetype,
        size: uploaded.size,
        formSlug: form.slug,
        fieldName: field.name,
      });
      files.push({
        fieldName: field.name,
        assetId: stored.assetId,
        url: stored.url,
        filename: stored.filename,
        mimeType: stored.mimeType,
        size: stored.size,
      });
      values[field.name] = stored.url;
    } else if (body[`${field.name}Url`]) {
      values[field.name] = sanitizeString(body[`${field.name}Url`]);
    }
  }

  // Sanitize text values
  for (const field of getInputFields(form.fields)) {
    if (field.type === 'multi-checkbox') {
      let raw = values[field.name];
      if (typeof raw === 'string') {
        try { raw = JSON.parse(raw); } catch { raw = raw ? [raw] : []; }
      }
      values[field.name] = Array.isArray(raw) ? raw.map((v) => sanitizeString(v)) : [];
    } else if (field.type === 'checkbox' || field.type === 'consent') {
      values[field.name] = values[field.name] === true || values[field.name] === 'true' || values[field.name] === 'on';
    } else if (field.type === 'number') {
      values[field.name] = values[field.name] === '' || values[field.name] == null ? '' : Number(values[field.name]);
    } else if (field.type !== 'file' && values[field.name] != null) {
      values[field.name] = sanitizeString(String(values[field.name])).slice(0, 10000);
    }
  }

  const validation = validateSubmission(form, values);
  if (!validation.ok) {
    return res.status(400).json({ error: 'Validation failed', details: validation.errors });
  }

  const submission = await createFormSubmission({
    formId: form._id,
    formSlug: form.slug,
    formVersion: form.version,
    data: values,
    files,
    ipHash: hashIp(req.ip),
    userAgent: sanitizeString(req.get('user-agent') || '').slice(0, 500),
    spamScore: spam.score,
    metadata: {
      source: sanitizeString(body._source || 'web').slice(0, 50),
      pageUrl: sanitizeString(body._pageUrl || '').slice(0, 500),
    },
  });

  sendFormNotifications({ form, submission, data: values }).catch(() => {});

  scheduleAnalyticsEvent({
    eventType: 'form_submit',
    entityType: 'form',
    entityId: String(form._id),
    metadata: { formSlug: form.slug, submissionId: String(submission._id) },
  });

  res.status(201).json({
    message: form.successMessage || 'Thank you!',
    redirectUrl: form.redirectUrl || '',
    submissionId: submission._id,
  });
});

export const uploadFormFieldFile = asyncHandler(async (req, res) => {
  const form = await getPublishedFormBySlug(req.params.slug);
  if (!form) return res.status(404).json({ error: 'Form not found' });
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file uploaded' });
  const fieldName = sanitizeString(req.body?.fieldName || req.body?.field || '').slice(0, 80);
  const field = getInputFields(form.fields).find((f) => f.name === fieldName && f.type === 'file');
  if (!field) return res.status(400).json({ error: 'Invalid file field' });

  const stored = await uploadFormFile({
    buffer: file.buffer,
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    formSlug: form.slug,
    fieldName: field.name,
  });

  res.status(201).json({
    url: stored.url,
    assetId: stored.assetId,
    filename: stored.filename,
  });
});
