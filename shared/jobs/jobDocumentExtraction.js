/**
 * Strict deterministic job document field extraction.
 * Pipeline: normalize text → label/section parse → candidate precedence → validate → suggestions.
 */
import { coerceCountryCode, normalizeCountryCode } from '../international/country.js';
import { normalizeProvinceLabel } from '../constants/pakistan.js';
import {
  JOB_FAMILIES,
  SPECIALIZATIONS_BY_FAMILY,
  isValidJobFamily,
  isValidSpecialization,
} from '../career/jobTaxonomy.js';

/** Fields that document parsing must never populate or return. */
export const JOB_DOCUMENT_PROTECTED_FIELDS = [
  'jobsGraphEligible',
  'employerId',
  'postedByEmployerId',
  'postedBy',
  'approvalStatus',
  'status',
  'publicationState',
  'publishedAt',
  'launchEligible',
  'verification',
  'billing',
  'plans',
  'entitlements',
  'priority',
  'featured',
  'sponsored',
  'analytics',
  'slug',
  'seoTitle',
  'metaDescription',
  'isFeatured',
  'urgent',
  'remote',
  'hybrid',
  'benefits',
];

/** Employer-mode extractable fields (no admin provenance). */
export const EMPLOYER_EXTRACTABLE_FIELDS = [
  'title',
  'company',
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
  'skillsRequired',
  'experience',
  'educationRequirement',
  'description',
  'requirements',
  'responsibilities',
  'deadline',
  'openingsCount',
  'applicationMethod',
  'applicationLink',
  'applyEmail',
];

/** Admin-mode additionally may detect provenance when literally labeled. */
export const ADMIN_EXTRA_FIELDS = ['sourceWebsite', 'sourceUrl', 'externalId'];

export const MAX_EXTRACTED_TEXT_CHARS = 150_000;

const SOURCE_PRIORITY = {
  explicit_label: 4,
  section: 3,
  deterministic: 2,
  heuristic: 1,
};

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const URL_RE = /\bhttps?:\/\/[^\s<>"')\]]+/gi;

const BULLET_CHARS = /[\u2022\u2023\u25E6\u2043\u2219●◦▪▫]/g;

/** Canonical field → label alias phrases (matched case-insensitively). */
const LABEL_ALIASES = Object.freeze({
  title: ['job title', 'position title', 'role title', 'position', 'vacancy title', 'role'],
  openingsCount: ['number of openings', 'openings', 'positions available', 'vacancies', 'no. of openings'],
  company: ['company', 'company / organization', 'organization', 'employer', 'company/organization'],
  location: ['location', 'job location', 'work location'],
  countryCode: ['country', 'country code'],
  region: ['region', 'state', 'province', 'state / province / region', 'state/province/region'],
  city: ['city'],
  jobFamily: ['job family', 'career family'],
  specialization: ['specialization', 'specialisation'],
  jobType: ['job classification', 'classification', 'sector'],
  type: ['employment type', 'job employment type'],
  workMode: ['work mode', 'work arrangement', 'workplace type'],
  salaryRange: ['salary', 'salary range', 'compensation range', 'pay range', 'compensation'],
  salaryCurrency: ['salary currency', 'currency'],
  skillsRequired: ['required skills', 'skills', 'technical skills', 'key skills'],
  experience: ['experience', 'experience requirement', 'required experience', 'years of experience'],
  educationRequirement: ['education', 'education requirement', 'qualification', 'academic requirement'],
  requirements: ['requirements', 'qualifications', 'candidate requirements'],
  responsibilities: ['responsibilities', 'duties', 'key responsibilities', 'role responsibilities'],
  description: ['job description', 'about the role', 'role overview', 'overview', 'summary'],
  deadline: ['application deadline', 'deadline', 'closing date', 'apply by'],
  applicationMethod: ['application method', 'how to apply', 'apply method'],
  applicationLink: ['application link', 'apply link', 'application url', 'careers url', 'apply url'],
  applyEmail: ['application email', 'apply email', 'email applications'],
  sourceWebsite: ['source website', 'source'],
  sourceUrl: ['source url'],
  externalId: ['external id', 'job id', 'reference id'],
});

const SECTION_FIELDS = new Set(['requirements', 'responsibilities', 'skillsRequired', 'description']);

const LABEL_LEAKAGE_PATTERNS = [
  /^job title\s*:?\s*$/i,
  /^position title\s*:?\s*$/i,
  /^role title\s*:?\s*$/i,
  /^salary range\s*:?\s*$/i,
  /^range\s*:?\s*$/i,
  /^salary\s*:?\s*$/i,
  /^required skills\s*:?\s*$/i,
  /^number of openings\s*:?\s*$/i,
];

const JOB_FAMILY_ALIASES = Object.freeze({
  'software engineering': 'Software & IT',
  'software & it': 'Software & IT',
  'software and it': 'Software & IT',
  'information technology': 'Software & IT',
  'data science and ai': 'Data, AI & Analytics',
  'data, ai and analytics': 'Data, AI & Analytics',
});

const SPECIALIZATION_ALIASES = Object.freeze({
  'frontend development': 'Frontend',
  'front-end development': 'Frontend',
  'front end development': 'Frontend',
  'backend development': 'Backend',
  'full stack development': 'Full Stack',
  'full-stack development': 'Full Stack',
  'software development': 'Software Development',
});

function trimEvidence(text, max = 120) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function normalizeAliasKey(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Preserve semantic newlines; normalize only whitespace within lines. */
export function normalizeDocumentText(text) {
  const raw = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = raw.split('\n').map((line) => line.replace(BULLET_CHARS, '- ').replace(/[^\S\n]+/g, ' ').trimEnd());
  const paragraphs = [];
  let current = [];
  const normalizedLines = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (current.length) {
        paragraphs.push(current.join('\n'));
        current = [];
      }
      if (normalizedLines.length && normalizedLines[normalizedLines.length - 1] !== '') {
        normalizedLines.push('');
      }
      continue;
    }
    normalizedLines.push(trimmed);
    current.push(trimmed);
  }
  if (current.length) paragraphs.push(current.join('\n'));

  let collapsed = [];
  for (const line of normalizedLines) {
    if (line === '' && collapsed.length && collapsed[collapsed.length - 1] === '') continue;
    collapsed.push(line);
  }

  return { lines: collapsed, paragraphs, text: collapsed.join('\n') };
}

