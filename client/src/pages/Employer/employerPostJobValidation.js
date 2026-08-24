/**
 * Pure validation + apply-mode helpers for Employer Post Job (E.1F-C).
 * Mirrors server createJob contract in employerController.js.
 */
import { parseOpeningsCount } from '../../../../shared/employer/openingsCount.js';
import { normalizeCountryCode } from '../../../../shared/international/country.js';
import {
  JOB_FAMILIES,
  SPECIALIZATIONS_BY_FAMILY,
  mapLegacyCategory,
  isValidJobFamily,
  isValidSpecialization,
} from '../../../../shared/career/jobTaxonomy.js';

export const JOB_TYPE_VALUES = ['Private', 'Government', 'Internship'];
export const EMPLOYMENT_TYPE_VALUES = ['full-time', 'part-time', 'contract', 'internship'];

export const FIELD_IDS = {
  jobTitle: 'employer-post-job-title',
  companyName: 'employer-post-company',
  location: 'employer-post-location',
  countryCode: 'employer-post-country',
  region: 'employer-post-region',
  city: 'employer-post-city',
  jobFamily: 'employer-post-job-family',
  specialization: 'employer-post-specialization',
  jobType: 'employer-post-job-type',
  type: 'employer-post-employment-type',
  workMode: 'employer-post-work-mode',
  experience: 'employer-post-experience',
  educationRequirement: 'employer-post-education-req',
  salaryRange: 'employer-post-salary',
  skillsRequired: 'employer-post-skills',
  jobDescription: 'employer-post-description',
  applicationDeadline: 'employer-post-deadline',
  applyLink: 'employer-post-apply-link',
  applyEmail: 'employer-post-apply-email',
  applyMethod: 'employer-post-apply-method-internal',
  openingsCount: 'employer-post-openings-count',
};

/**
 * Client-only presentation enum for the create-time application-method
 * selector (PF-HIRE-B1). Maps to the canonical server `applyType` contract
 * at submission time via buildApplyMethodPayload — it is not itself a
 * stored/server value and edit mode (PF-HIRE-B2) does not use it.
 */
export const APPLY_METHOD_VALUES = ['internal', 'external_url', 'external_email'];
export const DEFAULT_APPLY_METHOD = 'internal';

export { JOB_FAMILIES, SPECIALIZATIONS_BY_FAMILY };

const MAX_REGION = 120;
const MAX_CITY = 120;
const MAX_TITLE = 200;
const MAX_COMPANY = 200;
const MAX_LOCATION = 200;
const MAX_SALARY = 120;
const MAX_DESCRIPTION = 20000;
const MAX_SKILL_ITEM = 80;
const MAX_SKILLS = 40;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeSkills(raw) {
  if (Array.isArray(raw)) {
    return raw.map((s) => String(s).trim()).filter(Boolean).slice(0, MAX_SKILLS);
  }
  if (!raw || !String(raw).trim()) return [];
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_SKILLS)
    .map((s) => s.slice(0, MAX_SKILL_ITEM));
}

/**
 * Backend: applyType is 'external' if applyLink OR applyEmail is truthy; else 'internal'.
 * Both URL and email are stored when provided.
 */
export function resolveApplyMode({ applyLink = '', applyEmail = '' } = {}) {
  const link = String(applyLink || '').trim();
  const email = String(applyEmail || '').trim();
  const hasLink = Boolean(link);
  const hasEmail = Boolean(email);
  if (!hasLink && !hasEmail) {
    return {
      applyType: 'internal',
      hasLink: false,
      hasEmail: false,
      isExternal: false,
    };
  }
  return {
    applyType: 'external',
    hasLink,
    hasEmail,
    isExternal: true,
  };
}

/**
 * Create-mode-only validation for the explicit application-method selector
 * (PF-HIRE-B1). Authoritative for whichever destination field the selected
 * method actually requires; does not touch validateEmployerPostJobForm's
 * existing, unchanged, edit-mode-compatible optional-fields contract.
 */
export function validateApplyMethodSelection(form) {
  const method = form.applyMethod;
  if (!APPLY_METHOD_VALUES.includes(method)) {
    return { ok: false, errors: { applyMethod: 'validationApplyMethodRequired' } };
  }
  if (method === 'external_url') {
    const link = String(form.applyLink || '').trim();
    if (!link) return { ok: false, errors: { applyLink: 'validationApplyUrlRequired' } };
    if (!isValidHttpUrl(link)) return { ok: false, errors: { applyLink: 'validationApplyUrlInvalid' } };
  }
  if (method === 'external_email') {
    const email = String(form.applyEmail || '').trim();
    if (!email) return { ok: false, errors: { applyEmail: 'validationApplyEmailRequired' } };
    if (!isValidEmail(email)) return { ok: false, errors: { applyEmail: 'validationApplyEmailInvalid' } };
  }
  return { ok: true, errors: {} };
}

