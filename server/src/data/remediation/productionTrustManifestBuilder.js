import {
  classifyJob,
  classifyScholarship,
  classifyAdmission,
  classifyInternship,
  classifyIntlScholarship,
} from '../opportunityTrustRemediation.js';

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isSafeNowJob(item) {
  return item.proposedAction === 'draft' && item.classification === 'invalid_incomplete' && !item.isLaunch;
}

function isDeferredJob(item) {
  return item.proposedAction === 'draft' && item.classification === 'synthetic_launch_demo' && item.isLaunch;
}

function isSafeNowScholarship(item) {
  return item.proposedAction === 'draft' && item.classification === 'invalid_incomplete';
}

function isDeferredScholarship(item) {
  return item.proposedAction === 'draft' && item.classification === 'synthetic_launch_demo';
}

function isSafeNowAdmission(item) {
  return item.proposedAction === 'draft' && item.classification === 'invalid_incomplete';
}

function isDeferredAdmission(item) {
  return item.proposedAction === 'draft' && item.classification === 'synthetic_launch_demo';
}

function isManual(item) {
  return item.classification === 'admin_manual_review'
    || item.classification === 'potentially_valid_missing_metadata';
}

function toManifestEntry(collection, doc, item, proposedStatus, reason) {
  const title = normalizeText(doc.title || doc.program);
  return {
    _id: String(doc._id),
    collection,
    originalStatus: normalizeText(doc.status) || 'active',
    proposedStatus,
    reason,
    externalId: normalizeText(doc.externalId) || null,
    slug: normalizeText(doc.slug) || null,
    title: title || null,
    organization: normalizeText(
      doc.company || doc.organization || doc.provider || doc.institution || doc.university
    ) || null,
    classification: item.classification,
    auditNotes: item.notes,
    contentFingerprint: buildContentFingerprint(doc, collection),
  };
}

function buildContentFingerprint(doc, collection) {
  const parts = [
    collection,
    normalizeText(doc.status),
    normalizeText(doc.slug),
    normalizeText(doc.externalId),
    normalizeText(doc.title || doc.program),
    doc.updatedAt ? new Date(doc.updatedAt).toISOString() : '',
  ];
  return parts.join('|');
}

/**
 * @param {object} datasets
 * @param {Date} [now]
 */
export function buildTargetManifestsFromDatasets(datasets, now = new Date()) {
  const safeNow = [];
  const deferred = [];
  const manualReview = [];

  const classifiers = {
    jobs: { fn: classifyJob, collection: 'jobs' },
    scholarships: { fn: classifyScholarship, collection: 'scholarships' },
    admissions: { fn: classifyAdmission, collection: 'admissions' },
    internships: { fn: classifyInternship, collection: 'internships' },
    intlScholarships: { fn: classifyIntlScholarship, collection: 'intlScholarships' },
  };

  for (const [key, { fn, collection }] of Object.entries(classifiers)) {
    for (const doc of datasets[key] || []) {
      const item = fn(doc, now);
      if (isManual(item)) {
        manualReview.push({
          collection,
          title: normalizeText(doc.title || doc.program) || null,
          slug: normalizeText(doc.slug) || null,
          externalId: normalizeText(doc.externalId) || null,
          organization: normalizeText(
            doc.company || doc.organization || doc.provider || doc.institution || doc.university
          ) || null,
          currentStatus: normalizeText(doc.status) || 'active',
          auditReason: item.notes.join(', '),
          classification: item.classification,
          _id: String(doc._id),
        });
        continue;
      }

      if (collection === 'jobs' && isSafeNowJob(item)) {
        safeNow.push(toManifestEntry(collection, doc, item, 'draft', item.notes.join(',')));
      } else if (collection === 'jobs' && isDeferredJob(item)) {
        deferred.push(toManifestEntry(collection, doc, item, 'draft', 'launch_v1_synthetic'));
      } else if (collection === 'scholarships' && isSafeNowScholarship(item)) {
        safeNow.push(toManifestEntry(collection, doc, item, 'draft', item.notes.join(',')));
      } else if (collection === 'scholarships' && isDeferredScholarship(item)) {
        deferred.push(toManifestEntry(collection, doc, item, 'draft', 'legacy_domain_link'));
      } else if (collection === 'admissions' && isSafeNowAdmission(item)) {
        safeNow.push(toManifestEntry(collection, doc, item, 'draft', item.notes.join(',')));
      } else if (collection === 'admissions' && isDeferredAdmission(item)) {
        deferred.push(toManifestEntry(collection, doc, item, 'draft', 'launch_session_pattern'));
      } else if (collection === 'internships' && item.proposedAction === 'close') {
        safeNow.push(toManifestEntry(collection, doc, item, 'closed', item.notes.join(',')));
      } else if (collection === 'intlScholarships' && item.proposedAction === 'draft' && item.classification === 'invalid_incomplete') {
        safeNow.push(toManifestEntry(collection, doc, item, 'draft', item.notes.join(',')));
      }
    }
  }

  return { safeNow, deferred, manualReview };
}

export function summarizeManifestEntries(entries) {
  const byCollection = {};
  const byAction = {};
  for (const row of entries) {
    byCollection[row.collection] = (byCollection[row.collection] || 0) + 1;
    const actionKey = `${row.collection}:${row.proposedStatus}`;
    byAction[actionKey] = (byAction[actionKey] || 0) + 1;
  }
  return { total: entries.length, byCollection, byAction };
}

export { buildContentFingerprint };
