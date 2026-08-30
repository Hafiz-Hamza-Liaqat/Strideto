/**
 * STRIDETO JOB-AUTOFILL-P4 — bare-label Education/Deadline and admin-only Logo URL import.
 *
 * Production DOCX templates put a field label on its own paragraph with the value in the next one,
 * so mammoth flattens `Education` / `Deadline` to a bare label line with no colon. Both fields are
 * strict-colon gated against prose false positives, which silently dropped them; `Logo URL` had no
 * alias at all. These tests drive real in-memory .docx files through the shipped extractor, the
 * mode filter and the admin merge so the production shape stays covered.
 *
 * Run: node src/__tests__/jobDocumentExtractP4BareLabelsLogoUrl.test.js
 */
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import mammoth from 'mammoth';
import {
  extractJobFieldsFromText,
  filterSuggestionsForMode,
  ADMIN_EXTRA_FIELDS,
  EMPLOYER_EXTRACTABLE_FIELDS,
  JOB_DOCUMENT_PROTECTED_FIELDS,
} from '../../../shared/jobs/jobDocumentExtraction.js';
import {
  validateLogoUrlCandidate,
  CANDIDATE_STATUS,
} from '../../../shared/jobs/jobDocumentFieldContracts.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');

const merge = await import(
  pathToFileURL(path.join(repoRoot, 'client/src/components/jobs/jobDocumentSuggestionMerge.js')).href
);

const {
  applyJobDocumentSuggestions,
  ADMIN_SUGGESTION_FIELD_MAP,
  ADMIN_FORM_DEFAULTS,
  EMPLOYER_SUGGESTION_FIELD_MAP,
  EMPLOYER_FORM_DEFAULTS,
  SUGGESTION_FIELD_LABELS,
} = merge;

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

// ── minimal DOCX writer (stored/deflated zip, no third-party dependency) ──

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i += 1) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function zip(entries) {
  const local = [];
  const central = [];
  let offset = 0;
  for (const [name, text] of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const raw = Buffer.from(text, 'utf8');
    const data = deflateRawSync(raw);
    const crc = crc32(raw);

    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(8, 8);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(data.length, 18);
    lh.writeUInt32LE(raw.length, 22);
    lh.writeUInt16LE(nameBuf.length, 26);
    local.push(lh, nameBuf, data);

    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(8, 10);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(data.length, 20);
    ch.writeUInt32LE(raw.length, 24);
    ch.writeUInt16LE(nameBuf.length, 28);
    ch.writeUInt32LE(offset, 42);
    central.push(ch, nameBuf);

    offset += 30 + nameBuf.length + data.length;
  }
  const localBuf = Buffer.concat(local);
  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(localBuf.length, 16);
  return Buffer.concat([localBuf, centralBuf, end]);
}