function isLabelOnlyLine(line) {
  const trimmed = String(line || '').trim();
  if (!trimmed.endsWith(':')) return false;
  for (const aliases of Object.values(LABEL_ALIASES)) {
    const sorted = [...aliases].sort((a, b) => b.length - a.length);
    for (const alias of sorted) {
      const re = new RegExp(`^${escapeRegExp(alias)}\\s*:?$`, 'i');
      if (re.test(trimmed)) return true;
    }
  }
  return false;
}

function isLabelLeakage(value) {
  const s = String(value || '').trim();
  if (!s) return true;
  return LABEL_LEAKAGE_PATTERNS.some((re) => re.test(s));
}

function nextNonEmptyLine(lines, startIdx) {
  for (let i = startIdx; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (line) return { line, index: i };
  }
  return null;
}

function matchLabelLine(line) {
  const trimmed = String(line || '').trim();
  if (!trimmed) return null;

  let best = null;
  for (const [field, aliases] of Object.entries(LABEL_ALIASES)) {
    const sorted = [...aliases].sort((a, b) => b.length - a.length);
    for (const alias of sorted) {
      const re = new RegExp(`^${escapeRegExp(alias)}\\s*:?\\s*(.*)$`, 'i');
      const m = trimmed.match(re);
      if (!m) continue;
      const matchLen = alias.length;
      if (!best || matchLen > best.matchLen) {
        best = {
          field,
          inlineValue: (m[1] || '').trim(),
          raw: trimmed,
          matchLen,
        };
      }
    }
  }
  if (!best) return null;
  return best;
}

function isNextSectionBoundary(line) {
  if (!line) return false;
  if (matchLabelLine(line)) return true;
  if (isLabelOnlyLine(line)) return true;
  return false;
}

