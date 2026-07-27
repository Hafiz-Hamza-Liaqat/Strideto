import {
  classifyJob,
  classifyScholarship,
  classifyAdmission,
  classifyInternship,
  classifyIntlScholarship,
} from '../opportunityTrustRemediation.js';
import { buildContentFingerprint } from './productionTrustManifestBuilder.js';

const classifiers = {
  jobs: classifyJob,
  scholarships: classifyScholarship,
  admissions: classifyAdmission,
  internships: classifyInternship,
  intlScholarships: classifyIntlScholarship,
};

const modelsByCollection = {
  jobs: 'Job',
  scholarships: 'Scholarship',
  admissions: 'Admission',
  internships: 'Internship',
  intlScholarships: 'IntlScholarship',
};

/**
 * Re-read each manifest row and verify status + classification still matches.
 */
export async function verifySafeNowManifestEntries(models, entries, now = new Date()) {
  const issues = [];
  for (const row of entries) {
    const modelName = modelsByCollection[row.collection];
    const Model = models[modelName];
    if (!Model) {
      issues.push({ key: row.collection, issue: 'unknown_collection' });
      continue;
    }
    const doc = await Model.findById(row._id).lean();
    if (!doc) {
      issues.push({ slug: row.slug, title: row.title, issue: 'missing_in_database' });
      continue;
    }
    if (doc.status !== row.originalStatus) {
      issues.push({
        slug: row.slug,
        title: row.title,
        issue: 'status_mismatch',
        expected: row.originalStatus,
        actual: doc.status,
      });
    }
    const item = classifiers[row.collection](doc, now);
    if (item.proposedStatus !== row.proposedStatus) {
      issues.push({
        slug: row.slug,
        title: row.title,
        issue: 'proposed_action_mismatch',
        manifest: row.proposedStatus,
        current: item.proposedStatus,
        classification: item.classification,
      });
    }
    const fp = buildContentFingerprint(doc, row.collection);
    if (row.contentFingerprint && fp !== row.contentFingerprint) {
      issues.push({
        slug: row.slug,
        title: row.title,
        issue: 'content_changed_since_audit',
      });
    }
  }
  return { ok: issues.length === 0, issues };
}

/** After apply: every row should be at proposedStatus. */
export async function verifySafeNowPostApply(models, entries) {
  const issues = [];
  const modelsByCollection = {
    jobs: 'Job',
    scholarships: 'Scholarship',
    admissions: 'Admission',
    internships: 'Internship',
    intlScholarships: 'IntlScholarship',
  };
  for (const row of entries) {
    const Model = models[modelsByCollection[row.collection]];
    const doc = await Model.findById(row._id).lean();
    if (!doc) {
      issues.push({ slug: row.slug, issue: 'missing_after_apply' });
      continue;
    }
    if (doc.status !== row.proposedStatus) {
      issues.push({
        slug: row.slug,
        issue: 'post_apply_status_mismatch',
        expected: row.proposedStatus,
        actual: doc.status,
      });
    }
  }
  return { ok: issues.length === 0, issues };
}
