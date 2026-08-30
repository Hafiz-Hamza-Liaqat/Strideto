/**
 * JOB-AUTOFILL-P2 — deterministic field contracts for job document extraction.
 * Each validator returns { status: 'accepted'|'review'|'rejected', value?, reason? }.
 */

export const CANDIDATE_STATUS = Object.freeze({
  ACCEPTED: 'accepted',
  REVIEW: 'review',
  REJECTED: 'rejected',
});

const EXPERIENCE_DURATION_RE =
  /\d+\s*(?:\+|-\s*\d+\+?)?\s*(?:years?|yrs?)\b|\d+\s*(?:years?|yrs?)\s+of\b/i;
const EXPERIENCE_LEVEL_RE =
  /\b(?:entry[\s-]?level|mid[\s-]?level|senior[\s-]?level|junior[\s-]?level|lead[\s-]?level)\b/i;
const EXPERIENCE_PROFESSIONAL_RE =
  /(?:minimum|at least|required|over|more than)\s+\d+\+?\s*(?:years?|yrs?)/i;
const EXPERIENCE_SKILL_CONTEXT_RE =
  /^experience\s+(?:with|in|using|integrating|building|developing|working|of)\b/i;

const DEGREE_RE =
  /\b(?:bachelor|master|ph\.?d|doctorate|diploma|associate|b\.?\s*s\.?|m\.?\s*s\.?|bsc|bscs|msc|mba|high\s+school|degree|qualification|graduate)\b/i;

const TITLE_REJECT_RE =
  /^(?:job\s+description|about\s+(?:the\s+)?role|overview|summary|requirements?|qualifications?|responsibilities|duties|skills?|description|position\s+description|vacancy\s+details)\s*:?\s*$/i;

const NON_APPLICATION_EMAIL_RE = /^(?:privacy|support|info|press|noreply|no-reply|admin|help)@/i;

const COMPETITIVE_SALARY_RE =
  /^(?:competitive|market\s+competitive|attractive\s+(?:package|salary)|negotiable|commensurate|based\s+on\s+experience)\b/i;

const OPENINGS_CONTEXT_RE =
  /\b(?:openings?|vacancies|vacancy|positions?\s+available|no\.?\s*of\s+openings?|number\s+of\s+(?:openings?|vacancies|positions))\b/i;

const DEADLINE_REJECT_RE =
  /\b(?:posted|published|posting\s+date|start\s+date|joining\s+date|interview\s+date|expected\s+start|asap|immediately)\b/i;

const DEADLINE_ACCEPT_RE =
  /\b(?:application\s+deadline|closing\s+date|apply\s+by|deadline|last\s+date\s+to\s+apply)\b/i;

const EXTERNAL_ID_ACCEPT_RE =
  /^(?:[A-Z]{1,4}[-_]\d+|\d{4,}|[A-Z0-9]+[-_][A-Z0-9]+)$/i;

/**
 * SEO import limits. Mirrors the CMS document-import contract in
 * `shared/cms/cmsDocumentFieldContracts.js` so both import paths share one convention.
 */
export const JOB_SEO_TITLE_MAX = 5000;
export const JOB_META_DESCRIPTION_MAX = 500;

const SEO_HEADING_ONLY_RE = /^(?:seo\s+title|meta\s+description|seo\s+slug|slug)\s*:?\s*$/i;

function result(status, value = null, reason = '') {
  return { status, value: value ?? null, reason };
}

