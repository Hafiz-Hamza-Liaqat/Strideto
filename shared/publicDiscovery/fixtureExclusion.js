/**
 * Explicit fixture / QA classification for public production projection.
 *
 * Records are excluded from launch/public production feeds when they carry
 * an explicit fixture flag — never by title-string matching alone.
 *
 * Local/QA environments may still include fixtures unless PUBLIC_LAUNCH_PROJECTION=1.
 */

export const FIXTURE_DATA_CLASSES = Object.freeze(['fixture', 'qa', 'test', 'disposable']);

export function isLaunchProjection(env = process.env) {
  if (env.PUBLIC_LAUNCH_PROJECTION === '1') return true;
  if (env.PUBLIC_INCLUDE_FIXTURES === '1') return false;
  return env.NODE_ENV === 'production';
}

export function isFixtureRecord(doc = {}) {
  if (!doc || typeof doc !== 'object') return false;
  if (doc.isFixture === true) return true;
  if (doc.launchEligible === false) return true;
  if (doc.demoOnly === true) return true;
  const dataClass = String(doc.dataClass || '').toLowerCase();
  if (FIXTURE_DATA_CLASSES.includes(dataClass)) return true;
  const environment = String(doc.environment || '').toLowerCase();
  if (environment === 'local' || environment === 'qa' || environment === 'test') return true;
  return false;
}

/**
 * Mongo $and clause that hides explicitly classified fixtures.
 * Additive: records without these fields remain visible.
 */
export function fixtureExclusionClause(env = process.env) {
  if (!isLaunchProjection(env)) return null;
  return {
    $and: [
      { $or: [{ isFixture: { $exists: false } }, { isFixture: { $ne: true } }] },
      { $or: [{ launchEligible: { $exists: false } }, { launchEligible: { $ne: false } }] },
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

export const FIXTURE_FIELD_DEFINITION = Object.freeze({
  isFixture: { type: Boolean, default: false, index: true },
  dataClass: { type: String, trim: true, lowercase: true, default: undefined },
  environment: { type: String, trim: true, lowercase: true, default: undefined },
  launchEligible: { type: Boolean, default: undefined },
  demoOnly: { type: Boolean, default: false },
});