function parseListBlock(lines, startIdx) {
  const items = [];
  let i = startIdx;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) {
      if (items.length) break;
      i += 1;
      continue;
    }
    if (isNextSectionBoundary(line) && items.length) break;
    if (/^[A-Z][\w\s/&-]{2,48}:$/.test(line) && items.length) break;

    let item = line.replace(/^[-•*●]\s*/, '').replace(/^\d+[.)]\s*/, '').trim();
    if (!item) {
      i += 1;
      continue;
    }

    if (items.length === 0 && item.includes(',') && !/^https?:\/\//i.test(item)) {
      const commaParts = item.split(',').map((s) => s.trim()).filter(Boolean);
      if (commaParts.length > 1 && commaParts.every((p) => p.length <= 40)) {
        items.push(...commaParts);
        i += 1;
        continue;
      }
    }

    items.push(item);
    i += 1;
  }
  return { items, nextIdx: i };
}

function parseParagraphBlock(lines, startIdx) {
  const block = [];
  let i = startIdx;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) {
      if (block.length) break;
      i += 1;
      continue;
    }
    if (isNextSectionBoundary(line) && block.length) break;
    block.push(line);
    i += 1;
  }
  return { text: block.join('\n'), nextIdx: i };
}

function parseDateValue(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const d = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T12:00:00`);
    if (!Number.isNaN(d.getTime())) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }

  const MONTH_MAP = {
    january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
    july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
  };
  const monthMatch = s.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (monthMatch) {
    const monthNum = MONTH_MAP[monthMatch[1].toLowerCase()];
    if (monthNum) {
      const day = monthMatch[2].padStart(2, '0');
      return `${monthMatch[3]}-${monthNum}-${day}`;
    }
  }

  const d = new Date(s);
  if (!Number.isNaN(d.getTime()) && d.getFullYear() >= 2000 && d.getFullYear() <= 2100) {
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  const m = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    const isoDate = `${year}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
    const parsed = new Date(`${isoDate}T12:00:00`);
    if (!Number.isNaN(parsed.getTime())) return isoDate;
  }
  return null;
}

function normalizeWorkMode(raw) {
  const s = String(raw || '').toLowerCase();
  if (/\bhybrid\b/.test(s)) return 'hybrid';
  if (/\bremote\b/.test(s)) return 'remote';
  if (/\bon[\s-]?site\b|\bin[\s-]?office\b|\boffice[\s-]?based\b/.test(s)) return 'on_site';
  return null;
}

function normalizeEmploymentType(raw) {
  const s = String(raw || '').toLowerCase();
  if (/\bfull[\s-]?time\b/.test(s)) return 'full-time';
  if (/\bpart[\s-]?time\b/.test(s)) return 'part-time';
  if (/\bcontract\b/.test(s)) return 'contract';
  if (/\bintern/.test(s)) return 'internship';
  return null;
}

function normalizeJobTypeSector(raw) {
  const s = String(raw || '').trim();
  if (/^government$/i.test(s)) return 'Government';
  if (/^private$/i.test(s)) return 'Private';
  if (/^internship$/i.test(s)) return 'Internship';
  return null;
}

function normalizeApplicationMethod(raw) {
  const s = String(raw || '').toLowerCase();
  if (/external.*(?:website|url|link)|apply.*(?:website|online)|careers?\s*(?:page|portal|website)/.test(s)) {
    return 'external_url';
  }
  if (/apply.*email|email.*application|by email/.test(s)) return 'external_email';
  if (/strideto|internal|through.*platform|on platform/.test(s)) return 'internal';
  return null;
}

function parseOpeningsFromText(raw) {
  const m = String(raw || '').match(/\b(\d{1,4})\b/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (n >= 1 && n <= 10000) return n;
  return null;
}

function parseSalaryCurrency(raw) {
  const s = String(raw || '').trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(s)) return s;
  const sym = { $: 'USD', '€': 'EUR', '£': 'GBP', '₨': 'PKR', RS: 'PKR' };
  for (const [k, v] of Object.entries(sym)) {
    if (s.includes(k)) return v;
  }
  return null;
}

function normalizeRegion(value, countryCode) {
  const region = String(value || '').trim();
  if (!region) return '';
  if (countryCode === 'PK') return normalizeProvinceLabel(region) || region;
  return region;
}

