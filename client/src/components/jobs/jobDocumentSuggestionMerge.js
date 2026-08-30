/**
 * Merge job document suggestions into form state.
 * Supports EMPTY / UNTOUCHED_DEFAULT / USER_EDITED field states and dependency-aware apply.
 */

const ARRAY_FIELDS = new Set(['requirements', 'responsibilities', 'skillsRequired']);
const LINE_ARRAY_FIELDS = new Set(['requirements', 'responsibilities']);
const SKILLS_FIELD = 'skillsRequired';

const APPLY_ORDER = [
  'title',
  'company',
  'openingsCount',
  'location',
  'countryCode',
  'region',
  'city',
  'jobFamily',
  'specialization',
  'jobType',
  'type',
  'workMode',
  'salaryRange',
  'salaryCurrency',
  'experience',
  'educationRequirement',
  'description',
  'requirements',
  'responsibilities',
  'skillsRequired',
  'deadline',
  'applicationMethod',
  'applicationLink',
  'applyEmail',
  'sourceWebsite',
  'sourceUrl',
  'externalId',
  'seoTitle',
  'metaDescription',
  'logoUrl',
];

export const FIELD_STATE = Object.freeze({
  EMPTY: 'EMPTY',
  UNTOUCHED_DEFAULT: 'UNTOUCHED_DEFAULT',
  USER_EDITED: 'USER_EDITED',
});

/**
 * Suggestion application must never invent form state. A suggestion whose target key is absent
 * from the form is skipped, so admin-only and employer-only shapes each receive exactly the
 * fields they render (the admin create form has no jobFamily/specialization/applyMethod input,
 * and its whole state object is submitted verbatim as the create/update payload).
 */
function formHasKey(form, formKey) {
  return Boolean(formKey) && Object.prototype.hasOwnProperty.call(form || {}, formKey);
}

function isEmptyValue(val) {
  if (val == null) return true;
  if (typeof val === 'string') return val.trim() === '';
  if (Array.isArray(val)) return val.length === 0;
  return false;
}

function normalizeForCompare(val, field) {
  if (ARRAY_FIELDS.has(field)) {
    const arr = Array.isArray(val) ? val : String(val || '').split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
    return arr.join('\n').toLowerCase();
  }
  if (field === 'openingsCount') return String(val ?? '').trim();
  return String(val ?? '').trim().toLowerCase();
}

function valuesEqual(current, baseline, field) {
  return normalizeForCompare(current, field) === normalizeForCompare(baseline, field);
}

function arrayToFormText(val, field) {
  if (Array.isArray(val)) {
    if (field === SKILLS_FIELD) return val.join(', ');
    return val.join('\n');
  }
  return String(val || '');
}

/**
 * Resolve whether a form field is empty, still at its untouched default, or user-edited.
 */
export function resolveFieldState(formKey, current, { touchedFields, initialForm, formDefaults, field }) {
  if (touchedFields?.has?.(formKey)) return FIELD_STATE.USER_EDITED;
  if (isEmptyValue(current)) return FIELD_STATE.EMPTY;
  const baseline = initialForm?.[formKey] ?? formDefaults?.[formKey];
  if (baseline !== undefined && valuesEqual(current, baseline, field || formKey)) {
    return FIELD_STATE.UNTOUCHED_DEFAULT;
  }
  return FIELD_STATE.USER_EDITED;
}

function shouldApplyField(state, { onlyEmpty, allowUntouchedDefaults = true }) {
  if (onlyEmpty && !allowUntouchedDefaults) return state === FIELD_STATE.EMPTY;
  if (onlyEmpty) return state === FIELD_STATE.EMPTY || state === FIELD_STATE.UNTOUCHED_DEFAULT;
  return true;
}

