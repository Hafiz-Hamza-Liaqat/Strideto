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
  'applicationLink',
  'applyEmail',
];

/** Admin-mode additionally may detect provenance when literally labeled. */
export const ADMIN_EXTRA_FIELDS = ['sourceWebsite', 'sourceUrl', 'externalId'];

export const MAX_EXTRACTED_TEXT_CHARS = 150_000;

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const URL_RE = /\bhttps?:\/\/[^\s<>"')\]]+/gi;

const SECTION_HEADERS = {
  requirements: /^(?:requirements?|qualifications?|must[\s-]have|what you(?:'ll)? need)\s*:?\s*$/i,
  responsibilities: /^(?:responsibilities|duties|what you(?:'ll)? do|key responsibilities)\s*:?\s*$/i,
  description: /^(?:job description|about (?:the )?role|overview|summary)\s*:?\s*$/i,
  skills: /^(?:skills?|technical skills?|required skills?)\s*:?\s*$/i,
};

const LABELED = {
  title: /^(?:job title|position|role)\s*:\s*(.+)$/i,
  company: /^(?:company|organization|employer)\s*:\s*(.+)$/i,
  location: /^(?:location|work location)\s*:\s*(.+)$/i,
  country: /^(?:country)\s*:\s*(.+)$/i,
  region: /^(?:region|state|province)\s*:\s*(.+)$/i,
  city: /^(?:city)\s*:\s*(.+)$/i,
  salary: /^(?:salary|compensation|pay range)\s*:\s*(.+)$/i,
  currency: /^(?:salary currency|currency)\s*:\s*(.+)$/i,
  experience: /^(?:experience|years of experience)\s*:\s*(.+)$/i,
  education: /^(?:education|education requirement)\s*:\s*(.+)$/i,
  openings: /^(?:openings?|number of openings?|positions?)\s*:\s*(.+)$/i,
  deadline: /^(?:deadline|closing date|apply by|application deadline)\s*:\s*(.+)$/i,
  workMode: /^(?:work mode|work arrangement|remote)\s*:\s*(.+)$/i,
  type: /^(?:employment type|job type|type)\s*:\s*(.+)$/i,
  applyUrl: /^(?:apply (?:url|link)|application (?:url|link))\s*:\s*(.+)$/i,
  applyEmail: /^(?:apply email|application email|email)\s*:\s*(.+)$/i,
  sourceWebsite: /^(?:source website|source)\s*:\s*(.+)$/i,
  sourceUrl: /^(?:source url)\s*:\s*(.+)$/i,
  externalId: /^(?:external id|job id|reference id)\s*:\s*(.+)$/i,
};

function trimEvidence(text, max = 120) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function suggestion(value, confidence, evidence) {
  if (value == null || value === '') return null;
  if (Array.isArray(value) && !value.length) return null;
  return { value, confidence, evidence: trimEvidence(evidence) };
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
    if (/^[A-Z][\w\s/&-]{2,40}:$/.test(line) && items.length) break;
    const bullet = line.replace(/^[-•*●]\s*/, '').replace(/^\d+[.)]\s*/, '').trim();
    if (bullet) items.push(bullet);
    i += 1;
  }
  return { items, nextIdx: i };
}

function parseDateValue(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime()) && d.getFullYear() >= 2000 && d.getFullYear() <= 2100) {
    return d.toISOString().slice(0, 10);
  }
  const m = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    const iso = `${year}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
    const parsed = new Date(iso);
    if (!Number.isNaN(parsed.getTime())) return iso;
  }
  return null;
}

function normalizeWorkMode(raw) {
  const s = String(raw || '').toLowerCase();
  if (/\bremote\b/.test(s)) return 'remote';
  if (/\bhybrid\b/.test(s)) return 'hybrid';
  if (/\bon[\s-]?site\b|\bin[\s-]?office\b/.test(s)) return 'on_site';
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
  const sym = { '$': 'USD', '€': 'EUR', '£': 'GBP', '₨': 'PKR', 'Rs': 'PKR' };
  for (const [k, v] of Object.entries(sym)) {
    if (s.includes(k)) return v;
  }
  return null;
}

function firstHeaderTitle(lines) {
  for (let i = 0; i < Math.min(lines.length, 8); i += 1) {
    const line = lines[i].trim();
    if (!line || line.length < 4 || line.length > 120) continue;
    if (SECTION_HEADERS.description.test(line) || SECTION_HEADERS.requirements.test(line)) continue;
    if (/^page \d+/i.test(line)) continue;
    if (/@|https?:\/\//.test(line)) continue;
    return line;
  }
  return null;
}

/**
 * Deterministic field extraction from normalized plain text.
 * @param {string} text
 * @param {{ mode: 'employer' | 'admin' }} options
 */
export function extractJobFieldsFromText(text, options = {}) {
  const mode = options.mode === 'admin' ? 'admin' : 'employer';
  const normalized = String(text || '').replace(/\r\n/g, '\n').trim();
  const truncated = normalized.length > MAX_EXTRACTED_TEXT_CHARS;
  const source = truncated ? normalized.slice(0, MAX_EXTRACTED_TEXT_CHARS) : normalized;
  const lines = source.split('\n').map((l) => l.trimEnd());

  const suggestions = {};
  const add = (field, value, confidence, evidence) => {
    if (JOB_DOCUMENT_PROTECTED_FIELDS.includes(field)) return;
    if (mode === 'employer' && ADMIN_EXTRA_FIELDS.includes(field)) return;
    const s = suggestion(value, confidence, evidence);
    if (s) suggestions[field] = s;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    for (const [key, re] of Object.entries(LABELED)) {
      const m = trimmed.match(re);
      if (!m) continue;
      const val = m[1].trim();
      switch (key) {
        case 'title': add('title', val, 'high', trimmed); break;
        case 'company': add('company', val, 'high', trimmed); break;
        case 'location': add('location', val, 'high', trimmed); break;
        case 'country': add('countryCode', val.length <= 3 ? val.toUpperCase() : val, 'medium', trimmed); break;
        case 'region': add('region', val, 'high', trimmed); break;
        case 'city': add('city', val, 'high', trimmed); break;
        case 'salary': add('salaryRange', val, 'high', trimmed); break;
        case 'currency': {
          const c = parseSalaryCurrency(val);
          if (c) add('salaryCurrency', c, 'high', trimmed);
          break;
        }
        case 'experience': add('experience', val, 'high', trimmed); break;
        case 'education': add('educationRequirement', val, 'high', trimmed); break;
        case 'openings': {
          const n = parseOpeningsFromText(val);
          if (n) add('openingsCount', n, 'high', trimmed);
          break;
        }
        case 'deadline': {
          const d = parseDateValue(val);
          if (d) add('deadline', d, 'high', trimmed);
          break;
        }
        case 'workMode': {
          const wm = normalizeWorkMode(val);
          if (wm) add('workMode', wm, 'high', trimmed);
          break;
        }
        case 'type': {
          const et = normalizeEmploymentType(val) || normalizeJobTypeSector(val);
          if (et === 'Government' || et === 'Private') add('jobType', et, 'high', trimmed);
          else if (et) add('type', et, 'high', trimmed);
          break;
        }
        case 'applyUrl': add('applicationLink', val.replace(/[.,;)]+$/, ''), 'high', trimmed); break;
        case 'applyEmail': add('applyEmail', val, 'high', trimmed); break;
        case 'sourceWebsite':
          if (mode === 'admin') add('sourceWebsite', val, 'high', trimmed);
          break;
        case 'sourceUrl':
          if (mode === 'admin') add('sourceUrl', val.replace(/[.,;)]+$/, ''), 'high', trimmed);
          break;
        case 'externalId':
          if (mode === 'admin') add('externalId', val, 'high', trimmed);
          break;
        default:
          break;
      }
    }
  }

  // Section blocks
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (SECTION_HEADERS.requirements.test(line)) {
      const { items, nextIdx } = parseListBlock(lines, i + 1);
      if (items.length) add('requirements', items, 'high', items[0]);
      i = nextIdx - 1;
    } else if (SECTION_HEADERS.responsibilities.test(line)) {
      const { items, nextIdx } = parseListBlock(lines, i + 1);
      if (items.length) add('responsibilities', items, 'high', items[0]);
      i = nextIdx - 1;
    } else if (SECTION_HEADERS.skills.test(line)) {
      const { items, nextIdx } = parseListBlock(lines, i + 1);
      if (items.length) add('skillsRequired', items, 'high', items[0]);
      i = nextIdx - 1;
    } else if (SECTION_HEADERS.description.test(line)) {
      const descLines = [];
      for (let j = i + 1; j < lines.length; j += 1) {
        const dl = lines[j].trim();
        if (!dl && descLines.length) break;
        if (SECTION_HEADERS.requirements.test(dl) || SECTION_HEADERS.responsibilities.test(dl)) break;
        if (dl) descLines.push(dl);
      }
      if (descLines.length) add('description', descLines.join('\n'), 'medium', descLines[0]);
    }
  }

  // Unlabeled email / URL
  if (!suggestions.applyEmail) {
    const emails = source.match(EMAIL_RE);
    if (emails?.length) add('applyEmail', emails[0], 'medium', emails[0]);
  }
  if (!suggestions.applicationLink) {
    const urls = source.match(URL_RE);
    const applyUrl = urls?.find((u) => /apply|career|jobs?/i.test(u));
    if (applyUrl) add('applicationLink', applyUrl.replace(/[.,;)]+$/, ''), 'medium', applyUrl);
  }

  // Title from first meaningful line if not labeled
  if (!suggestions.title) {
    const header = firstHeaderTitle(lines);
    if (header) add('title', header, 'low', header);
  }

  // Salary inline pattern
  if (!suggestions.salaryRange) {
    const sal = source.match(/(?:salary|compensation|pay)\s*[:\-]?\s*([^\n]{5,80})/i);
    if (sal) add('salaryRange', sal[1].trim(), 'medium', sal[0]);
  }

  if (!suggestions.salaryCurrency) {
    const cur = source.match(/\b(USD|EUR|GBP|PKR|AED|SAR|CAD|AUD)\b/);
    if (cur) add('salaryCurrency', cur[1], 'medium', cur[0]);
  }

  if (!suggestions.openingsCount) {
    const op = source.match(/(?:number of openings?|openings?)\s*[:\-]?\s*(\d{1,4})\b/i);
    if (op) {
      const n = parseOpeningsFromText(op[1]);
      if (n) add('openingsCount', n, 'medium', op[0]);
    }
  }

  return {
    suggestions,
    meta: {
      truncated,
      charCount: source.length,
      mode,
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
