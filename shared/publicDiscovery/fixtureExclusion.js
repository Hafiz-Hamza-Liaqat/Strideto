/**
 * Server-authoritative launch / public projection.
 *
 * Pipeline: stored record → publication/authority eligibility → launch
 * eligibility → public projection.
 *
 * Deny-by-default in launch projection: unknown/unclassified records are
 * NOT public. Title-string matching is never used.
 *
 * Local/QA environments may still include unclassified records unless
 * PUBLIC_LAUNCH_PROJECTION=1.
 */

export const FIXTURE_DATA_CLASSES = Object.freeze(['fixture', 'qa', 'test', 'disposable', 'acceptance']);

export const LAUNCH_GATED_SEARCH_TYPES = Object.freeze([
  'job',
  'internship',
  'scholarship',
  'admission',
  'program',
  'agent',
  'marketplace',
]);

export const LAUNCH_VISIBILITY = Object.freeze({
  ELIGIBLE: 'eligible',
  PENDING_REVIEW: 'pending_review',
  INELIGIBLE: 'ineligible',
});

export function isLaunchProjection(env = process.env) {
  if (env.PUBLIC_LAUNCH_PROJECTION === '1') return true;
  if (env.PUBLIC_INCLUDE_FIXTURES === '1') return false;
  return env.NODE_ENV === 'production';
}

function dataClassOf(doc) {
  return String(doc?.dataClass || '').toLowerCase();
}

function environmentOf(doc) {
  return String(doc?.environment || '').toLowerCase();
}

/** Explicit fixture / QA / demo classification — never title matching. */
export function isFixtureRecord(doc = {}) {
  if (!doc || typeof doc !== 'object') return false;
  if (doc.isFixture === true) return true;
  if (doc.demoOnly === true) return true;
  if (FIXTURE_DATA_CLASSES.includes(dataClassOf(doc))) return true;
  const environment = environmentOf(doc);
  if (environment === 'local' || environment === 'qa' || environment === 'test') return true;
  return false;
}

/**
 * True when a record may appear on public launch surfaces.
 * Requires explicit launchEligible === true and no fixture classification.
 */
export function isPubliclyLaunchVisible(doc = {}) {
  if (!doc || typeof doc !== 'object') return false;
  if (isFixtureRecord(doc)) return false;
  return doc.launchEligible === true;
}

export function resolveLaunchVisibility(doc = {}) {
  if (isFixtureRecord(doc) || doc.launchEligible === false) return LAUNCH_VISIBILITY.INELIGIBLE;
  if (doc.launchEligible === true) return LAUNCH_VISIBILITY.ELIGIBLE;
  return LAUNCH_VISIBILITY.PENDING_REVIEW;
}

/**
 * Authority publish (Admin approval / verified publication) may mark a
 * record launch-eligible only when it is not a fixture/test/demo record.
 */
export function assignLaunchEligibleOnAuthorityPublish(existing = {}) {
  if (isFixtureRecord(existing)) return false;
  if (existing.launchEligible === false) return false;
  return true;
}

/**
 * Mongo clause for launch projection.
 * Unknown (missing launchEligible) is NOT public.
 */
export function fixtureExclusionClause(env = process.env) {
  if (!isLaunchProjection(env)) return null;
  return {
    $and: [
      { launchEligible: true },
      { $or: [{ isFixture: { $exists: false } }, { isFixture: { $ne: true } }] },
      { $or: [{ demoOnly: { $exists: false } }, { demoOnly: { $ne: true } }] },
      { $or: [{ dataClass: { $exists: false } }, { dataClass: { $nin: [...FIXTURE_DATA_CLASSES] } }] },
      { $or: [{ environment: { $exists: false } }, { environment: { $nin: ['local', 'qa', 'test'] } }] },
    ],
  };
}

export function withFixtureExclusion(filter = {}, env = process.env) {
  const clause = fixtureExclusionClause(env);
  if (!clause) return filter;
  const existingAnd = Array.isArray(filter.$and) ? filter.$and : [];
  const rest = { ...filter };
  delete rest.$and;
  const extra = Object.keys(rest).length ? [rest] : [];
  return { $and: [...existingAnd, ...extra, ...clause.$and].filter((part) => part && Object.keys(part).length) };
}

/** Search-index filter: gated entity types require metadata.launchEligible. */
export function withLaunchSearchFilter(filter = {}, env = process.env) {
  if (!isLaunchProjection(env)) return filter;
  const gate = {
    $or: [
      { entityType: { $nin: [...LAUNCH_GATED_SEARCH_TYPES] } },
      { 'metadata.launchEligible': true },
    ],
  };
  const existingAnd = Array.isArray(filter.$and) ? filter.$and : [];
  const rest = { ...filter };
  delete rest.$and;
  const extra = Object.keys(rest).length ? [rest] : [];
  return { $and: [...existingAnd, ...extra, gate] };
}

export const FIXTURE_FIELD_DEFINITION = Object.freeze({
  isFixture: { type: Boolean, default: false, index: true },
  dataClass: { type: String, trim: true, lowercase: true, default: undefined },
  environment: { type: String, trim: true, lowercase: true, default: undefined },
  launchEligible: { type: Boolean, default: undefined, index: true },
  demoOnly: { type: Boolean, default: false },
});