function resolveJobFamily(raw) {
  const key = normalizeAliasKey(raw);
  if (JOB_FAMILY_ALIASES[key]) return JOB_FAMILY_ALIASES[key];
  const exact = JOB_FAMILIES.find((f) => f.toLowerCase() === key);
  if (exact) return exact;
  const partial = JOB_FAMILIES.find((f) => key.includes(f.toLowerCase()) || f.toLowerCase().includes(key));
  return partial || null;
}

function resolveSpecialization(raw, family) {
  const key = normalizeAliasKey(raw);
  if (SPECIALIZATION_ALIASES[key]) {
    const aliased = SPECIALIZATION_ALIASES[key];
    if (family && isValidSpecialization(family, aliased)) return aliased;
    if (!family) return aliased;
  }
  if (family && isValidJobFamily(family)) {
    const specs = SPECIALIZATIONS_BY_FAMILY[family] || [];
    const exact = specs.find((s) => s.toLowerCase() === key);
    if (exact) return exact;
    const partial = specs.find((s) => key.includes(s.toLowerCase()) || s.toLowerCase().includes(key));
    if (partial) return partial;
  }
  return null;
}

function parseCompositeLocation(raw) {
  const text = String(raw || '').trim();
  if (!text) return { location: '' };
  const parts = text.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) return { location: text };

  const last = parts[parts.length - 1];
  const countryCode = coerceCountryCode(last);
  if (!countryCode) return { location: text };

  let city = '';
  let region = '';
  if (parts.length >= 3) {
    region = parts[parts.length - 2];
    city = parts[parts.length - 3];
  } else if (parts.length === 2) {
    city = parts[0];
  }

  return {
    location: text,
    countryCode,
    region: normalizeRegion(region, countryCode),
    city,
  };
}

