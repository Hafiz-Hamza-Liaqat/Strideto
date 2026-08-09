/**
 * Education Intelligence taxonomy (Mission 4).
 *
 * Canonical, stable vocabulary shared by server models and client validation.
 * Client- and server-safe: pure JS, no Node/DOM globals.
 *
 * DO NOT rename existing values — stored in DB.
 * Add new values freely; Mission 5+ will extend as needed.
 */

// ── Test categories ─────────────────────────────────────────────────────────

export const TEST_CATEGORIES = Object.freeze({
  ENGLISH_PROFICIENCY: 'english_proficiency',
  ADMISSIONS: 'admissions',
  NATIONAL_QUALIFICATION: 'national_qualification',
  PROFESSIONAL: 'professional',
  OTHER: 'other',
});

// ── Delivery modes ───────────────────────────────────────────────────────────

export const DELIVERY_MODES = Object.freeze({
  COMPUTER_BASED: 'computer_based',
  PAPER_BASED: 'paper_based',
  IN_PERSON: 'in_person',
  ONLINE: 'online',
  AT_HOME: 'at_home',
});

// ── Degree levels ────────────────────────────────────────────────────────────

export const DEGREE_LEVELS = Object.freeze({
  HIGH_SCHOOL: 'high_school',
  DIPLOMA: 'diploma',
  CERTIFICATE: 'certificate',
  BACHELOR: 'bachelor',
  MASTER: 'master',
  PHD: 'phd',
  POSTDOC: 'postdoc',
  PROFESSIONAL: 'professional',
});

// ── Study modes ──────────────────────────────────────────────────────────────

export const STUDY_MODES = Object.freeze({
  FULL_TIME: 'full_time',
  PART_TIME: 'part_time',
  ONLINE: 'online',
  BLENDED: 'blended',
  DISTANCE: 'distance',
});

// ── Academic fields ──────────────────────────────────────────────────────────

export const ACADEMIC_FIELDS = Object.freeze({
  ARTS: 'arts',
  BUSINESS: 'business',
  COMPUTING: 'computing',
  EDUCATION: 'education',
  ENGINEERING: 'engineering',
  HEALTH: 'health',
  HUMANITIES: 'humanities',
  LAW: 'law',
  NATURAL_SCIENCE: 'natural_science',
  SOCIAL_SCIENCE: 'social_science',
  OTHER: 'other',
});

// ── Institution types ────────────────────────────────────────────────────────

export const INSTITUTION_TYPES = Object.freeze({
  UNIVERSITY: 'university',
  COLLEGE: 'college',
  INSTITUTE: 'institute',
  SCHOOL: 'school',
  TRAINING_CENTER: 'training_center',
  OTHER: 'other',
});

// ── External resource types ──────────────────────────────────────────────────

export const RESOURCE_TYPES = Object.freeze({
  OFFICIAL_GUIDE: 'official_guide',
  PRACTICE_TEST: 'practice_test',
  MOCK_EXAM: 'mock_exam',
  COURSE: 'course',
  BOOK: 'book',
  APP: 'app',
  VIDEO: 'video',
  OTHER: 'other',
});

// ── Trust levels for external resources ─────────────────────────────────────

export const TRUST_LEVELS = Object.freeze({
  OFFICIAL: 'official',
  TRUSTED: 'trusted',
  COMMUNITY: 'community',
});

// ── Alert types ──────────────────────────────────────────────────────────────

export const ALERT_TYPES = Object.freeze({
  REGISTRATION_OPEN: 'registration_open',
  REGISTRATION_DEADLINE: 'registration_deadline',
  TEST_DATE: 'test_date',
  FEE_CHANGE: 'fee_change',
  FORMAT_CHANGE: 'format_change',
  RESULT: 'result',
  GENERAL: 'general',
});

// ── Publication statuses ─────────────────────────────────────────────────────

export const PUB_STATUSES = Object.freeze({
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
});

// ── Alert importance ─────────────────────────────────────────────────────────

export const ALERT_IMPORTANCE = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
});

// ── Validation helpers ───────────────────────────────────────────────────────

function makeSet(obj) {
  return new Set(Object.values(obj));
}

const TEST_CAT_SET = makeSet(TEST_CATEGORIES);
const DELIVERY_SET = makeSet(DELIVERY_MODES);
const DEGREE_SET = makeSet(DEGREE_LEVELS);
const STUDY_SET = makeSet(STUDY_MODES);
const FIELD_SET = makeSet(ACADEMIC_FIELDS);
const INST_TYPE_SET = makeSet(INSTITUTION_TYPES);
const RESOURCE_TYPE_SET = makeSet(RESOURCE_TYPES);
const TRUST_SET = makeSet(TRUST_LEVELS);
const ALERT_TYPE_SET = makeSet(ALERT_TYPES);
const PUB_STATUS_SET = makeSet(PUB_STATUSES);
const IMPORTANCE_SET = makeSet(ALERT_IMPORTANCE);

export const isValidTestCategory = (v) => typeof v === 'string' && TEST_CAT_SET.has(v);
export const isValidDeliveryMode = (v) => typeof v === 'string' && DELIVERY_SET.has(v);
export const isValidDegreeLevel = (v) => typeof v === 'string' && DEGREE_SET.has(v);
export const isValidStudyMode = (v) => typeof v === 'string' && STUDY_SET.has(v);
export const isValidAcademicField = (v) => typeof v === 'string' && FIELD_SET.has(v);
export const isValidInstitutionType = (v) => typeof v === 'string' && INST_TYPE_SET.has(v);
export const isValidResourceType = (v) => typeof v === 'string' && RESOURCE_TYPE_SET.has(v);
export const isValidTrustLevel = (v) => typeof v === 'string' && TRUST_SET.has(v);
export const isValidAlertType = (v) => typeof v === 'string' && ALERT_TYPE_SET.has(v);
export const isValidPubStatus = (v) => typeof v === 'string' && PUB_STATUS_SET.has(v);
export const isValidAlertImportance = (v) => typeof v === 'string' && IMPORTANCE_SET.has(v);

/** True for an http(s) URL (replicates evidence.js contract for client use). */
export function isValidHttpUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const u = new URL(value.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Build a slug from a name string.
 * Mirrors the shared organization slug logic for consistency.
 */
export function educationSlug(name) {
  const base = (typeof name === 'string' ? name : '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'item';
}