/**
 * Maps the selected client-only method to the canonical server payload
 * shape. Always sends explicit empty strings (never omits the key) for the
 * non-applicable destination field, so the field reaches the server as a
 * real empty value rather than being dropped by JSON serialization —
 * whatever is left in the other, now-hidden field is never included,
 * regardless of what stale text it still holds.
 */
export function buildApplyMethodPayload(form) {
  const method = form.applyMethod;
  if (method === 'external_url') {
    return { applyType: 'external', applyLink: String(form.applyLink || '').trim(), applyEmail: '' };
  }
  if (method === 'external_email') {
    return { applyType: 'external', applyLink: '', applyEmail: String(form.applyEmail || '').trim() };
  }
  return { applyType: 'internal', applyLink: '', applyEmail: '' };
}

export function isValidHttpUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return false;
  try {
    const u = new URL(raw);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isValidEmail(value) {
  const raw = String(value || '').trim();
  if (!raw) return false;
  return EMAIL_RE.test(raw) && raw.length <= 254;
}

/** Local calendar date YYYY-MM-DD must be today or future. */
export function isDeadlineNotPast(value, today = new Date()) {
  const raw = String(value || '').trim();
  if (!raw) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false;
  const [y, m, d] = raw.split('-').map(Number);
  const deadline = new Date(y, m - 1, d);
  if (Number.isNaN(deadline.getTime())) return false;
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return deadline >= startToday;
}

/**
 * @returns {{ ok: boolean, errors: Record<string, string>, applyMode: ReturnType<typeof resolveApplyMode> }}
 * Error keys are field names; values are i18n message keys under employer namespace.
 */
export function validateEmployerPostJobForm(form, { today, requireOpenings = true } = {}) {
  const errors = {};
  const title = String(form.jobTitle || '').trim();
  const company = String(form.companyName || '').trim();
  const location = String(form.location || '').trim();
  const salary = String(form.salaryRange || '').trim();
  const description = String(form.jobDescription || '').trim();
  const applyLink = String(form.applyLink || '').trim();
  const applyEmail = String(form.applyEmail || '').trim();
  const deadline = String(form.applicationDeadline || '').trim();

  if (!title) errors.jobTitle = 'validationTitleRequired';
  else if (title.length > MAX_TITLE) errors.jobTitle = 'validationTitleTooLong';

  if (!company) errors.companyName = 'validationCompanyRequired';
  else if (company.length > MAX_COMPANY) errors.companyName = 'validationCompanyTooLong';

  if (location.length > MAX_LOCATION) errors.location = 'validationLocationTooLong';

  const countryCodeRaw = String(form.countryCode || '').trim();
  if (countryCodeRaw && !normalizeCountryCode(countryCodeRaw)) {
    errors.countryCode = 'validationCountryInvalid';
  }
  const region = String(form.region || '').trim();
  const city = String(form.city || '').trim();
  if (region.length > MAX_REGION) errors.region = 'validationRegionTooLong';
  if (city.length > MAX_CITY) errors.city = 'validationCityTooLong';

  const jobFamily = String(form.jobFamily || '').trim();
  const specialization = String(form.specialization || '').trim();
  if (jobFamily && !isValidJobFamily(jobFamily)) errors.jobFamily = 'validationJobFamilyInvalid';
  if (specialization && (!jobFamily || !isValidSpecialization(jobFamily, specialization))) {
    errors.specialization = 'validationSpecializationInvalid';
  }

  if (!JOB_TYPE_VALUES.includes(form.jobType)) errors.jobType = 'validationJobTypeInvalid';
  if (!EMPLOYMENT_TYPE_VALUES.includes(form.type)) errors.type = 'validationEmploymentTypeInvalid';

  if (salary.length > MAX_SALARY) errors.salaryRange = 'validationSalaryTooLong';

  if (!description) errors.jobDescription = 'validationDescriptionRequired';
  else if (description.length < 20) errors.jobDescription = 'validationDescriptionTooShort';
  else if (description.length > MAX_DESCRIPTION) errors.jobDescription = 'validationDescriptionTooLong';

  if (deadline) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline)) errors.applicationDeadline = 'validationDeadlineInvalid';
    else if (!isDeadlineNotPast(deadline, today)) errors.applicationDeadline = 'validationDeadlinePast';
  }

  const openings = parseOpeningsCount(form.openingsCount, { required: requireOpenings });
  if (!openings.ok) errors.openingsCount = openings.code === 'OPENINGS_COUNT_REQUIRED'
    ? 'validationOpeningsRequired'
    : 'validationOpeningsInvalid';

  if (applyLink && !isValidHttpUrl(applyLink)) errors.applyLink = 'validationApplyUrlInvalid';
  if (applyEmail && !isValidEmail(applyEmail)) errors.applyEmail = 'validationApplyEmailInvalid';

  const skills = normalizeSkills(form.skillsRequired);
  if (typeof form.skillsRequired === 'string' && form.skillsRequired.trim()) {
    const parts = form.skillsRequired.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.some((p) => p.length > MAX_SKILL_ITEM)) errors.skillsRequired = 'validationSkillTooLong';
    else if (parts.length > MAX_SKILLS) errors.skillsRequired = 'validationTooManySkills';
  }

  const applyMode = resolveApplyMode({ applyLink, applyEmail });

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    applyMode,
    skills,
  };
}