export function validateExperienceCandidate(value, _context = {}) {
  const s = String(value || '').trim();
  if (!s) return result(CANDIDATE_STATUS.REJECTED, null, 'empty');

  if (EXPERIENCE_SKILL_CONTEXT_RE.test(s) && !EXPERIENCE_DURATION_RE.test(s) && !EXPERIENCE_LEVEL_RE.test(s)) {
    return result(CANDIDATE_STATUS.REJECTED, null, 'skill_context_not_duration');
  }

  if (/\bexperienced?\s+(?:in|with|at)\b/i.test(s) && !EXPERIENCE_DURATION_RE.test(s) && !EXPERIENCE_LEVEL_RE.test(s)) {
    return result(CANDIDATE_STATUS.REJECTED, null, 'experienced_in_not_duration');
  }

  if (EXPERIENCE_DURATION_RE.test(s) || EXPERIENCE_LEVEL_RE.test(s) || EXPERIENCE_PROFESSIONAL_RE.test(s)) {
    return result(CANDIDATE_STATUS.ACCEPTED, s);
  }

  if (/\bexperience\b/i.test(s) && !/\d/.test(s) && !EXPERIENCE_LEVEL_RE.test(s)) {
    return result(CANDIDATE_STATUS.REJECTED, null, 'no_duration_or_level');
  }

  if (!/\d/.test(s) && !EXPERIENCE_LEVEL_RE.test(s)) {
    return result(CANDIDATE_STATUS.REJECTED, null, 'not_experience_semantics');
  }

  return result(CANDIDATE_STATUS.REVIEW, s, 'ambiguous_experience');
}

