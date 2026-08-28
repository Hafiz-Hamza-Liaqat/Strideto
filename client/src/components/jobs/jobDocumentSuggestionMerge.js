/**
 * Merge job document suggestions into form state.
 * Default: apply only to empty fields; conflicts surfaced for user choice.
 */

const ARRAY_FIELDS = new Set(['requirements', 'responsibilities', 'skillsRequired']);

function isEmptyValue(val) {
  if (val == null) return true;
  if (typeof val === 'string') return val.trim() === '';
  if (Array.isArray(val)) return val.length === 0;
  return false;
}

function normalizeForCompare(val, field) {
  if (ARRAY_FIELDS.has(field)) {
    const arr = Array.isArray(val) ? val : String(val || '').split('\n').map((s) => s.trim()).filter(Boolean);
    return arr.join('\n').toLowerCase();
  }
  return String(val ?? '').trim().toLowerCase();
}

function arrayToFormText(val) {
  if (Array.isArray(val)) return val.join('\n');
  return String(val || '');
}

export function buildSuggestionConflicts(form, suggestions, fieldMap = {}) {
  const conflicts = [];
  for (const [field, suggestion] of Object.entries(suggestions || {})) {
    const formKey = fieldMap[field] || field;
    const current = form[formKey];
    if (isEmptyValue(current)) continue;
    const suggested = suggestion?.value;
    if (normalizeForCompare(current, field) === normalizeForCompare(suggested, field)) continue;
    conflicts.push({
      field,
      formKey,
      current: ARRAY_FIELDS.has(field) ? arrayToFormText(current) : current,
      suggested: ARRAY_FIELDS.has(field) ? arrayToFormText(suggested) : suggested,
      confidence: suggestion?.confidence,
      evidence: suggestion?.evidence,
    });
  }
  return conflicts;
}

export function applyJobDocumentSuggestions(form, suggestions, options = {}) {
  const {
    fieldMap = {},
    onlyEmpty = true,
    fields = null,
    mergeArrays = false,
  } = options;

  const next = { ...form };
  const applied = [];
  const skipped = [];

  const entries = Object.entries(suggestions || {}).filter(([field]) => {
    if (fields && !fields.includes(field)) return false;
    return true;
  });

  for (const [field, suggestion] of entries) {
    const formKey = fieldMap[field] || field;
    const suggested = suggestion?.value;
    if (suggested == null || suggested === '') {
      skipped.push(field);
      continue;
    }

    const current = next[formKey];
    if (!onlyEmpty && !isEmptyValue(current)) {
      if (ARRAY_FIELDS.has(field) && mergeArrays) {
        const curLines = String(current || '').split('\n').map((s) => s.trim()).filter(Boolean);
        const newLines = Array.isArray(suggested) ? suggested : [String(suggested)];
        const merged = [...curLines];
        for (const line of newLines) {
          if (!merged.some((m) => m.toLowerCase() === line.toLowerCase())) merged.push(line);
        }
        next[formKey] = merged.join('\n');
        applied.push(field);
        continue;
      }
      skipped.push(field);
      continue;
    }

    if (!isEmptyValue(current) && normalizeForCompare(current, field) === normalizeForCompare(suggested, field)) {
      skipped.push(field);
      continue;
    }

    if (isEmptyValue(current) || !onlyEmpty) {
      if (ARRAY_FIELDS.has(field)) {
        next[formKey] = arrayToFormText(suggested);
      } else if (field === 'openingsCount') {
        next[formKey] = String(suggested);
      } else {
        next[formKey] = suggested;
      }
      applied.push(field);
    } else {
      skipped.push(field);
    }
  }

  return { form: next, applied, skipped };
}

/** Employer form field name mapping (API field → form state key). */
export const EMPLOYER_SUGGESTION_FIELD_MAP = {
  title: 'jobTitle',
  company: 'companyName',
  description: 'jobDescription',
  deadline: 'applicationDeadline',
  applicationLink: 'applyLink',
  applyEmail: 'applyEmail',
  skillsRequired: 'skillsRequired',
  requirements: 'requirements',
  responsibilities: 'responsibilities',
  openingsCount: 'openingsCount',
  salaryRange: 'salaryRange',
  salaryCurrency: 'salaryCurrency',
  type: 'type',
  jobType: 'jobType',
  workMode: 'workMode',
  experience: 'experience',
  educationRequirement: 'educationRequirement',
  location: 'location',
  countryCode: 'countryCode',
  region: 'region',
  city: 'city',
  jobFamily: 'jobFamily',
  specialization: 'specialization',
};

/** Admin form field name mapping. */
export const ADMIN_SUGGESTION_FIELD_MAP = {
  title: 'title',
  company: 'company',
  description: 'description',
  deadline: 'deadline',
  applicationLink: 'applicationLink',
  applyEmail: 'applyEmail',
  skillsRequired: 'skillsRequired',
  requirements: 'requirements',
  responsibilities: 'responsibilities',
  openingsCount: 'openingsCount',
  salaryRange: 'salaryRange',
  salaryCurrency: 'salaryCurrency',
  type: 'type',
  jobType: 'jobType',
  workMode: 'workMode',
  experience: 'experience',
  educationRequirement: 'educationRequirement',
  location: 'location',
  countryCode: 'countryCode',
  region: 'region',
  city: 'city',
  sourceWebsite: 'sourceWebsite',
  sourceUrl: 'sourceUrl',
  externalId: 'externalId',
};

export const SUGGESTION_FIELD_LABELS = {
  title: 'Job title',
  company: 'Company',
  location: 'Location',
  countryCode: 'Country',
  region: 'Region',
  city: 'City',
  jobFamily: 'Job family',
  specialization: 'Specialization',
  jobType: 'Sector',
  type: 'Employment type',
  workMode: 'Work mode',
  salaryRange: 'Salary range',
  salaryCurrency: 'Salary currency',
  skillsRequired: 'Skills',
  experience: 'Experience',
  educationRequirement: 'Education',
  description: 'Description',
  requirements: 'Requirements',
  responsibilities: 'Responsibilities',
  deadline: 'Deadline',
  openingsCount: 'Openings',
  applicationLink: 'Application link',
  applyEmail: 'Apply email',
  sourceWebsite: 'Source website',
  sourceUrl: 'Source URL',
  externalId: 'External ID',
};
