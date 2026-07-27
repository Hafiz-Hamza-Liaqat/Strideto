/**
 * Pure validation + apply-mode helpers for Employer Post Job (E.1F-C).
 * Mirrors server createJob contract in employerController.js.
 */

export const JOB_TYPE_VALUES = ['Private', 'Government', 'Internship'];
export const EMPLOYMENT_TYPE_VALUES = ['full-time', 'part-time', 'contract', 'internship'];

export const FIELD_IDS = {
  jobTitle: 'employer-post-job-title',
  companyName: 'employer-post-company',
  location: 'employer-post-location',
  jobType: 'employer-post-job-type',
  type: 'employer-post-employment-type',
  salaryRange: 'employer-post-salary',
  skillsRequired: 'employer-post-skills',
  jobDescription: 'employer-post-description',
  applicationDeadline: 'employer-post-deadline',
  applyLink: 'employer-post-apply-link',
  applyEmail: 'employer-post-apply-email',
};

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
export function validateEmployerPostJobForm(form, { today } = {}) {
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

export function jobToForm(job = {}) {
  const deadline = job.deadline ? new Date(job.deadline).toISOString().slice(0, 10) : '';
  return {
    jobTitle: job.title || '',
    companyName: job.company || job.organization || '',
    location: job.location || '',
    jobType: job.jobType || 'Private',
    type: job.type || 'full-time',
    salaryRange: job.salaryRange || '',
    skillsRequired: Array.isArray(job.skillsRequired) ? job.skillsRequired.join(', ') : '',
    jobDescription: job.description || '',
    applicationDeadline: deadline,
    applyLink: job.applicationLink || '',
    applyEmail: job.applyEmail || '',
  };
}

export function buildUpdateJobPayload(form, skills) {
  return buildCreateJobPayload(form, skills);
}

export function buildCreateJobPayload(form, skills) {
  const applyLink = String(form.applyLink || '').trim();
  const applyEmail = String(form.applyEmail || '').trim();
  return {
    jobTitle: String(form.jobTitle || '').trim(),
    companyName: String(form.companyName || '').trim(),
    location: String(form.location || '').trim() || undefined,
    jobType: form.jobType,
    type: form.type,
    salaryRange: String(form.salaryRange || '').trim() || undefined,
    skillsRequired: skills || normalizeSkills(form.skillsRequired),
    jobDescription: String(form.jobDescription || '').trim(),
    applicationDeadline: String(form.applicationDeadline || '').trim() || undefined,
    applyLink: applyLink || undefined,
    applyEmail: applyEmail || undefined,
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
