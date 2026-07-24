import crypto from 'crypto';
import { Feedback, FEEDBACK_TYPES } from '../models/Feedback.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sanitizeString } from '../utils/sanitize.js';
import { notifyStaff } from '../services/notificationService.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_SCREENSHOT_PREFIXES = ['data:image/png;base64,', 'data:image/jpeg;base64,', 'data:image/webp;base64,'];
const MAX_SCREENSHOT_CHARS = 400000;

function hashIp(ip) {
  if (!ip) return undefined;
  return crypto.createHash('sha256').update(String(ip)).digest('hex').slice(0, 32);
}

function isValidScreenshot(value) {
  if (!value) return true;
  if (typeof value !== 'string') return false;
  if (value.length > MAX_SCREENSHOT_CHARS) return false;
  return ALLOWED_SCREENSHOT_PREFIXES.some((p) => value.startsWith(p));
}

export const submitFeedback = asyncHandler(async (req, res) => {
  const body = req.body || {};

  // Honeypot
  if (body.website && String(body.website).trim()) {
    return res.status(201).json({ message: 'Thank you for your feedback.' });
  }

  const type = sanitizeString(body.type || '').toLowerCase();
  const message = sanitizeString(body.message || '').slice(0, 4000);
  const name = sanitizeString(body.name || '').slice(0, 120);
  const email = sanitizeString(body.email || '').toLowerCase().slice(0, 254);
  const pageUrl = sanitizeString(body.pageUrl || '').slice(0, 500);
  const screenshotDataUrl = typeof body.screenshotDataUrl === 'string' ? body.screenshotDataUrl : '';

  let rating;
  if (body.rating !== undefined && body.rating !== null && body.rating !== '') {
    rating = Number(body.rating);
  }

  const errors = {};
  if (!FEEDBACK_TYPES.includes(type)) errors.type = 'Type must be bug, feature, or general';
  if (!message || message.length < 10) errors.message = 'Message is required (min 10 characters)';
  if (rating !== undefined && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
    errors.rating = 'Rating must be an integer from 1 to 5';
  }
  if (email && !EMAIL_REGEX.test(email)) errors.email = 'Valid email is required';
  if (!isValidScreenshot(screenshotDataUrl)) {
    errors.screenshotDataUrl = 'Screenshot must be a small PNG, JPEG, or WebP image';
  }

  if (Object.keys(errors).length) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }

  const doc = await Feedback.create({
    type,
    message,
    rating: rating || undefined,
    name: name || undefined,
    email: email || undefined,
    pageUrl: pageUrl || undefined,
    screenshotDataUrl: screenshotDataUrl || undefined,
    ipHash: hashIp(req.ip),
    userAgent: sanitizeString(req.get('user-agent') || '').slice(0, 500),
    userId: req.user?.userId || undefined,
    employerId: req.employer?.employerId || undefined,
  });

  const typeLabel = type === 'bug' ? 'Bug report' : type === 'feature' ? 'Feature request' : 'General feedback';
  notifyStaff({
    category: 'feedback',
    type: 'feedback.new',
    title: `${typeLabel}${rating ? ` (${rating}/5)` : ''}`,
    body: message.slice(0, 200),
    link: '/admin',
    metadata: { feedbackId: doc._id, type, rating },
  }).catch(() => {});

  res.status(201).json({ message: 'Thank you for your feedback.', id: doc._id });
});
