import { isPubliclyLaunchVisible } from './fixtureExclusion.js';

/**
 * Saved references may point at records that are no longer launch-visible.
 * Never expose fixture/QA metadata. Return a safe unavailable stub instead.
 */
export function projectSavedRecord(doc, projectFn) {
  if (!doc || !doc._id) {
    return { _id: null, unavailable: true };
  }
  const id = String(doc._id);
  if (doc.status && doc.status !== 'active') {
    return { _id: id, unavailable: true };
  }
  if (!isPubliclyLaunchVisible(doc)) {
    return { _id: id, unavailable: true };
  }
  try {
    const projected = projectFn(doc);
    if (!projected || !projected._id) return { _id: id, unavailable: true };
    return { ...projected, unavailable: false };
  } catch {
    return { _id: id, unavailable: true };
  }
}