function isLikelyJobTitle(line) {
  const s = String(line || '').trim();
  if (!s || s.length < 4 || s.length > 120) return false;
  if (isLabelOnlyLine(s) || matchLabelLine(s)) return false;
  if (/@|https?:\/\//.test(s)) return false;
  if (/^(requirements?|responsibilities|skills?|description|overview)\b/i.test(s)) return false;
  if (/^[A-Z][A-Z\s]{3,}$/.test(s) && s.endsWith(':')) return false;
  return true;
}

function addCandidate(store, field, candidate) {
  if (!field || JOB_DOCUMENT_PROTECTED_FIELDS.includes(field)) return;
  if (!store[field]) store[field] = [];
  store[field].push(candidate);
}

function resolveCandidates(store) {
  const resolved = {};
  for (const [field, candidates] of Object.entries(store)) {
    const sorted = [...candidates].sort((a, b) => {
      const pa = SOURCE_PRIORITY[a.sourceType] || 0;
      const pb = SOURCE_PRIORITY[b.sourceType] || 0;
      if (pb !== pa) return pb - pa;
      return (b.lineIndex ?? 0) - (a.lineIndex ?? 0);
    });
    const winner = sorted.find((c) => c.value != null && c.value !== '' && !(Array.isArray(c.value) && !c.value.length));
    if (winner && !isLabelLeakage(Array.isArray(winner.value) ? winner.value[0] : winner.value)) {
      resolved[field] = winner;
    }
  }
  return resolved;
}

function confidenceForSource(sourceType) {
  if (sourceType === 'explicit_label') return 'high';
  if (sourceType === 'section') return 'high';
  if (sourceType === 'deterministic') return 'medium';
  return 'low';
}

function suggestionFromCandidate(candidate) {
  if (!candidate || candidate.value == null || candidate.value === '') return null;
  if (Array.isArray(candidate.value) && !candidate.value.length) return null;
  if (isLabelLeakage(Array.isArray(candidate.value) ? candidate.value[0] : candidate.value)) return null;
  return {
    value: candidate.value,
    confidence: confidenceForSource(candidate.sourceType),
    evidence: trimEvidence(candidate.evidence),
    sourceType: candidate.sourceType,
  };
}

function validateAndNormalizeField(field, rawCandidate, mode) {
  const value = rawCandidate?.value;
  const base = { ...rawCandidate };

  if (value == null || value === '') return null;
  if (Array.isArray(value) && !value.length) return null;

  switch (field) {
    case 'title': {
      const title = String(value).trim();
      if (!title || isLabelLeakage(title)) return null;
      return { ...base, value: title.slice(0, 200) };
    }
    case 'company':
      return { ...base, value: String(value).trim().slice(0, 200) };
    case 'location':
      return { ...base, value: String(value).trim().slice(0, 200) };
    case 'countryCode': {
      const code = normalizeCountryCode(value) || coerceCountryCode(value);
      if (!code) return null;
      return { ...base, value: code };
    }
    case 'region': {
      const cc = rawCandidate.countryCodeHint || '';
      return { ...base, value: normalizeRegion(value, cc).slice(0, 120) };
    }
    case 'city':
      return { ...base, value: String(value).trim().slice(0, 120) };
    case 'openingsCount': {
      const n = typeof value === 'number' ? value : parseOpeningsFromText(value);
      if (n == null || n < 1 || n > 10000) return null;
      return { ...base, value: n };
    }
    case 'jobFamily': {
      const family = resolveJobFamily(value);
      if (!family || !isValidJobFamily(family)) return null;
      return { ...base, value: family };
    }
    case 'specialization': {
      const family = rawCandidate.jobFamilyHint || null;
      const spec = resolveSpecialization(value, family);
      if (!spec) return null;
      if (family && !isValidSpecialization(family, spec)) return null;
      return { ...base, value: spec };
    }
    case 'jobType': {
      const jt = normalizeJobTypeSector(value);
      return jt ? { ...base, value: jt } : null;
    }
    case 'type': {
      const et = normalizeEmploymentType(value);
      return et ? { ...base, value: et } : null;
    }
    case 'workMode': {
      const wm = normalizeWorkMode(value);
      return wm ? { ...base, value: wm } : null;
    }
    case 'salaryRange': {
      const sal = String(value).trim();
      if (!sal || isLabelLeakage(sal) || /^range\s*:?$/i.test(sal)) return null;
      if (!/\d/.test(sal)) return null;
      return { ...base, value: sal.slice(0, 120) };
    }
    case 'salaryCurrency': {
      const cur = parseSalaryCurrency(value);
      return cur ? { ...base, value: cur } : null;
    }
    case 'skillsRequired':
    case 'requirements':
    case 'responsibilities': {
      const arr = (Array.isArray(value) ? value : [String(value)])
        .map((s) => String(s).trim())
        .filter(Boolean);
      if (!arr.length) return null;
      return { ...base, value: arr };
    }
    case 'experience':
    case 'educationRequirement':
    case 'description':
      return { ...base, value: String(value).trim().slice(0, 5000) };
    case 'deadline': {
      const d = parseDateValue(value);
      return d ? { ...base, value: d } : null;
    }
    case 'applicationMethod': {
      const method = normalizeApplicationMethod(value);
      return method ? { ...base, value: method } : null;
    }
    case 'applicationLink': {
      const url = String(value).trim().replace(/[.,;)]+$/, '');
      if (!/^https?:\/\//i.test(url)) return null;
      return { ...base, value: url };
    }
    case 'applyEmail': {
      const email = String(value).trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
      return { ...base, value: email };
    }
    case 'sourceWebsite':
    case 'sourceUrl':
    case 'externalId':
      if (mode !== 'admin') return null;
      return { ...base, value: String(value).trim().slice(0, 500) };
    default:
      return null;
  }
}

function validateCanonicalSuggestions(resolved, mode) {
  const normalizedFamily = resolved.jobFamily?.value ? resolveJobFamily(resolved.jobFamily.value) : null;
  const familyHint = normalizedFamily && isValidJobFamily(normalizedFamily) ? normalizedFamily : null;
  const countryHint = resolved.countryCode?.value
    ? (normalizeCountryCode(resolved.countryCode.value) || coerceCountryCode(resolved.countryCode.value))
    : null;
  const out = {};
  const warnings = [];

  for (const [field, candidate] of Object.entries(resolved)) {
    if (mode === 'employer' && ADMIN_EXTRA_FIELDS.includes(field)) continue;
    const enriched = { ...candidate };
    if (field === 'region') enriched.countryCodeHint = countryHint;
    if (field === 'specialization') enriched.jobFamilyHint = familyHint;

    const normalized = validateAndNormalizeField(field, enriched, mode);
    if (normalized) {
      out[field] = suggestionFromCandidate(normalized);
    } else if (candidate) {
      warnings.push({ field, reason: 'validation_failed' });
    }
  }

  if (out.specialization && out.jobFamily) {
    if (!isValidSpecialization(out.jobFamily.value, out.specialization.value)) {
      delete out.specialization;
      warnings.push({ field: 'specialization', reason: 'taxonomy_conflict' });
    }
  }

  inferApplicationMethod(out, warnings);

  return { suggestions: out, warnings };
}

function inferApplicationMethod(suggestions, warnings) {
  if (suggestions.applicationMethod?.value) return;

  const hasLink = Boolean(suggestions.applicationLink?.value);
  const hasEmail = Boolean(suggestions.applyEmail?.value);

  if (hasLink && hasEmail) {
    warnings.push({ field: 'applicationMethod', reason: 'application_method_conflict' });
    return;
  }
  if (hasLink && !hasEmail) {
    suggestions.applicationMethod = {
      value: 'external_url',
      confidence: 'medium',
      evidence: suggestions.applicationLink.evidence,
      sourceType: 'deterministic',
    };
  } else if (hasEmail && !hasLink) {
    suggestions.applicationMethod = {
      value: 'external_email',
      confidence: 'medium',
      evidence: suggestions.applyEmail.evidence,
      sourceType: 'deterministic',
    };
  }
}

function extractFromLabels(lines, store, mode) {
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const match = matchLabelLine(line);
    if (!match) continue;

    const { field, inlineValue, raw } = match;
    if (mode === 'employer' && ADMIN_EXTRA_FIELDS.includes(field)) continue;

    let value = inlineValue;
    let evidence = raw;

    if (!value) {
      const next = nextNonEmptyLine(lines, i + 1);
      if (next && !matchLabelLine(next.line) && !isLabelOnlyLine(next.line)) {
        if (SECTION_FIELDS.has(field)) {
          if (field === 'description') {
            const { text, nextIdx } = parseParagraphBlock(lines, next.index);
            value = text;
            i = nextIdx - 1;
          } else {
            const { items, nextIdx } = parseListBlock(lines, next.index);
            value = items;
            i = nextIdx - 1;
          }
        } else {
          value = next.line;
          evidence = `${raw}\n${next.line}`;
        }
      }
    } else if (SECTION_FIELDS.has(field) && (!inlineValue || inlineValue.length < 3)) {
      const next = nextNonEmptyLine(lines, i + 1);
      if (next) {
        if (field === 'description') {
          const { text, nextIdx } = parseParagraphBlock(lines, next.index);
          if (text) {
            value = text;
            i = nextIdx - 1;
          }
        } else {
          const { items, nextIdx } = parseListBlock(lines, next.index);
          if (items.length) {
            value = items;
            i = nextIdx - 1;
          }
        }
      }
    }

    if (value == null || value === '') continue;
    if (typeof value === 'string' && isLabelLeakage(value)) continue;

    addCandidate(store, field, {
      value,
      sourceType: 'explicit_label',
      evidence,
      lineIndex: i,
    });
  }
}

