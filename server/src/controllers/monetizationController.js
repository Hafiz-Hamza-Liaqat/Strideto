import { Job } from '../models/Job.js';
import { Scholarship } from '../models/Scholarship.js';
import { AdSlotConfig } from '../models/AdSlotConfig.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { cacheGet, cacheSet, cacheDelPattern } from '../config/redis.js';
import { CACHE_KEYS } from '../utils/cacheKeys.js';
import { sanitizeString } from '../utils/sanitize.js';
import {
  isSlotWithinLimits,
} from '../utils/adSlotLimits.js';
import { scheduleAnalyticsEvent } from '../services/analytics/AnalyticsEventService.js';
import { buildPublicJobMongoFilter } from '../../../shared/publicDiscovery/publicTruth.js';

const FEATURED_LIMIT = 10;
const SPONSORED_LIMIT = 10;
const CACHE_TTL = 300;

export const getFeaturedJobs = asyncHandler(async (req, res) => {
  let data = await cacheGet(CACHE_KEYS.FEATURED_JOBS);
  if (!data) {
    data = await Job.find({ ...buildPublicJobMongoFilter(), isFeatured: true }).sort({ createdAt: -1 }).limit(FEATURED_LIMIT).lean();
    await cacheSet(CACHE_KEYS.FEATURED_JOBS, data, CACHE_TTL);
  }
  res.json({ data });
});

export const getSponsoredJobs = asyncHandler(async (req, res) => {
  const data = await Job.find({ ...buildPublicJobMongoFilter(), isSponsored: true }).sort({ createdAt: -1 }).limit(SPONSORED_LIMIT).lean();
  res.json({ data });
});

export const getFeaturedScholarships = asyncHandler(async (req, res) => {
  let data = await cacheGet(CACHE_KEYS.FEATURED_SCHOLARSHIPS);
  if (!data) {
    data = await Scholarship.find({ status: 'active', isFeatured: true }).sort({ deadline: 1 }).limit(FEATURED_LIMIT).lean();
    await cacheSet(CACHE_KEYS.FEATURED_SCHOLARSHIPS, data, CACHE_TTL);
  }
  res.json({ data });
});

export const getSponsoredScholarships = asyncHandler(async (req, res) => {
  const data = await Scholarship.find({ status: 'active', isSponsored: true }).sort({ createdAt: -1 }).limit(SPONSORED_LIMIT).lean();
  res.json({ data });
});

export const getAdSlots = asyncHandler(async (req, res) => {
  const slots = await AdSlotConfig.find({ active: true }).lean();
  const data = slots.filter(isSlotWithinLimits);
  res.json({ data });
});

export const listAdSlots = asyncHandler(async (req, res) => {
  const slots = await AdSlotConfig.find({}).sort({ placement: 1 }).lean();
  res.json({ data: slots });
});

export const createAdSlot = asyncHandler(async (req, res) => {
  const body = req.body || {};
  if (!body.slotId || !String(body.slotId).trim()) return res.status(400).json({ error: 'slotId is required' });
  const doc = await AdSlotConfig.create({
    slotId: sanitizeString(body.slotId),
    name: sanitizeString(body.name || body.slotId),
    placement: body.placement || 'sidebar',
    dimensions: body.dimensions ? sanitizeString(body.dimensions) : undefined,
    active: body.active !== false,
    imageUrl: body.imageUrl ? sanitizeString(body.imageUrl) : undefined,
    targetUrl: body.targetUrl ? sanitizeString(body.targetUrl) : undefined,
    startDate: body.startDate ? new Date(body.startDate) : undefined,
    endDate: body.endDate ? new Date(body.endDate) : undefined,
    priority: body.priority != null ? Number(body.priority) : 0,
    clickLimit: body.clickLimit != null ? Number(body.clickLimit) : undefined,
    impressionLimit: body.impressionLimit != null ? Number(body.impressionLimit) : undefined,
    status: body.status || 'active',
  });
  res.status(201).json(doc);
});