export function validateTitleCandidate(value, _context = {}) {
  const s = String(value || '').trim();
  if (!s || s.length < 3 || s.length > 200) return result(CANDIDATE_STATUS.REJECTED, null, 'invalid_length');
  if (TITLE_REJECT_RE.test(s)) return result(CANDIDATE_STATUS.REJECTED, null, 'section_heading');
  if (/^job\s+description$/i.test(s)) return result(CANDIDATE_STATUS.REJECTED, null, 'section_heading');
  if (/^about\s+the\s+role$/i.test(s)) return result(CANDIDATE_STATUS.REJECTED, null, 'section_heading');
  if (/@|https?:\/\//.test(s)) return result(CANDIDATE_STATUS.REJECTED, null, 'contains_contact');
  if (/^(?:requirements?|responsibilities|skills?|description)$/i.test(s)) {
    return result(CANDIDATE_STATUS.REJECTED, null, 'section_heading');
  }
  return result(CANDIDATE_STATUS.ACCEPTED, s);
}

export function validateCompanyCandidate(value, _context = {}) {
  const s = String(value || '').trim();
  if (!s || s.length < 2) return result(CANDIDATE_STATUS.REJECTED, null, 'empty');
  if (/^about\s+us$/i.test(s)) return result(CANDIDATE_STATUS.REJECTED, null, 'section_heading');
  if (/@/.test(s) && /\.\w{2,}$/.test(s)) return result(CANDIDATE_STATUS.REJECTED, null, 'email_not_company');
  if (/^https?:\/\//i.test(s)) return result(CANDIDATE_STATUS.REJECTED, null, 'url_not_company');
  return result(CANDIDATE_STATUS.ACCEPTED, s);
}

export function validateEducationCandidate(value, _context = {}) {
  const s = String(value || '').trim();
  if (!s) return result(CANDIDATE_STATUS.REJECTED, null, 'empty');
  if (DEGREE_RE.test(s)) return result(CANDIDATE_STATUS.ACCEPTED, s);
  if (/certification/i.test(s) && !DEGREE_RE.test(s)) {
    return result(CANDIDATE_STATUS.REVIEW, s, 'certification_not_degree');
  }
  if (/^(?:react|typescript|javascript|aws|docker|git|kubernetes)\b/i.test(s)) {
    return result(CANDIDATE_STATUS.REJECTED, null, 'skill_not_education');
  }
  if (/computer\s+science|software\s+engineering|engineering|business|finance/i.test(s) && s.length <= 80) {
    return result(CANDIDATE_STATUS.REVIEW, s, 'field_without_degree_keyword');
  }
  return result(CANDIDATE_STATUS.REJECTED, null, 'not_education_semantics');
}

export function validateDeadlineCandidate(value, context = {}) {
  const s = String(value || '').trim();
  const evidence = String(context.evidence || s).trim();
  if (!s) return result(CANDIDATE_STATUS.REJECTED, null, 'empty');
  if (DEADLINE_REJECT_RE.test(evidence) && !DEADLINE_ACCEPT_RE.test(evidence)) {
    return result(CANDIDATE_STATUS.REJECTED, null, 'posted_or_start_date');
  }
  if (/^apply\s+asap$/i.test(s)) return result(CANDIDATE_STATUS.REJECTED, null, 'not_a_date');
  return result(CANDIDATE_STATUS.ACCEPTED, s);
}

export function validateOpeningsCandidate(value, context = {}) {
  const evidence = String(context.evidence || value || '').trim();
  const raw = String(value ?? '').trim();
  const n = typeof value === 'number' ? value : parseInt(raw.match(/\b(\d{1,4})\b/)?.[1] || '', 10);
  if (!Number.isFinite(n) || n < 1 || n > 10000) return result(CANDIDATE_STATUS.REJECTED, null, 'invalid_count');

  if (/\b(?:years?|yrs?|experience|offices?|employees?|engineers?|interview\s+rounds?|cities)\b/i.test(evidence)) {
    return result(CANDIDATE_STATUS.REJECTED, null, 'wrong_numeric_context');
  }
  if (!OPENINGS_CONTEXT_RE.test(evidence) && !/^\d{1,4}$/.test(raw)) {
    return result(CANDIDATE_STATUS.REVIEW, n, 'openings_context_weak');
  }
  return result(CANDIDATE_STATUS.ACCEPTED, n);
}

export function validateSalaryCandidate(value, _context = {}) {
  const s = String(value || '').trim();
  if (!s) return result(CANDIDATE_STATUS.REJECTED, null, 'empty');
  if (COMPETITIVE_SALARY_RE.test(s)) return result(CANDIDATE_STATUS.REJECTED, null, 'non_numeric_compensation');
  if (!/\d/.test(s)) return result(CANDIDATE_STATUS.REJECTED, null, 'no_amount');
  return result(CANDIDATE_STATUS.ACCEPTED, s);
}

export function validateApplicationUrlCandidate(value, _context = {}) {
  const url = String(value || '').trim().replace(/[.,;)]+$/, '');
  if (!/^https?:\/\//i.test(url)) return result(CANDIDATE_STATUS.REJECTED, null, 'invalid_scheme');
  if (/^javascript:/i.test(url) || /^data:/i.test(url) || /^file:/i.test(url)) {
    return result(CANDIDATE_STATUS.REJECTED, null, 'unsafe_scheme');
  }
  if (/localhost|127\.0\.0\.1|192\.168\.|10\.\d+\.|172\.(1[6-9]|2\d|3[01])\./i.test(url)) {
    return result(CANDIDATE_STATUS.REJECTED, null, 'private_network');
  }
  return result(CANDIDATE_STATUS.ACCEPTED, url);
}

export function validateEmailCandidate(value, context = {}) {
  const email = String(value || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return result(CANDIDATE_STATUS.REJECTED, null, 'invalid_email');
  const evidence = String(context.evidence || '').toLowerCase();
  if (/\bfor\s+questions\b/i.test(evidence)) {
    return result(CANDIDATE_STATUS.REVIEW, email, 'contact_not_apply');
  }
  if (NON_APPLICATION_EMAIL_RE.test(email) && /\b(?:privacy|press)\b/.test(evidence)) {
    return result(CANDIDATE_STATUS.REJECTED, null, 'non_application_email');
  }
  if (NON_APPLICATION_EMAIL_RE.test(email) && !/\bapply\b|\bapplication\b|\bcandidate\b|\bsubmit\b/.test(evidence)) {
    return result(CANDIDATE_STATUS.REJECTED, null, 'non_application_email');
  }
  if (/\bapply\b|\bapplication\b|\bsubmit\b|\bcv\b|\bresume\b/i.test(evidence)) {
    return result(CANDIDATE_STATUS.ACCEPTED, email);
  }
  return result(CANDIDATE_STATUS.ACCEPTED, email);
}

export function validateExternalJobIdCandidate(value, _context = {}) {
  const s = String(value || '').trim();
  if (!s || s.length > 100) return result(CANDIDATE_STATUS.REJECTED, null, 'invalid');
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s)) return result(CANDIDATE_STATUS.REJECTED, null, 'date_not_id');
  if (/^page\s+\d+$/i.test(s)) return result(CANDIDATE_STATUS.REJECTED, null, 'page_not_id');
  if (/^\d{5,7}$/.test(s) && !/[A-Za-z-]/.test(s)) return result(CANDIDATE_STATUS.REVIEW, s, 'numeric_only_id');
  if (EXTERNAL_ID_ACCEPT_RE.test(s) || /^(?:job\s+id|requisition|reference)\s*:?\s*.+/i.test(s)) {
    return result(CANDIDATE_STATUS.ACCEPTED, s);
  }
  if (/[A-Za-z].*\d|\d.*[A-Za-z]/.test(s)) return result(CANDIDATE_STATUS.ACCEPTED, s);
  return result(CANDIDATE_STATUS.REVIEW, s, 'ambiguous_id');
}

export function validateSourceWebsiteCandidate(value, _context = {}) {
  const s = String(value || '').trim();
  if (!s) return result(CANDIDATE_STATUS.REJECTED, null, 'empty');
  if (/^https?:\/\//i.test(s)) return result(CANDIDATE_STATUS.REJECTED, null, 'url_not_name');
  return result(CANDIDATE_STATUS.ACCEPTED, s);
}

export function validateSourceUrlCandidate(value, context = {}) {
  const urlResult = validateApplicationUrlCandidate(value, context);
  if (urlResult.status === CANDIDATE_STATUS.REJECTED) return urlResult;
  const evidence = String(context.evidence || '').toLowerCase();
  if (!/\bsource\b|\breference\b|\blisting\b|\boriginal\b/.test(evidence)) {
    return result(CANDIDATE_STATUS.REVIEW, urlResult.value, 'source_context_weak');
  }
  return result(CANDIDATE_STATUS.ACCEPTED, urlResult.value);
}

export function validateSkillsItemCandidate(value, _context = {}) {
  const s = String(value || '').trim();
  if (!s) return result(CANDIDATE_STATUS.REJECTED, null, 'empty');
  if (/\d+\s*(?:years?|yrs?)/i.test(s)) return result(CANDIDATE_STATUS.REJECTED, null, 'duration_not_skill');
  if (DEGREE_RE.test(s)) return result(CANDIDATE_STATUS.REJECTED, null, 'education_not_skill');
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s)) return result(CANDIDATE_STATUS.REJECTED, null, 'date_not_skill');
  return result(CANDIDATE_STATUS.ACCEPTED, s);
}