function extractFromSections(lines, store) {
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    const match = matchLabelLine(line);
    if (!match || !SECTION_FIELDS.has(match.field)) continue;

    if (match.inlineValue) continue;

    const next = nextNonEmptyLine(lines, i + 1);
    if (!next) continue;

    if (match.field === 'description') {
      const { text, nextIdx } = parseParagraphBlock(lines, next.index);
      if (text) {
        addCandidate(store, 'description', {
          value: text,
          sourceType: 'section',
          evidence: text.split('\n')[0],
          lineIndex: i,
        });
        i = nextIdx - 1;
      }
    } else {
      const field = match.field === 'skillsRequired' ? 'skillsRequired' : match.field;
      const { items, nextIdx } = parseListBlock(lines, next.index);
      if (items.length) {
        addCandidate(store, field, {
          value: items,
          sourceType: 'section',
          evidence: items[0],
          lineIndex: i,
        });
        i = nextIdx - 1;
      }
    }
  }
}

function extractDeterministicPatterns(source, lines, store) {
  const openingsInline = source.match(/(?:number of openings?|openings?|vacancies|positions available)\s*:?\s*(\d{1,4})\b/i);
  if (openingsInline) {
    const n = parseOpeningsFromText(openingsInline[1]);
    if (n) {
      addCandidate(store, 'openingsCount', {
        value: n,
        sourceType: 'deterministic',
        evidence: openingsInline[0],
        lineIndex: source.indexOf(openingsInline[0]),
      });
    }
  }

  const hiringMatch = source.match(/\b(?:hiring|we are hiring|seeking)\s+(\d{1,3})\s+(?:people|candidates|employees|openings?)\b/i);
  if (hiringMatch) {
    const n = parseOpeningsFromText(hiringMatch[1]);
    if (n) {
      addCandidate(store, 'openingsCount', {
        value: n,
        sourceType: 'deterministic',
        evidence: hiringMatch[0],
        lineIndex: source.indexOf(hiringMatch[0]),
      });
    }
  }

  const salaryLabel = source.match(/(?:salary range|salary|compensation range)\s*:\s*([^\n]+)/i);
  if (salaryLabel) {
    const val = salaryLabel[1].trim();
    if (val && !isLabelLeakage(val) && /\d/.test(val)) {
      addCandidate(store, 'salaryRange', {
        value: val,
        sourceType: 'deterministic',
        evidence: salaryLabel[0],
        lineIndex: source.indexOf(salaryLabel[0]),
      });
    }
  }

  const salaryCurrencyLine = source.match(/(?:salary currency|currency)\s*:\s*([A-Z]{3}|PKR|USD|EUR|GBP)/i);
  if (salaryCurrencyLine) {
    const cur = parseSalaryCurrency(salaryCurrencyLine[1]);
    if (cur) {
      addCandidate(store, 'salaryCurrency', {
        value: cur,
        sourceType: 'deterministic',
        evidence: salaryCurrencyLine[0],
        lineIndex: source.indexOf(salaryCurrencyLine[0]),
      });
    }
  }

  const pkrSalary = source.match(/\b(PKR|USD|EUR|GBP|AED|SAR|CAD|AUD)\s+([\d,]+(?:\s*[-–]\s*[\d,]+)?(?:\s+per\s+\w+)?)/i);
  if (pkrSalary) {
    addCandidate(store, 'salaryCurrency', {
      value: parseSalaryCurrency(pkrSalary[1]),
      sourceType: 'deterministic',
      evidence: pkrSalary[0],
      lineIndex: source.indexOf(pkrSalary[0]),
    });
    addCandidate(store, 'salaryRange', {
      value: pkrSalary[2].trim(),
      sourceType: 'deterministic',
      evidence: pkrSalary[0],
      lineIndex: source.indexOf(pkrSalary[0]),
    });
  }

  for (let i = 0; i < lines.length; i += 1) {
    const expMatch = lines[i].match(/^(\d+\s*[-–+]\s*\d+\+?\s*years?[^.]*)$/i);
    if (expMatch) {
      addCandidate(store, 'experience', {
        value: expMatch[1],
        sourceType: 'deterministic',
        evidence: expMatch[1],
        lineIndex: i,
      });
    }
  }

  const expContext = source.match(/(?:minimum|at least|required)\s+(\d+\+?\s*years?[^.\n]{0,60})/i);
  if (expContext) {
    addCandidate(store, 'experience', {
      value: expContext[1].trim(),
      sourceType: 'deterministic',
      evidence: expContext[0],
      lineIndex: source.indexOf(expContext[0]),
    });
  }
}

