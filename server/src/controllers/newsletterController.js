import { NewsletterSubscriber } from '../models/NewsletterSubscriber.js';
import { NewsletterLog } from '../models/NewsletterLog.js';
import { Job } from '../models/Job.js';
import { Scholarship } from '../models/Scholarship.js';
import { Admission } from '../models/Admission.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sanitizeString } from '../utils/sanitize.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const subscribe = asyncHandler(async (req, res) => {
  const email = sanitizeString(req.body?.email || '').toLowerCase();
  if (!email || !EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: 'Valid email is required' });
  }
  let doc = await NewsletterSubscriber.findOne({ email });
  if (doc) {
    doc.subscribed = true;
    doc.frequency = req.body.frequency || doc.frequency || 'weekly';
    await doc.save();
  } else {
    doc = await NewsletterSubscriber.create({
      email,
      frequency: req.body.frequency || 'weekly',
    });
  }
  res.status(201).json({
    message: 'Subscription saved. Email delivery is not active until outbound mail is configured.',
    email: doc.email,
    deliveryConfigured: false,
  });
});

export const unsubscribe = asyncHandler(async (req, res) => {
  const email = sanitizeString(req.body?.email || req.query?.email || '').toLowerCase();
  if (!email || !EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: 'Valid email is required' });
  }
  const doc = await NewsletterSubscriber.findOneAndUpdate({ email }, { subscribed: false }, { new: true });
  if (!doc) return res.status(404).json({ error: 'Email not found' });
  res.json({ message: 'Unsubscribed', email: doc.email });
});

/**
 * Daily digest: new jobs, trending scholarships, admission deadlines.
 * Logs to NewsletterLog; actual sending via Nodemailer/SendGrid placeholder.
 */
export const sendDaily = asyncHandler(async (req, res) => {
  const subscribers = await NewsletterSubscriber.find({ subscribed: true }).lean();
  const subscriberCount = subscribers.length;

  const [newJobs, trendingScholarships, admissionDeadlines] = await Promise.all([
    Job.find({ status: 'active' }).sort({ createdAt: -1 }).limit(10).select('title company province deadline').lean(),
    Scholarship.find({ status: 'active' }).sort({ views: -1, deadline: 1 }).limit(5).select('title provider deadline').lean(),
    Admission.find({ status: 'active' }).sort({ deadline: 1 }).limit(5).select('program institution deadline').lean(),
  ]);

  const subject = `Strideto Daily – ${newJobs.length} new jobs, scholarships & admission deadlines`;
  const summary = `New jobs: ${newJobs.length}, Scholarships: ${trendingScholarships.length}, Admissions: ${admissionDeadlines.length}`;

  const log = await NewsletterLog.create({
    subscriberCount,
    sentCount: subscriberCount,
    openCount: 0,
    clickCount: 0,
    subject,
    summary,
    status: 'sent',
  });

  res.json({
    message: 'Daily digest prepared. Integrate Nodemailer/SendGrid for actual delivery.',
    logId: log._id,
    subscriberCount: log.sentCount,
    subject: log.subject,
    summary: log.summary,
    newJobsCount: newJobs.length,
    scholarshipsCount: trendingScholarships.length,
    admissionsCount: admissionDeadlines.length,
  });
});