const escapeXml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** @param {{ text: string, list?: boolean }[]} paragraphs */
function buildDocx(paragraphs) {
  const body = paragraphs
    .map(({ text, list }) => {
      const props = list
        ? '<w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>'
        : '';
      return `<w:p>${props}<w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
    })
    .join('');
  return zip([
    [
      '[Content_Types].xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        + '<Default Extension="xml" ContentType="application/xml"/>'
        + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        + '</Types>',
    ],
    [
      '_rels/.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
        + '</Relationships>',
    ],
    [
      'word/document.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        + `<w:body>${body}</w:body></w:document>`,
    ],
  ]);
}

// ── shared helpers ──

function suggestionsFor(text, mode) {
  const { suggestions, meta } = extractJobFieldsFromText(text, { mode });
  const filtered = filterSuggestionsForMode(suggestions, mode);
  for (const key of JOB_DOCUMENT_PROTECTED_FIELDS) delete filtered[key];
  return { suggestions: filtered, meta };
}

async function docxText(paragraphs) {
  return (await mammoth.extractRawText({ buffer: buildDocx(paragraphs) })).value;
}

/** Real admin create-form shape (client/src/pages/Admin/AdminContentJobs.jsx EMPTY_JOB). */
const ADMIN_EMPTY_JOB = Object.freeze({
  title: '', company: '', category: '', type: 'full-time', jobType: 'Private',
  countryCode: '', province: '', region: '', city: '', location: '',
  workMode: 'unspecified', salaryRange: '', salaryCurrency: '', openingsCount: '',
  experience: '', educationRequirement: '', gender: '', description: '',
  requirements: '', responsibilities: '', benefits: '', skillsRequired: '',
  applicationLink: '', applyEmail: '', sourceUrl: '', sourceWebsite: '', externalId: '',
  deadline: '', status: 'draft', approvalStatus: 'pending', remote: false, hybrid: false,
  urgent: false, isFeatured: false, logoUrl: '', gallery: '', slug: '',
  seoTitle: '', metaDescription: '',
});

/** Employer create-form shape. */
const EMPLOYER_EMPTY_JOB = Object.freeze({ ...EMPLOYER_FORM_DEFAULTS });

function applyAdmin(suggestions) {
  return applyJobDocumentSuggestions({ ...ADMIN_EMPTY_JOB }, suggestions, {
    fieldMap: ADMIN_SUGGESTION_FIELD_MAP,
    formDefaults: ADMIN_FORM_DEFAULTS,
    initialForm: ADMIN_EMPTY_JOB,
    touchedFields: new Set(),
    onlyEmpty: true,
    allowUntouchedDefaults: true,
  }).form;
}

const EDUCATION_VALUE =
  "Bachelor's degree in Computer Science, Software Engineering, Artificial Intelligence, or a related field";
const DEADLINE_RAW = 'September 30, 2026';
const DEADLINE_ISO = '2026-09-30';
const LOGO_URL = 'https://example.com/strideto-autofill-test-logo.png';

// ── A. EXACT PRODUCTION SHAPE: bare label paragraph, value in the next paragraph ──
{
  const text = await docxText([
    { text: 'Education' },
    { text: EDUCATION_VALUE },
    { text: 'Deadline' },
    { text: DEADLINE_RAW },
    { text: 'Logo URL' },
    { text: LOGO_URL },
  ]);

  check(text.includes('Education\n\n'), 'P4-SHAPE-01 mammoth blank-separates the bare label paragraph');

  const { suggestions } = suggestionsFor(text, 'admin');

  check(
    suggestions.educationRequirement?.value === EDUCATION_VALUE,
    `P4-EDU-01 bare Education label extracts the value (got: ${suggestions.educationRequirement?.value})`
  );
  check(
    suggestions.educationRequirement?.status === CANDIDATE_STATUS.ACCEPTED,
    'P4-EDU-02 education candidate is accepted, not review'
  );
  check(
    suggestions.deadline?.value === DEADLINE_ISO,
    `P4-DL-01 bare Deadline label normalizes to ISO (got: ${suggestions.deadline?.value})`
  );
  check(
    suggestions.deadline?.status === CANDIDATE_STATUS.ACCEPTED,
    'P4-DL-02 deadline candidate is accepted'
  );
  check(
    suggestions.logoUrl?.value === LOGO_URL,
    `P4-LOGO-01 bare Logo URL label extracts the URL (got: ${suggestions.logoUrl?.value})`
  );
  check(
    suggestions.logoUrl?.status === CANDIDATE_STATUS.ACCEPTED,
    'P4-LOGO-02 logo candidate is accepted'
  );

  const form = applyAdmin(suggestions);
  check(form.educationRequirement === EDUCATION_VALUE, 'P4-EDU-03 admin form educationRequirement populated');
  check(form.deadline === DEADLINE_ISO, 'P4-DL-03 admin form deadline populated as YYYY-MM-DD for the date input');
  check(form.logoUrl === LOGO_URL, 'P4-LOGO-03 admin form logoUrl populated');
}

// ── B. EXISTING LABEL FORMS MUST KEEP WORKING ──
{
  for (const [label, id] of [
    ['Education:', 'P4-EDU-ALIAS-COLON'],
    ['Education Requirement:', 'P4-EDU-ALIAS-REQ'],
    ['Qualification:', 'P4-EDU-ALIAS-QUAL'],
    ['Academic Requirement:', 'P4-EDU-ALIAS-ACAD'],
    ['Education Requirement', 'P4-EDU-ALIAS-REQ-BARE'],
  ]) {
    const text = await docxText([{ text: label }, { text: EDUCATION_VALUE }]);
    const { suggestions } = suggestionsFor(text, 'admin');
    check(
      suggestions.educationRequirement?.value === EDUCATION_VALUE,
      `${id}-01 "${label}" still resolves (got: ${suggestions.educationRequirement?.value})`
    );
  }

  for (const [label, id] of [
    ['Deadline:', 'P4-DL-ALIAS-COLON'],
    ['Application Deadline:', 'P4-DL-ALIAS-APP-COLON'],
    ['Application Deadline', 'P4-DL-ALIAS-APP'],
    ['Closing Date', 'P4-DL-ALIAS-CLOSING'],
    ['Apply By', 'P4-DL-ALIAS-APPLYBY'],
    ['Last Date To Apply', 'P4-DL-ALIAS-LASTDATE'],
  ]) {
    const text = await docxText([{ text: label }, { text: DEADLINE_RAW }]);
    const { suggestions } = suggestionsFor(text, 'admin');
    check(
      suggestions.deadline?.value === DEADLINE_ISO,
      `${id}-01 "${label}" still resolves to ${DEADLINE_ISO} (got: ${suggestions.deadline?.value})`
    );
  }

  // Inline `Label: value` on one paragraph is unaffected by the bare-label allowance.
  const inline = await docxText([
    { text: `Education: ${EDUCATION_VALUE}` },
    { text: `Deadline: ${DEADLINE_RAW}` },
    { text: `Logo URL: ${LOGO_URL}` },
  ]);
  const inlineS = suggestionsFor(inline, 'admin').suggestions;
  check(inlineS.educationRequirement?.value === EDUCATION_VALUE, 'P4-INLINE-01 inline Education still resolves');
  check(inlineS.deadline?.value === DEADLINE_ISO, 'P4-INLINE-02 inline Deadline still resolves');
  check(inlineS.logoUrl?.value === LOGO_URL, 'P4-INLINE-03 inline Logo URL resolves');
}

// ── C. PROSE FALSE POSITIVES STAY REJECTED (the reason the colon gate exists) ──
{
  const eduProse = await docxText([
    { text: 'About Us' },
    { text: 'Education is important to us and we sponsor continuous learning.' },
    { text: 'Education and mentoring budgets are reviewed every quarter.' },
  ]);
  const eduS = suggestionsFor(eduProse, 'admin').suggestions;
  check(
    !eduS.educationRequirement,
    `P4-NEG-EDU-01 "Education is important to us" is not a field (got: ${eduS.educationRequirement?.value})`
  );

  const dlProse = await docxText([
    { text: 'Team Culture' },
    { text: 'Deadline pressure is managed with realistic sprint planning.' },
    { text: 'Deadline discipline matters more to us than overtime.' },
  ]);
  const dlS = suggestionsFor(dlProse, 'admin').suggestions;
  check(
    !dlS.deadline,
    `P4-NEG-DL-01 "Deadline pressure is managed..." is not a field (got: ${dlS.deadline?.value})`
  );

  // A bare `Experience` line stays gated - it heads a section, it does not name a value.
  const expProse = await docxText([{ text: 'Experience' }, { text: 'Please list your previous roles below.' }]);
  check(
    !suggestionsFor(expProse, 'admin').suggestions.experience,
    'P4-NEG-EXP-01 bare Experience remains strict-colon gated'
  );

  // Posted/start-date evidence still loses to the deadline contract.
  const posted = await docxText([{ text: 'Posted' }, { text: 'August 20, 2026' }]);
  check(!suggestionsFor(posted, 'admin').suggestions.deadline, 'P4-NEG-DL-02 posted date is not a deadline');
}

// ── D. LOGO URL VALIDATION ──
{
  check(
    validateLogoUrlCandidate(LOGO_URL).status === CANDIDATE_STATUS.ACCEPTED,
    'P4-LOGOV-01 production test logo URL accepted'
  );
  check(
    validateLogoUrlCandidate('https://cdn.example.com/assets/9f2c1a4e').status === CANDIDATE_STATUS.ACCEPTED,
    'P4-LOGOV-02 extensionless CDN logo URL accepted (no image extension required)'
  );
  check(
    validateLogoUrlCandidate('http://example.com/logo.png').status === CANDIDATE_STATUS.ACCEPTED,
    'P4-LOGOV-03 plain http accepted'
  );

  for (const [bad, id] of [
    ['javascript:alert(1)', 'P4-LOGOV-JS'],
    ['data:image/png;base64,iVBORw0KGgo=', 'P4-LOGOV-DATA'],
    ['file:///C:/Windows/logo.png', 'P4-LOGOV-FILE'],
    ['ftp://example.com/logo.png', 'P4-LOGOV-FTP'],
    ['/uploads/local-logo.png', 'P4-LOGOV-RELATIVE'],
  ]) {
    check(
      validateLogoUrlCandidate(bad).status === CANDIDATE_STATUS.REJECTED,
      `${id}-01 unsafe/unsupported scheme rejected: ${bad}`
    );
  }

  for (const [priv, id] of [
    ['http://localhost:3000/logo.png', 'P4-LOGOV-LOCALHOST'],
    ['http://127.0.0.1/logo.png', 'P4-LOGOV-LOOPBACK'],
    ['http://192.168.1.10/logo.png', 'P4-LOGOV-LAN'],
  ]) {
    check(
      validateLogoUrlCandidate(priv).status === CANDIDATE_STATUS.REJECTED,
      `${id}-01 private/loopback host rejected: ${priv}`
    );
  }

  // Rejected candidates must never reach the suggestion set or the form.
  for (const [bad, id] of [['javascript:alert(1)', 'P4-LOGOD-JS'], ['file:///C:/logo.png', 'P4-LOGOD-FILE']]) {
    const text = await docxText([{ text: 'Logo URL' }, { text: bad }]);
    const { suggestions } = suggestionsFor(text, 'admin');
    check(!suggestions.logoUrl, `${id}-01 unsafe logo URL produces no suggestion (${bad})`);
    check(applyAdmin(suggestions).logoUrl === '', `${id}-02 admin form logoUrl stays empty (${bad})`);
  }

  // Alias coverage.
  for (const [label, id] of [
    ['Company Logo URL', 'P4-LOGO-ALIAS-COMPANY'],
    ['Logo Image URL', 'P4-LOGO-ALIAS-IMAGE'],
    ['Logo URL:', 'P4-LOGO-ALIAS-COLON'],
  ]) {
    const text = await docxText([{ text: label }, { text: LOGO_URL }]);
    check(
      suggestionsFor(text, 'admin').suggestions.logoUrl?.value === LOGO_URL,
      `${id}-01 "${label}" resolves to logoUrl`
    );
  }
}

// ── E. LOGO URL IS ADMIN-ONLY ──
{
  const text = await docxText([
    { text: 'Job Title' },
    { text: 'AI Agent Engineer' },
    { text: 'Logo URL' },
    { text: LOGO_URL },
  ]);
  const empS = suggestionsFor(text, 'employer').suggestions;
  check(!('logoUrl' in empS), 'P4-LOGO-EMP-01 employer mode receives no logoUrl suggestion');
  check(empS.title?.value === 'AI Agent Engineer', 'P4-LOGO-EMP-02 employer extraction otherwise unaffected');
  check(ADMIN_EXTRA_FIELDS.includes('logoUrl'), 'P4-LOGO-EMP-03 logoUrl registered as admin-only');
  check(!EMPLOYER_EXTRACTABLE_FIELDS.includes('logoUrl'), 'P4-LOGO-EMP-04 logoUrl absent from employer field list');
  check(!('logoUrl' in EMPLOYER_SUGGESTION_FIELD_MAP), 'P4-LOGO-EMP-05 employer field map has no logoUrl entry');

  const empForm = applyJobDocumentSuggestions({ ...EMPLOYER_EMPTY_JOB }, empS, {
    fieldMap: EMPLOYER_SUGGESTION_FIELD_MAP,
    formDefaults: EMPLOYER_FORM_DEFAULTS,
    initialForm: EMPLOYER_EMPTY_JOB,
    touchedFields: new Set(),
    onlyEmpty: true,
    allowUntouchedDefaults: true,
  }).form;
  check(!('logoUrl' in empForm), 'P4-LOGO-EMP-06 employer form gains no logoUrl key');

  check(ADMIN_SUGGESTION_FIELD_MAP.logoUrl === 'logoUrl', 'P4-LOGO-MAP-01 admin field map targets logoUrl');
  check(SUGGESTION_FIELD_LABELS.logoUrl === 'Logo URL', 'P4-LOGO-MAP-02 review panel has a human-readable label');
}

// ── F. SEO SLUG REMAINS PROTECTED ──
{
  const text = await docxText([
    { text: 'SEO Slug' },
    { text: 'ai-agent-engineer-smart-working-solutions' },
    { text: 'SEO Title' },
    { text: 'AI Agent Engineer at Smart Working Solutions | STRIDETO' },
    { text: 'Meta Description' },
    { text: 'Apply for the AI Agent Engineer role at Smart Working Solutions.' },
    { text: 'Education' },
    { text: EDUCATION_VALUE },
  ]);
  const { suggestions } = suggestionsFor(text, 'admin');

  check(!('slug' in suggestions), 'P4-SLUG-01 no slug suggestion is emitted');
  check(!('seoSlug' in suggestions), 'P4-SLUG-02 no seoSlug suggestion is emitted');
  check(JOB_DOCUMENT_PROTECTED_FIELDS.includes('slug'), 'P4-SLUG-03 slug stays on the protected list');
  check(!('slug' in ADMIN_SUGGESTION_FIELD_MAP), 'P4-SLUG-04 admin field map has no slug entry');
  check(
    !Object.values(suggestions).some((s) => String(s?.value || '').includes('ai-agent-engineer-smart-working-solutions')),
    'P4-SLUG-05 the slug value does not leak into any other field'
  );

  check(
    suggestions.seoTitle?.value === 'AI Agent Engineer at Smart Working Solutions | STRIDETO',
    'P4-SEO-01 SEO Title remains importable'
  );
  check(
    suggestions.metaDescription?.value === 'Apply for the AI Agent Engineer role at Smart Working Solutions.',
    'P4-SEO-02 Meta Description remains importable'
  );
  check(
    suggestions.educationRequirement?.value === EDUCATION_VALUE,
    'P4-SEO-03 the SEO Slug boundary label does not swallow the following Education field'
  );

  const form = applyAdmin(suggestions);
  check(form.slug === '', 'P4-SLUG-06 admin form slug stays empty after apply');
}

// ── G. FULL-FIELD DOCX REGRESSION ──
{
  const REQUIREMENTS = [
    'Proven experience building and shipping production LLM agent systems',
    'Strong backend engineering background with TypeScript and Node.js',
    'Hands-on experience designing tool-calling interfaces',
    'Practical context engineering and prompt optimisation experience',
    'Excellent written communication for asynchronous remote collaboration',
  ];
  const RESPONSIBILITIES = [
    'Own agent architecture end to end',
    'Design evaluation and observability for production agents',
    'Mentor engineers on context engineering practice',
  ];
  const SKILLS = ['LLM Agents', 'Tool Calling', 'TypeScript', 'Node.js', 'PostgreSQL', 'AWS Bedrock'];

  const labelled = (label, value) => [{ text: label }, { text: value }];

  const text = await docxText([
    { text: 'STRIDETO JOB POSTING - FULL FIELD AUTOFILL TEST' },
    ...labelled('Job Title', 'AI Agent Engineer'),
    ...labelled('Company / Organization', 'Smart Working Solutions'),
    ...labelled('Job Family', 'Software Engineering'),
    ...labelled('Job Classification', 'Government'),
    ...labelled('Employment Type', 'Contract'),
    ...labelled('Work Mode', 'Remote'),
    ...labelled('Location', 'Lahore, Punjab, Pakistan'),
    ...labelled('Salary', 'PKR 400,000 - 600,000 per month'),
    ...labelled('Salary Currency', 'PKR'),
    ...labelled('Experience Requirement', '4+ years of professional backend engineering experience'),
    ...labelled('Number of Openings', '3'),
    ...labelled('Education', EDUCATION_VALUE),
    ...labelled('Deadline', DEADLINE_RAW),
    ...labelled('Logo URL', LOGO_URL),
    ...labelled('Application Email', 'apply@smartworking.example.com'),
    ...labelled('Application Link', 'https://careers.smartworking.example.com/apply/ai-agent-engineer'),
    ...labelled('Source URL', 'https://www.strideto.com/jobs/ai-agent-engineer-smart-working'),
    ...labelled('Source Website', 'Smart Working Solutions Careers'),
    ...labelled('External Job ID', 'SWS-2026-014'),
    { text: 'Job Description:' },
    { text: 'Smart Working Solutions is hiring an AI Agent Engineer to build production LLM agent systems.' },
    { text: 'Requirements:' },
    ...REQUIREMENTS.map((t) => ({ text: t, list: true })),
    { text: 'Responsibilities:' },
    ...RESPONSIBILITIES.map((t) => ({ text: t, list: true })),
    { text: 'Required Skills:' },
    ...SKILLS.map((t) => ({ text: t, list: true })),
    { text: 'SEO Title:' },
    { text: 'AI Agent Engineer at Smart Working Solutions | STRIDETO' },
    { text: 'Meta Description:' },
    { text: 'Apply for the AI Agent Engineer role at Smart Working Solutions.' },
    { text: 'SEO Slug:' },
    { text: 'ai-agent-engineer-smart-working-solutions' },
    { text: 'Urgent: No' },
  ]);

  const { suggestions } = suggestionsFor(text, 'admin');
  const form = applyAdmin(suggestions);

  // The three fixed fields populate together.
  check(form.educationRequirement === EDUCATION_VALUE, 'P4-FULL-EDU-01 Education populated in full-field run');
  check(form.deadline === DEADLINE_ISO, 'P4-FULL-DL-01 Deadline populated in full-field run');
  check(form.logoUrl === LOGO_URL, 'P4-FULL-LOGO-01 Logo URL populated in full-field run');

  // No regression across every other supported admin field.
  const expected = {
    title: 'AI Agent Engineer',
    company: 'Smart Working Solutions',
    category: 'Software & IT',
    type: 'contract',
    jobType: 'Government',
    countryCode: 'PK',
    region: 'Punjab',
    city: 'Lahore',
    location: 'Lahore, Punjab, Pakistan',
    workMode: 'remote',
    salaryRange: 'PKR 400,000 - 600,000 per month',
    salaryCurrency: 'PKR',
    openingsCount: '3',
    experience: '4+ years of professional backend engineering experience',
    applicationLink: 'https://careers.smartworking.example.com/apply/ai-agent-engineer',
    applyEmail: 'apply@smartworking.example.com',
    sourceUrl: 'https://www.strideto.com/jobs/ai-agent-engineer-smart-working',
    sourceWebsite: 'Smart Working Solutions Careers',
    externalId: 'SWS-2026-014',
    seoTitle: 'AI Agent Engineer at Smart Working Solutions | STRIDETO',
    metaDescription: 'Apply for the AI Agent Engineer role at Smart Working Solutions.',
  };
  for (const [key, value] of Object.entries(expected)) {
    check(form[key] === value, `P4-FULL-${key} populated (expected "${value}", got "${form[key]}")`);
  }

  check(
    form.description === 'Smart Working Solutions is hiring an AI Agent Engineer to build production LLM agent systems.',
    `P4-FULL-description populated (got "${form.description}")`
  );

  const reqLines = form.requirements.split('\n').filter(Boolean);
  const respLines = form.responsibilities.split('\n').filter(Boolean);
  const skillItems = form.skillsRequired.split(',').map((s) => s.trim()).filter(Boolean);
  check(
    reqLines.length === REQUIREMENTS.length,
    `P4-FULL-req-count ${REQUIREMENTS.length} requirements survive (got ${reqLines.length}: ${reqLines.join(' | ')})`
  );
  check(
    respLines.length === RESPONSIBILITIES.length,
    `P4-FULL-resp-count ${RESPONSIBILITIES.length} responsibilities survive (got ${respLines.length}: ${respLines.join(' | ')})`
  );
  check(
    skillItems.length === SKILLS.length,
    `P4-FULL-skills-count ${SKILLS.length} skills survive (got ${skillItems.length}: ${skillItems.join(' | ')})`
  );

  // Protected fields are untouched by the full-field apply.
  check(form.slug === '', 'P4-FULL-PROT-01 slug stays empty');
  check(form.urgent === false, 'P4-FULL-PROT-02 urgent stays false');
  check(form.isFeatured === false, 'P4-FULL-PROT-03 isFeatured stays false');
  check(form.status === 'draft', 'P4-FULL-PROT-04 status stays draft');
  check(form.approvalStatus === 'pending', 'P4-FULL-PROT-05 approvalStatus stays pending');
  check(form.benefits === '', 'P4-FULL-PROT-06 benefits stays empty');
}

console.log(`jobDocumentExtractP4BareLabelsLogoUrl.test.js: ${count} assertions passed`);