function extractHeuristicCandidates(lines, store) {
  for (let i = 0; i < Math.min(lines.length, 12); i += 1) {
    const line = lines[i].trim();
    if (!isLikelyJobTitle(line)) continue;
    addCandidate(store, 'title', {
      value: line,
      sourceType: 'heuristic',
      evidence: line,
      lineIndex: i,
    });
    break;
  }

  const emails = [];
  const urls = [];
  const joined = lines.join('\n');
  let m;
  const emailRe = new RegExp(EMAIL_RE.source, EMAIL_RE.flags);
  while ((m = emailRe.exec(joined)) !== null) emails.push(m[0]);
  const urlRe = new RegExp(URL_RE.source, URL_RE.flags);
  while ((m = urlRe.exec(joined)) !== null) urls.push(m[0]);

  if (emails.length) {
    addCandidate(store, 'applyEmail', {
      value: emails[0],
      sourceType: 'heuristic',
      evidence: emails[0],
      lineIndex: joined.indexOf(emails[0]),
    });
  }
  const applyUrl = urls.find((u) => /apply|career|jobs?/i.test(u));
  if (applyUrl) {
    addCandidate(store, 'applicationLink', {
      value: applyUrl.replace(/[.,;)]+$/, ''),
      sourceType: 'heuristic',
      evidence: applyUrl,
      lineIndex: joined.indexOf(applyUrl),
    });
  }

  const cur = joined.match(/\b(USD|EUR|GBP|PKR|AED|SAR|CAD|AUD)\b/);
  if (cur) {
    addCandidate(store, 'salaryCurrency', {
      value: cur[1],
      sourceType: 'heuristic',
      evidence: cur[0],
      lineIndex: joined.indexOf(cur[0]),
    });
  }
}