/**
 * Derives the create/edit-mode application-method selection from a stored
 * Job (PF-HIRE-B2 edit hydration). `job.applyType` is already the
 * server-resolved canonical value (employerApplicationCounts.js's
 * resolveJobApplyType runs server-side before the response reaches the
 * client), so no separate client-side inference is duplicated here.
 */
export function resolveApplyMethodFromJob(job = {}) {
  if (job.applyType === 'internal') return 'internal';
  if (job.applicationLink) return 'external_url';
  if (job.applyEmail) return 'external_email';
  if (job.applyType === 'external') {
    // External with no destination on record (a pre-existing dead-end state
    // possible via other write paths) — default to the URL variant so the
    // Employer is immediately prompted for a real destination on save,
    // rather than silently reclassifying the Job as internal.
    return 'external_url';
  }
  return DEFAULT_APPLY_METHOD;
}

export function jobToForm(job = {}) {
  const deadline = job.deadline ? new Date(job.deadline).toISOString().slice(0, 10) : '';
  const legacy = !job.jobFamily && job.category ? mapLegacyCategory(job.category) : null;
  return {
    jobTitle: job.title || '',
    companyName: job.company || job.organization || '',
    location: job.location || '',
    countryCode: job.countryCode || '',
    region: job.region || job.province || '',
    city: job.city || '',
    jobFamily: job.jobFamily || legacy?.jobFamily || '',
    specialization: job.specialization || legacy?.specialization || '',
    jobType: job.jobType || 'Private',
    type: job.type || 'full-time',
    workMode: job.workMode || '',
    experience: job.experience || '',
    educationRequirement: job.educationRequirement || '',
    salaryRange: job.salaryRange || '',
    skillsRequired: Array.isArray(job.skillsRequired) ? job.skillsRequired.join(', ') : '',
    jobDescription: job.description || '',
    applicationDeadline: deadline,
    applyLink: job.applicationLink || '',
    applyEmail: job.applyEmail || '',
    applyMethod: resolveApplyMethodFromJob(job),
    openingsCount: job.openingsCount == null ? '' : String(job.openingsCount),
  };
}

/**
 * Shared by both create and edit submission (PF-HIRE-B2) — always layers
 * buildApplyMethodPayload's explicit applyType/applyLink/applyEmail over the
 * base field payload, so edit submissions get the same guarantee create
 * already had: the non-applicable destination field is always sent as a
 * real empty string, never omitted/undefined.
 */
export function buildUpdateJobPayload(form, skills) {
  return { ...buildCreateJobPayload(form, skills), ...buildApplyMethodPayload(form) };
}

export function buildCreateJobPayload(form, skills) {
  const applyLink = String(form.applyLink || '').trim();
  const applyEmail = String(form.applyEmail || '').trim();
  return {
    jobTitle: String(form.jobTitle || '').trim(),
    companyName: String(form.companyName || '').trim(),
    location: String(form.location || '').trim() || undefined,
    countryCode: normalizeCountryCode(form.countryCode) || undefined,
    region: String(form.region || '').trim() || undefined,
    province: String(form.region || '').trim() || undefined,
    city: String(form.city || '').trim() || undefined,
    jobFamily: String(form.jobFamily || '').trim() || undefined,
    specialization: String(form.specialization || '').trim() || undefined,
    jobType: form.jobType,
    type: form.type,
    workMode: form.workMode || undefined,
    experience: String(form.experience || '').trim() || undefined,
    educationRequirement: String(form.educationRequirement || '').trim() || undefined,
    salaryRange: String(form.salaryRange || '').trim() || undefined,
    skillsRequired: skills || normalizeSkills(form.skillsRequired),
    jobDescription: String(form.jobDescription || '').trim(),
    applicationDeadline: String(form.applicationDeadline || '').trim() || undefined,
    applyLink: applyLink || undefined,
    applyEmail: applyEmail || undefined,
    openingsCount: parseOpeningsCount(form.openingsCount, { required: false }).value ?? undefined,
  };
}

/** Map common server error strings to field keys when possible. */
export function mapServerErrorToFields(message = '') {
  const m = String(message).toLowerCase();
  const fields = {};
  if (m.includes('jobtitle') || m.includes('title')) fields.jobTitle = 'validationTitleRequired';
  if (m.includes('companyname') || m.includes('company')) fields.companyName = 'validationCompanyRequired';
  return fields;
}
