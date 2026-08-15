/**
 * Immutable public listing slug allocation (Phase 17D-5).
 * Unique, URL-safe, not a Mongo id. Frozen after first assignment.
 */
import crypto from 'node:crypto';
import { GbsServiceListing } from '../models/gbs/GbsServiceListing.js';
import { slugify } from './slugify.js';
import { isReservedSlug } from '../config/reservedSlugs.js';
import { GBS_MARKETPLACE_BOUNDS } from '../../../shared/gbs/constants.js';

function normalizeListingSlug(text) {
  const raw = slugify(text || '');
  if (!raw) return '';
  const max = GBS_MARKETPLACE_BOUNDS.SLUG_MAX;
  return raw.length > max ? raw.slice(0, max).replace(/-+$/, '') : raw;
}

function opaqueSuffix() {
  return crypto.randomBytes(3).toString('hex');
}

export function generateListingPublicSlug(title, { attempt = 0 } = {}) {
  let candidate = normalizeListingSlug(title) || 'business-service';
  if (isReservedSlug(candidate) || candidate === 'business-services' || candidate === 'providers') {
    candidate = `business-service-${opaqueSuffix()}`;
  }
  if (attempt > 0) {
    const suffix = opaqueSuffix();
    const maxBase = GBS_MARKETPLACE_BOUNDS.SLUG_MAX - suffix.length - 1;
    candidate = `${candidate.slice(0, Math.max(1, maxBase))}-${suffix}`;
  }
  candidate = normalizeListingSlug(candidate) || `business-service-${opaqueSuffix()}`;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidate)) {
    candidate = `business-service-${opaqueSuffix()}`;
  }
  return candidate;
}

export async function assignListingPublicSlugIfAbsent(listing) {
  if (!listing?._id) return listing;
  if (listing.publicSlug) return listing;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = generateListingPublicSlug(listing.title, { attempt });
    try {
      const updated = await GbsServiceListing.findOneAndUpdate(
        {
          _id: listing._id,
          $or: [{ publicSlug: { $exists: false } }, { publicSlug: null }, { publicSlug: '' }],
        },
        { $set: { publicSlug: candidate } },
        { new: true }
      );
      if (updated) return updated;
      const current = await GbsServiceListing.findById(listing._id).lean();
      if (current?.publicSlug) return current;
      return listing;
    } catch (err) {
      if (err?.code !== 11000) throw err;
    }
  }
  throw Object.assign(new Error('listing_slug_unavailable'), {
    status: 500,
    code: 'listing_slug_unavailable',
  });
}