export const updateAdSlot = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const doc = await AdSlotConfig.findByIdAndUpdate(
    req.params.id,
    {
      ...(body.name != null && { name: sanitizeString(body.name) }),
      ...(body.placement != null && { placement: body.placement }),
      ...(body.dimensions != null && { dimensions: sanitizeString(body.dimensions) }),
      ...(body.active !== undefined && { active: !!body.active }),
      ...(body.imageUrl !== undefined && { imageUrl: sanitizeString(body.imageUrl) }),
      ...(body.targetUrl !== undefined && { targetUrl: sanitizeString(body.targetUrl) }),
      ...(body.startDate !== undefined && { startDate: body.startDate ? new Date(body.startDate) : null }),
      ...(body.endDate !== undefined && { endDate: body.endDate ? new Date(body.endDate) : null }),
      ...(body.priority !== undefined && { priority: Number(body.priority) }),
      ...(body.clickLimit !== undefined && { clickLimit: body.clickLimit ? Number(body.clickLimit) : null }),
      ...(body.impressionLimit !== undefined && { impressionLimit: body.impressionLimit ? Number(body.impressionLimit) : null }),
      ...(body.status !== undefined && { status: body.status }),
    },
    { new: true }
  );
  if (!doc) return res.status(404).json({ error: 'Ad slot not found' });
  res.json(doc);
});

export const deleteAdSlot = asyncHandler(async (req, res) => {
  const doc = await AdSlotConfig.findByIdAndDelete(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Ad slot not found' });
  res.json({ message: 'Deleted' });
});

/** Public: record one advertisement impression (no auth). */
export const trackAdImpression = asyncHandler(async (req, res) => {
  const slotId = sanitizeString(req.body?.slotId);
  if (!slotId) return res.status(400).json({ error: 'slotId is required' });

  const doc = await AdSlotConfig.findOneAndUpdate(
    {
      slotId,
      active: true,
      status: 'active',
      $or: [
        { impressionLimit: { $exists: false } },
        { impressionLimit: null },
        { $expr: { $lt: [{ $ifNull: ['$impressionCount', 0] }, '$impressionLimit'] } },
      ],
    },
    { $inc: { impressionCount: 1 } },
    { new: true }
  ).select('slotId impressionCount');

  if (!doc) return res.status(404).json({ error: 'Slot not found or impression limit reached' });
  scheduleAnalyticsEvent({
    eventType: 'ad_impression',
    entityType: 'ad',
    entityId: doc.slotId,
    metadata: { placement: req.body?.placement },
  });
  res.json({ success: true, slotId: doc.slotId, impressionCount: doc.impressionCount });
});

/** Public: record one advertisement click (no auth). */
export const trackAdClick = asyncHandler(async (req, res) => {
  const slotId = sanitizeString(req.body?.slotId);
  if (!slotId) return res.status(400).json({ error: 'slotId is required' });

  const doc = await AdSlotConfig.findOneAndUpdate(
    {
      slotId,
      active: true,
      status: 'active',
      $or: [
        { clickLimit: { $exists: false } },
        { clickLimit: null },
        { $expr: { $lt: [{ $ifNull: ['$clickCount', 0] }, '$clickLimit'] } },
      ],
    },
    { $inc: { clickCount: 1 } },
    { new: true }
  ).select('slotId clickCount');

  if (!doc) return res.status(404).json({ error: 'Slot not found or click limit reached' });
  scheduleAnalyticsEvent({
    eventType: 'ad_click',
    entityType: 'ad',
    entityId: doc.slotId,
    metadata: { placement: req.body?.placement, targetUrl: req.body?.targetUrl },
  });
  res.json({ success: true, slotId: doc.slotId, clickCount: doc.clickCount });
});

/** Admin: set job featured/sponsored */
export const setJobMonetization = asyncHandler(async (req, res) => {
  const job = await Job.findByIdAndUpdate(
    req.params.id,
    {
      ...(req.body?.isFeatured !== undefined && { isFeatured: !!req.body.isFeatured }),
      ...(req.body?.isSponsored !== undefined && { isSponsored: !!req.body.isSponsored }),
    },
    { new: true }
  );
  if (!job) return res.status(404).json({ error: 'Job not found' });
  await cacheDelPattern(CACHE_KEYS.PREFIX_FEATURED);
  res.json(job);
});

/** Admin: set scholarship featured/sponsored */
export const setScholarshipMonetization = asyncHandler(async (req, res) => {
  const doc = await Scholarship.findByIdAndUpdate(
    req.params.id,
    {
      ...(req.body?.isFeatured !== undefined && { isFeatured: !!req.body.isFeatured }),
      ...(req.body?.isSponsored !== undefined && { isSponsored: !!req.body.isSponsored }),
    },
    { new: true }
  );
  if (!doc) return res.status(404).json({ error: 'Scholarship not found' });
  await cacheDelPattern(CACHE_KEYS.PREFIX_FEATURED);
  res.json(doc);
});