function mergeLocationCandidates(resolved) {
  if (resolved.location?.value && !resolved.countryCode) {
    const parsed = parseCompositeLocation(resolved.location.value);
    if (parsed.countryCode) {
      const idx = resolved.location.lineIndex ?? 0;
      if (!resolved.countryCode) {
        resolved.countryCode = {
          value: parsed.countryCode,
          sourceType: parsed.region || parsed.city ? 'deterministic' : 'deterministic',
          evidence: resolved.location.evidence,
          lineIndex: idx,
        };
      }
      if (parsed.region && !resolved.region) {
        resolved.region = {
          value: parsed.region,
          sourceType: 'deterministic',
          evidence: resolved.location.evidence,
          lineIndex: idx,
        };
      }
      if (parsed.city && !resolved.city) {
        resolved.city = {
          value: parsed.city,
          sourceType: 'deterministic',
          evidence: resolved.location.evidence,
          lineIndex: idx,
        };
      }
    }
  }

  const cc = resolved.countryCode?.value;
  if (cc && resolved.region?.value) {
    resolved.region.value = normalizeRegion(resolved.region.value, cc);
  }
}

/**
 * Deterministic field extraction from normalized plain text.
 * @param {string} text
 * @param {{ mode: 'employer' | 'admin' }} options
 */
export function extractJobFieldsFromText(text, options = {}) {
  const mode = options.mode === 'admin' ? 'admin' : 'employer';
  const { lines, text: normalizedText } = normalizeDocumentText(text);
  const truncated = normalizedText.length > MAX_EXTRACTED_TEXT_CHARS;
  const source = truncated ? normalizedText.slice(0, MAX_EXTRACTED_TEXT_CHARS) : normalizedText;
  const workLines = truncated ? source.split('\n') : lines;

  const store = {};
  extractFromLabels(workLines, store, mode);
  extractFromSections(workLines, store);
  extractDeterministicPatterns(source, workLines, store);
  extractHeuristicCandidates(workLines, store);

  const resolved = resolveCandidates(store);
  mergeLocationCandidates(resolved);

  const { suggestions, warnings } = validateCanonicalSuggestions(resolved, mode);

  return {
    suggestions,
    meta: {
      truncated,
      charCount: source.length,
      mode,
      warnings,
    },
  };
}

export function filterSuggestionsForMode(suggestions, mode) {
  const allowed = new Set([
    ...EMPLOYER_EXTRACTABLE_FIELDS,
    ...(mode === 'admin' ? ADMIN_EXTRA_FIELDS : []),
  ]);
  const out = {};
  for (const [k, v] of Object.entries(suggestions || {})) {
    if (allowed.has(k) && !JOB_DOCUMENT_PROTECTED_FIELDS.includes(k)) out[k] = v;
  }
  return out;
}
