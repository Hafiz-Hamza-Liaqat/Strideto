/**
 * Remediation policy and non-sensitive candidate hints (no Mongo ObjectIds).
 * Target-specific `_id` manifests are generated at runtime under server/.remediation-targets/<fingerprint>/.
 */

/** Slugs/externalIds observed on local audit — hints only; not production targets. */
export const SAFE_NOW_CANDIDATE_HINTS = {
  jobs: [
    { slug: 'qa-import-test-job-punjab', reason: 'placeholder_or_beta' },
    { slug: 'nts-test-invigilator-2026-punjab', externalId: 'ext_NTS_m9cpm7', reason: 'placeholder_or_beta' },
    { slug: 'import-alias-test-job-islamabad', reason: 'placeholder_or_beta' },
  ],
  scholarships: [
    { slug: 'qa-import-json-scholarship-2026-pakistan', reason: 'invalid_or_non_scholarship' },
    { slug: 'org-alias-test-pakistan', reason: 'invalid_or_non_scholarship' },
    { slug: 'qa-scholarship-010012-germany', reason: 'invalid_or_non_scholarship' },
    { slug: 'backend-engineer-wallets-100-remote-blockchain-remote-job', reason: 'invalid_or_non_scholarship' },
  ],
  admissions: [
    { slug: 'bs-qa-testing-qa-university', reason: 'missing_core_metadata' },
  ],
  internships: [
    { slug: 'Paid Internship', reason: 'past_deadline', proposedStatus: 'closed' },
  ],
  intlScholarships: [
    { title: 'Study Visa', reason: 'not_scholarship_like' },
  ],
};

export const DEFERRED_POLICY = {
  jobs: 'launch-v1 synthetic launch/demo records → draft after trusted-content gate',
  scholarships: 'legacy-domain synthetic links → draft after trusted-content gate',
  admissions: 'synthetic Fall 2024/2025 session pattern → draft after trusted-content gate',
};

export const MANUAL_REVIEW_POLICY = {
  jobs: 'admin-created or missing trust metadata without safe-now invalid classification',
  scholarships: 'HEC generated-title pattern or official-link-only pending human verification',
};

export const TARGET_MANIFEST_MAX_AGE_MS = 4 * 60 * 60 * 1000;
export const DRY_RUN_VALIDITY_MS = 2 * 60 * 60 * 1000;