export function buildSuggestionConflicts(form, suggestions, options = {}) {
  const {
    fieldMap = {},
    touchedFields,
    initialForm,
    formDefaults,
  } = options;

  const conflicts = [];
  for (const [field, suggestion] of Object.entries(suggestions || {})) {
    const formKey = fieldMap[field] || field;
    const current = form[formKey];
    const state = resolveFieldState(formKey, current, {
      touchedFields,
      initialForm,
      formDefaults,
      field,
    });
    if (state === FIELD_STATE.EMPTY || state === FIELD_STATE.UNTOUCHED_DEFAULT) continue;

    const suggested = suggestion?.value;
    if (normalizeForCompare(current, field) === normalizeForCompare(suggested, field)) continue;

    conflicts.push({
      field,
      formKey,
      current: ARRAY_FIELDS.has(field) ? arrayToFormText(current, field) : current,
      suggested: ARRAY_FIELDS.has(field) ? arrayToFormText(suggested, field) : suggested,
      confidence: suggestion?.confidence,
      evidence: suggestion?.evidence,
      state,
    });
  }
  return conflicts;
}

function applyScalar(next, formKey, field, suggested) {
  if (field === 'openingsCount') {
    next[formKey] = String(suggested);
    return;
  }
  if (ARRAY_FIELDS.has(field)) {
    next[formKey] = arrayToFormText(suggested, field);
    return;
  }
  next[formKey] = suggested;
}

function applyApplicationMethod(next, suggestions, fieldMap, applied) {
  const methodField = 'applicationMethod';
  const methodSuggestion = suggestions[methodField];
  const methodFormKey = fieldMap[methodField] || 'applyMethod';
  if (!methodSuggestion?.value) return;

  if (formHasKey(next, methodFormKey)) {
    next[methodFormKey] = methodSuggestion.value;
    applied.push(methodField);
  }

  const linkKey = fieldMap.applicationLink || 'applyLink';
  const emailKey = fieldMap.applyEmail || 'applyEmail';
  const setIfPresent = (key, value) => {
    if (formHasKey(next, key)) next[key] = value;
  };
  const clearOnHighConfidence =
    methodSuggestion.sourceType === 'explicit_label' || methodSuggestion.confidence === 'high';

  if (methodSuggestion.value === 'external_url') {
    if (suggestions.applicationLink?.value && formHasKey(next, linkKey)) {
      next[linkKey] = suggestions.applicationLink.value;
      applied.push('applicationLink');
    }
    if (clearOnHighConfidence) setIfPresent(emailKey, '');
  } else if (methodSuggestion.value === 'external_email') {
    if (suggestions.applyEmail?.value && formHasKey(next, emailKey)) {
      next[emailKey] = suggestions.applyEmail.value;
      applied.push('applyEmail');
    }
    if (clearOnHighConfidence) setIfPresent(linkKey, '');
  } else if (methodSuggestion.value === 'internal') {
    setIfPresent(linkKey, '');
    setIfPresent(emailKey, '');
  }
}

/**
 * Apply suggestions with dependency order: country → region → city; jobFamily → specialization.
 */