/**
 * Admin-only SEO text import. Over-length input is surfaced as `review` with a `truncated`
 * reason rather than silently trimmed, matching the CMS import contract semantics.
 */
function validateSeoTextCandidate(value, max) {
  const s = String(value || '').trim();
  if (!s) return result(CANDIDATE_STATUS.REJECTED, null, 'empty');
  if (SEO_HEADING_ONLY_RE.test(s)) return result(CANDIDATE_STATUS.REJECTED, null, 'label_leakage');
  if (/<script/i.test(s)) {
    return result(
      CANDIDATE_STATUS.REVIEW,
      s.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').trim(),
      'script_stripped'
    );
  }
  if (s.length > max) return result(CANDIDATE_STATUS.REVIEW, s.slice(0, max), 'truncated');
  return result(CANDIDATE_STATUS.ACCEPTED, s);
}

export function validateSeoTitleCandidate(value, _context = {}) {
  return validateSeoTextCandidate(value, JOB_SEO_TITLE_MAX);
}

export function validateMetaDescriptionCandidate(value, _context = {}) {
  return validateSeoTextCandidate(value, JOB_META_DESCRIPTION_MAX);
}

/** Map field name → validator fn */
export const FIELD_CONTRACT_VALIDATORS = Object.freeze({
  title: validateTitleCandidate,
  company: validateCompanyCandidate,
  experience: validateExperienceCandidate,
  educationRequirement: validateEducationCandidate,
  deadline: validateDeadlineCandidate,
  openingsCount: validateOpeningsCandidate,
  salaryRange: validateSalaryCandidate,
  applicationLink: validateApplicationUrlCandidate,
  applyEmail: validateEmailCandidate,
  externalId: validateExternalJobIdCandidate,
  sourceWebsite: validateSourceWebsiteCandidate,
  sourceUrl: validateSourceUrlCandidate,
  seoTitle: validateSeoTitleCandidate,
  metaDescription: validateMetaDescriptionCandidate,
});

export function applyFieldContract(field, value, context = {}) {
  const validator = FIELD_CONTRACT_VALIDATORS[field];
  if (!validator) return result(CANDIDATE_STATUS.ACCEPTED, value);
  return validator(value, context);
}