export function applyJobDocumentSuggestions(form, suggestions, options = {}) {
  const {
    fieldMap = {},
    onlyEmpty = true,
    allowUntouchedDefaults = true,
    fields = null,
    mergeArrays = false,
    touchedFields,
    initialForm,
    formDefaults,
  } = options;

  const next = { ...form };
  const applied = [];
  const skipped = [];

  const orderedFields = [
    ...APPLY_ORDER.filter((f) => suggestions?.[f]),
    ...Object.keys(suggestions || {}).filter((f) => !APPLY_ORDER.includes(f)),
  ];

  for (const field of orderedFields) {
    if (fields && !fields.includes(field)) continue;
    if (field === 'applicationMethod') continue;

    const suggestion = suggestions[field];
    const suggested = suggestion?.value;
    if (suggested == null || suggested === '') {
      skipped.push(field);
      continue;
    }
    if (suggestion?.status === 'rejected') {
      skipped.push(field);
      continue;
    }
    if (onlyEmpty && suggestion?.status === 'review') {
      skipped.push(field);
      continue;
    }

    const formKey = fieldMap[field] || field;
    if (!formHasKey(next, formKey)) {
      skipped.push(field);
      continue;
    }
    const current = next[formKey];
    const state = resolveFieldState(formKey, current, {
      touchedFields,
      initialForm,
      formDefaults,
      field,
    });

    const canApply = shouldApplyField(state, { onlyEmpty, allowUntouchedDefaults });

    if (!canApply) {
      if (!onlyEmpty && !isEmptyValue(current)) {
        if (ARRAY_FIELDS.has(field) && mergeArrays) {
          const curLines = String(current || '').split('\n').map((s) => s.trim()).filter(Boolean);
          const newLines = Array.isArray(suggested) ? suggested : [String(suggested)];
          const merged = [...curLines];
          for (const line of newLines) {
            if (!merged.some((m) => m.toLowerCase() === line.toLowerCase())) merged.push(line);
          }
          next[formKey] = LINE_ARRAY_FIELDS.has(field) ? merged.join('\n') : merged.join(', ');
          applied.push(field);
          continue;
        }
      }
      skipped.push(field);
      continue;
    }

    if (!isEmptyValue(current) && valuesEqual(current, suggested, field)) {
      skipped.push(field);
      continue;
    }

    if (field === 'countryCode') {
      next[formKey] = suggested;
      const regionKey = fieldMap.region || 'region';
      const cityKey = fieldMap.city || 'city';
      if (formHasKey(next, regionKey) && !touchedFields?.has?.(regionKey)) {
        next[regionKey] = '';
      }
      if (formHasKey(next, cityKey) && !touchedFields?.has?.(cityKey)) {
        next[cityKey] = '';
      }
      applied.push(field);
      continue;
    }

    if (field === 'jobFamily') {
      next[formKey] = suggested;
      const specKey = fieldMap.specialization || 'specialization';
      if (formHasKey(next, specKey) && !touchedFields?.has?.(specKey)) {
        next[specKey] = '';
      }
      applied.push(field);
      continue;
    }

    applyScalar(next, formKey, field, suggested);
    applied.push(field);
  }

  applyApplicationMethod(next, suggestions, fieldMap, applied);

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
  applicationMethod: 'applyMethod',
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

/**
 * Admin form field name mapping.
 * The admin create form exposes a single flat `category` input rather than the employer form's
 * jobFamily/specialization pair, so the canonical jobFamily suggestion maps to `category` here.
 */
export const ADMIN_SUGGESTION_FIELD_MAP = {
  title: 'title',
  company: 'company',
  description: 'description',
  deadline: 'deadline',
  applicationLink: 'applicationLink',
  applyEmail: 'applyEmail',
  applicationMethod: 'applyMethod',
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
  jobFamily: 'category',
  sourceWebsite: 'sourceWebsite',
  sourceUrl: 'sourceUrl',
  externalId: 'externalId',
  seoTitle: 'seoTitle',
  metaDescription: 'metaDescription',
  logoUrl: 'logoUrl',
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
  applicationMethod: 'Application method',
  applicationLink: 'Application link',
  applyEmail: 'Apply email',
  sourceWebsite: 'Source website',
  sourceUrl: 'Source URL',
  externalId: 'External ID',
  seoTitle: 'SEO title',
  metaDescription: 'Meta description',
  logoUrl: 'Logo URL',
};

/** Employer create-form defaults for untouched-default detection. */
export const EMPLOYER_FORM_DEFAULTS = {
  jobTitle: '',
  companyName: '',
  location: '',
  countryCode: '',
  region: '',
  city: '',
  jobFamily: '',
  specialization: '',
  jobType: 'Private',
  type: 'full-time',
  workMode: '',
  experience: '',
  educationRequirement: '',
  salaryRange: '',
  salaryCurrency: '',
  skillsRequired: '',
  requirements: '',
  responsibilities: '',
  jobDescription: '',
  applicationDeadline: '',
  applyLink: '',
  applyEmail: '',
  applyMethod: 'internal',
  openingsCount: '1',
};

/** Admin create-form defaults for untouched-default detection. */
export const ADMIN_FORM_DEFAULTS = {
  title: '',
  company: '',
  category: '',
  type: 'full-time',
  jobType: 'Private',
  countryCode: '',
  province: '',
  region: '',
  city: '',
  location: '',
  workMode: 'unspecified',
  salaryRange: '',
  salaryCurrency: '',
  openingsCount: '',
  experience: '',
  educationRequirement: '',
  description: '',
  requirements: '',
  responsibilities: '',
  skillsRequired: '',
  applicationLink: '',
  applyEmail: '',
  applyMethod: 'internal',
  deadline: '',
  seoTitle: '',
  metaDescription: '',
};
