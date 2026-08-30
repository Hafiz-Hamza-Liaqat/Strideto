/**
 * STRIDETO JOB-AUTOFILL-P3 — real DOCX paragraph shape, admin category mapping, admin-only SEO.
 *
 * `mammoth.extractRawText` terminates every DOCX paragraph — headings, prose and list items alike —
 * with a blank line. Every earlier fixture was single-newline TXT, so blank-separated lists were
 * never exercised and only the first requirement/skill survived in production. These tests build a
 * real .docx in memory and drive it through the shipped extractor so that shape stays covered.
 *
 * Run: node src/__tests__/jobDocumentExtractP3DocxParagraphs.test.js
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
  JOB_DOCUMENT_PROTECTED_FIELDS,
} from '../../../shared/jobs/jobDocumentExtraction.js';
import {
  validateSeoTitleCandidate,
  validateMetaDescriptionCandidate,
  JOB_META_DESCRIPTION_MAX,
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

// ── STRIDETO AI Agent Engineer acceptance document ──

const DESCRIPTION_PARAGRAPHS = [
  'Smart Working Solutions is hiring an AI Agent Engineer to design, build and operate production LLM agent systems.',
  'You will own agent architecture end to end, from tool-calling design and context engineering through evaluation and observability.',
  'This is a fully remote, full-time role open to candidates based in Pakistan.',
];

const REQUIREMENTS = [
  'Proven experience building and shipping production LLM agent systems',
  'Strong backend engineering background with TypeScript and Node.js',
  'Hands-on experience designing tool-calling and function-calling interfaces',
  'Practical context engineering and prompt optimisation experience',
  'Experience with relational databases, in particular PostgreSQL',
  'Familiarity with cloud model providers such as AWS Bedrock',
  'Working knowledge of LLM observability and evaluation tooling',
  'Excellent written communication for asynchronous remote collaboration',
];

const SKILLS = [
  'LLM Agents',
  'AI Agent Architecture',
  'Tool Calling',
  'Context Engineering',
  'TypeScript',
  'Node.js',
  'PostgreSQL',
  'AWS Bedrock',
  'LLM Observability',
  'Prompt Engineering',
  'Retrieval Augmented Generation',
  'Evaluation Frameworks',
];

const SEO_SLUG = 'ai-agent-engineer-smart-working-solutions-remote-pakistan';
const SEO_TITLE = 'AI Agent Engineer at Smart Working Solutions - Remote Pakistan | STRIDETO';
const META_DESCRIPTION =
  'Apply for the AI Agent Engineer role at Smart Working Solutions. Full-time remote opportunity in Pakistan for experienced LLM-agent and backend engineers.';

const labelled = (label, value) => [{ text: `${label}:` }, { text: value }];

const ACCEPTANCE_PARAGRAPHS = [
  { text: 'STRIDETO JOB POSTING - AUTOFILL SOURCE' },
  ...labelled('Job Title', 'AI Agent Engineer'),
  ...labelled('Company / Organization', 'Smart Working Solutions'),
  ...labelled('Job Family', 'Engineering'),
  ...labelled('Job Classification', 'Private'),
  ...labelled('Employment Type', 'Full-time'),
  ...labelled('Work Mode', 'Remote'),
  ...labelled('Country', 'Pakistan'),
  ...labelled('Experience Requirement', '4+ years of professional backend or AI engineering experience'),
  ...labelled('Application Link', 'https://careers.smartworking.example.com/apply/ai-agent-engineer'),
  ...labelled('Source URL', 'https://www.strideto.com/jobs/ai-agent-engineer-smart-working'),
  ...labelled('Source Website', 'Smart Working Solutions Careers'),
  { text: 'Job Description:' },
  ...DESCRIPTION_PARAGRAPHS.map((text) => ({ text })),
  { text: 'Requirements:' },
  ...REQUIREMENTS.map((text) => ({ text, list: true })),
  { text: 'Required Skills:' },
  ...SKILLS.map((text) => ({ text, list: true })),
  { text: 'SEO Slug:' },
  { text: SEO_SLUG },
  { text: 'SEO Title:' },
  { text: SEO_TITLE },
  { text: 'Meta Description:' },
  { text: META_DESCRIPTION },
  { text: 'Urgent: No' },
  { text: 'Featured: No' },
];

const acceptanceText = (await mammoth.extractRawText({ buffer: buildDocx(ACCEPTANCE_PARAGRAPHS) })).value;

/** Mirrors parseJobDescriptionDocument's suggestion post-processing. */
function suggestionsFor(text, mode) {
  const { suggestions, meta } = extractJobFieldsFromText(text, { mode });
  const filtered = filterSuggestionsForMode(suggestions, mode);
  for (const key of JOB_DOCUMENT_PROTECTED_FIELDS) delete filtered[key];
  return { suggestions: filtered, meta };
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

const adminSuggestions = suggestionsFor(acceptanceText, 'admin').suggestions;
const employerSuggestions = suggestionsFor(acceptanceText, 'employer').suggestions;

const adminApply = applyJobDocumentSuggestions({ ...ADMIN_EMPTY_JOB }, adminSuggestions, {
  fieldMap: ADMIN_SUGGESTION_FIELD_MAP,
  formDefaults: ADMIN_FORM_DEFAULTS,
  initialForm: ADMIN_EMPTY_JOB,
  touchedFields: new Set(),
  onlyEmpty: true,
  allowUntouchedDefaults: true,
});
const adminForm = adminApply.form;

// ── DOCX SHAPE ──
{
  check(acceptanceText.includes('Requirements:\n\n'), 'P3-SHAPE-01 mammoth blank-separates paragraphs');
  check(
    acceptanceText.includes(`${REQUIREMENTS[0]}\n\n${REQUIREMENTS[1]}`),
    'P3-SHAPE-02 list items are blank-separated paragraphs'
  );
  check(!/[••]/.test(acceptanceText), 'P3-SHAPE-03 DOCX numbering emits no bullet glyph');
}

// ── A. JOB FAMILY → ADMIN CATEGORY ──
{
  check(adminSuggestions.jobFamily?.value === 'Engineering', 'P3-CAT-01 canonical jobFamily extracted');
  check(ADMIN_SUGGESTION_FIELD_MAP.jobFamily === 'category', 'P3-CAT-02 admin maps jobFamily to category');
  check(adminForm.category === 'Engineering', 'P3-CAT-03 admin category populated');
  check(adminApply.applied.includes('jobFamily'), 'P3-CAT-04 jobFamily reported applied');
}

// ── B. ALL REQUIREMENTS SURVIVE ──
{
  const got = adminSuggestions.requirements?.value;
  check(Array.isArray(got) && got.length === REQUIREMENTS.length, `P3-REQ-01 all ${REQUIREMENTS.length} requirements parsed`);
  for (const req of REQUIREMENTS) check(got.includes(req), `P3-REQ-02 requirement retained: ${req.slice(0, 40)}`);
  check(adminForm.requirements.split('\n').length === REQUIREMENTS.length, 'P3-REQ-03 all requirements reach the form');
}

// ── C. ALL REQUIRED SKILLS SURVIVE ──
{
  const got = adminSuggestions.skillsRequired?.value;
  check(Array.isArray(got) && got.length === SKILLS.length, `P3-SKL-01 all ${SKILLS.length} skills parsed`);
  for (const skill of SKILLS) check(got.includes(skill), `P3-SKL-02 skill retained: ${skill}`);
  check(adminForm.skillsRequired.split(', ').length === SKILLS.length, 'P3-SKL-03 all skills reach the form');
}

// ── D. REQUIREMENTS STOP BEFORE REQUIRED SKILLS ──
{
  const got = adminSuggestions.requirements.value;
  for (const skill of SKILLS) check(!got.includes(skill), `P3-BND-01 requirements exclude skill: ${skill}`);
  check(!got.some((r) => /^required skills:?$/i.test(r)), 'P3-BND-02 requirements exclude the skills heading');
}

// ── E. SKILLS STOP BEFORE SEO FIELDS ──
{
  const got = adminSuggestions.skillsRequired.value;
  check(!got.includes(SEO_SLUG), 'P3-BND-03 skills exclude SEO slug value');
  check(!got.includes(SEO_TITLE), 'P3-BND-04 skills exclude SEO title value');
  check(!got.some((s) => /^seo /i.test(s) || /^meta description/i.test(s)), 'P3-BND-05 skills exclude SEO headings');
  check(!got.some((s) => /^(urgent|featured):/i.test(s)), 'P3-BND-06 skills exclude trailing metadata lines');
}

// ── F. MULTI-PARAGRAPH DESCRIPTION ──
{
  const desc = adminSuggestions.description?.value || '';
  for (const para of DESCRIPTION_PARAGRAPHS) check(desc.includes(para), `P3-DSC-01 paragraph retained: ${para.slice(0, 30)}`);
  check(desc.split('\n\n').length === DESCRIPTION_PARAGRAPHS.length, 'P3-DSC-02 paragraph breaks preserved');
  check(!desc.toLowerCase().includes('requirements:'), 'P3-DSC-03 description stops before requirements');
  check(!desc.includes(REQUIREMENTS[0]), 'P3-DSC-04 description excludes requirement items');
  check(adminForm.description === desc, 'P3-DSC-05 description reaches the form intact');
}

// ── G. ADMIN SEO TITLE ──
{
  check(adminSuggestions.seoTitle?.value === SEO_TITLE, 'P3-SEO-01 admin seoTitle extracted');
  check(adminSuggestions.seoTitle?.status === CANDIDATE_STATUS.ACCEPTED, 'P3-SEO-02 seoTitle accepted');
  check(adminForm.seoTitle === SEO_TITLE, 'P3-SEO-03 seoTitle reaches the admin form');
  check(ADMIN_EXTRA_FIELDS.includes('seoTitle'), 'P3-SEO-04 seoTitle is admin-only');
}

// ── H. ADMIN META DESCRIPTION ──
{
  check(adminSuggestions.metaDescription?.value === META_DESCRIPTION, 'P3-SEO-05 admin metaDescription extracted');
  check(adminForm.metaDescription === META_DESCRIPTION, 'P3-SEO-06 metaDescription reaches the admin form');
  check(ADMIN_EXTRA_FIELDS.includes('metaDescription'), 'P3-SEO-07 metaDescription is admin-only');
  check(
    !adminSuggestions.metaDescription.value.toLowerCase().startsWith('meta description'),
    'P3-SEO-08 meta description label not leaked into value'
  );
}

// ── Meta Description must not be captured by the Description alias ──
{
  const s = suggestionsFor('Meta Description:\n\nStandalone meta text.', 'admin').suggestions;
  check(s.metaDescription?.value === 'Standalone meta text.', 'P3-SEO-09 longest alias wins for meta description');
  check(!s.description, 'P3-SEO-10 meta description is not mistaken for description');
}

// ── SEO contract semantics: over-length reviewed, never silently truncated ──
{
  const long = 'x'.repeat(JOB_META_DESCRIPTION_MAX + 50);
  const res = validateMetaDescriptionCandidate(long);
  check(res.status === CANDIDATE_STATUS.REVIEW, 'P3-SEO-11 over-length meta flagged for review');
  check(res.reason === 'truncated', 'P3-SEO-12 over-length reason surfaced');
  check(validateSeoTitleCandidate('SEO Title:').status === CANDIDATE_STATUS.REJECTED, 'P3-SEO-13 heading-only seoTitle rejected');
  check(validateSeoTitleCandidate('').status === CANDIDATE_STATUS.REJECTED, 'P3-SEO-14 empty seoTitle rejected');
}

// ── I. SEO SLUG REMAINS PROTECTED ──
{
  check(JOB_DOCUMENT_PROTECTED_FIELDS.includes('slug'), 'P3-SLG-01 slug still protected');
  check(!('slug' in adminSuggestions), 'P3-SLG-02 slug not in admin suggestions');
  check(!Object.keys(adminSuggestions).some((k) => /slug/i.test(k)), 'P3-SLG-03 no slug-shaped suggestion key');
  check(adminForm.slug === '', 'P3-SLG-04 admin form slug untouched');
  check(!ADMIN_EXTRA_FIELDS.includes('slug'), 'P3-SLG-05 slug not admin-extractable');
}

// ── J. EMPLOYER MODE RECEIVES NO SEO ──
{
  check(!('seoTitle' in employerSuggestions), 'P3-EMP-01 employer has no seoTitle');
  check(!('metaDescription' in employerSuggestions), 'P3-EMP-02 employer has no metaDescription');
  check(!('slug' in employerSuggestions), 'P3-EMP-03 employer has no slug');
  check(!('sourceUrl' in employerSuggestions), 'P3-EMP-04 employer provenance still stripped');

  const empForm = applyJobDocumentSuggestions({ ...EMPLOYER_FORM_DEFAULTS }, employerSuggestions, {
    fieldMap: EMPLOYER_SUGGESTION_FIELD_MAP,
    formDefaults: EMPLOYER_FORM_DEFAULTS,
    initialForm: EMPLOYER_FORM_DEFAULTS,
    touchedFields: new Set(),
  }).form;
  check(empForm.seoTitle === undefined, 'P3-EMP-05 employer form gains no seoTitle key');
  check(empForm.metaDescription === undefined, 'P3-EMP-06 employer form gains no metaDescription key');
  check(empForm.slug === undefined, 'P3-EMP-07 employer form gains no slug key');
  check(empForm.jobFamily === 'Engineering', 'P3-EMP-08 employer jobFamily mapping unchanged');
  check(EMPLOYER_SUGGESTION_FIELD_MAP.jobFamily === 'jobFamily', 'P3-EMP-09 employer map still targets jobFamily');
  check(empForm.skillsRequired.split(', ').length === SKILLS.length, 'P3-EMP-10 employer skills complete');
  check(empForm.requirements.split('\n').length === REQUIREMENTS.length, 'P3-EMP-11 employer requirements complete');
}

// ── K. SCALAR FIELDS STILL WORK ──
{
  check(adminForm.title === 'AI Agent Engineer', 'P3-SCL-01 title');
  check(adminForm.company === 'Smart Working Solutions', 'P3-SCL-02 company');
  check(adminForm.type === 'full-time', 'P3-SCL-03 employment type');
  check(adminForm.jobType === 'Private', 'P3-SCL-04 job type');
  check(adminForm.countryCode === 'PK', 'P3-SCL-05 country');
  check(adminForm.workMode === 'remote', 'P3-SCL-06 work mode');
  check(adminForm.experience.startsWith('4+ years'), 'P3-SCL-07 experience');
  check(
    adminForm.applicationLink === 'https://careers.smartworking.example.com/apply/ai-agent-engineer',
    'P3-SCL-08 application link'
  );
  check(adminForm.sourceUrl === 'https://www.strideto.com/jobs/ai-agent-engineer-smart-working', 'P3-SCL-09 source URL');
  check(adminForm.sourceWebsite === 'Smart Working Solutions Careers', 'P3-SCL-10 source website');
}

// ── L. UNSTATED FIELDS REMAIN BLANK ──
{
  const blanks = [
    'educationRequirement', 'salaryRange', 'salaryCurrency', 'deadline',
    'openingsCount', 'applyEmail', 'logoUrl', 'region', 'province', 'city',
  ];
  for (const key of blanks) check(adminForm[key] === '', `P3-BLK-01 ${key} stays blank`);
  check(adminForm.urgent === false, 'P3-BLK-02 urgent unchanged');
  check(adminForm.isFeatured === false, 'P3-BLK-03 featured unchanged');
  check(adminForm.status === 'draft', 'P3-BLK-04 status unchanged');
  check(adminForm.approvalStatus === 'pending', 'P3-BLK-05 approvalStatus unchanged');
}

// ── M. NO ORPHAN ADMIN FORM KEYS ──
{
  const introduced = Object.keys(adminForm).filter((k) => !(k in ADMIN_EMPTY_JOB));
  check(introduced.length === 0, `P3-ORP-01 no orphan admin keys (got: ${introduced.join(', ')})`);
  check(!('jobFamily' in adminForm), 'P3-ORP-02 no invisible jobFamily key');
  check(!('specialization' in adminForm), 'P3-ORP-03 no invisible specialization key');
  check(!('applyMethod' in adminForm), 'P3-ORP-04 no invisible applyMethod key');
  check(!ADMIN_SUGGESTION_FIELD_MAP.specialization, 'P3-ORP-05 admin map drops specialization');
}

// ── BOUNDED BLOCK PARSING ──
{
  const docx = buildDocx([
    { text: 'Requirements:' },
    { text: 'Alpha requirement', list: true },
    { text: 'Beta requirement', list: true },
    { text: 'Responsibilities:' },
    { text: 'Own the roadmap', list: true },
    { text: 'Required Skills:' },
    { text: 'Kotlin', list: true },
    { text: 'Swift', list: true },
    { text: 'Other Information:' },
    { text: 'Interviews run weekly.' },
  ]);
  const text = (await mammoth.extractRawText({ buffer: docx })).value;
  const s = suggestionsFor(text, 'admin').suggestions;
  check(s.requirements?.value?.length === 2, 'P3-BLK2-01 requirements bounded to its own section');
  check(s.responsibilities?.value?.length === 1, 'P3-BLK2-02 responsibilities bounded');
  check(s.skillsRequired?.value?.join('|') === 'Kotlin|Swift', 'P3-BLK2-03 skills bounded by unknown heading');
  check(!s.skillsRequired.value.some((v) => /interviews/i.test(v)), 'P3-BLK2-04 unknown section not absorbed');
}

// ── LONG PROSE BULLETS WITH COLONS ARE NOT TREATED AS BOUNDARIES ──
{
  const docx = buildDocx([
    { text: 'Requirements:' },
    { text: 'Deep experience across the following areas: distributed systems, streaming and storage', list: true },
    { text: 'Comfortable owning production incidents end to end', list: true },
  ]);
  const text = (await mammoth.extractRawText({ buffer: docx })).value;
  const s = suggestionsFor(text, 'admin').suggestions;
  check(s.requirements?.value?.length === 2, 'P3-BLK2-05 long colon-bearing bullet stays a list item');
}

// ── N. BOUNDARY REGRESSION: COLON-BEARING LIST ITEMS ARE NOT BOUNDARIES ──
/**
 * P3 briefly ended a block on any short `Label: value` line, which silently truncated
 * Requirements/Skills at the first legitimate `Bonus:` / `Experience:` / `Tools:` item.
 * Boundaries are now an exact recognised-label set only.
 */
async function requirementsFrom(paragraphs) {
  const text = (await mammoth.extractRawText({ buffer: buildDocx(paragraphs) })).value;
  return suggestionsFor(text, 'admin').suggestions.requirements?.value || [];
}

const listItemCases = [
  ['Bonus: Nice to have', 'P3-REG-BONUS'],
  ['Experience: 5+ years', 'P3-REG-EXPERIENCE'],
  ['Tools: LangGraph and LangChain', 'P3-REG-TOOLS'],
  [
    'Deep experience across the following areas: distributed systems, streaming and storage at scale',
    'P3-REG-LONG',
  ],
];

for (const [middle, id] of listItemCases) {
  const got = await requirementsFrom([
    { text: 'Requirements:' },
    { text: 'Alpha', list: true },
    { text: middle, list: true },
    { text: 'Beta', list: true },
  ]);
  check(got.length === 3, `${id}-01 all three items parsed (got ${got.length}: ${got.join(' | ')})`);
  check(got[0] === 'Alpha', `${id}-02 first item retained`);
  check(got[1] === middle, `${id}-03 colon-bearing item retained verbatim`);
  check(got[2] === 'Beta', `${id}-04 following item not lost`);
}

// ── O. RECOGNISED BOUNDARY-ONLY LABELS STILL TERMINATE ──
{
  const boundaryCases = [
    ['Urgent: No', 'P3-REG-URGENT'],
    ['Featured: No', 'P3-REG-FEATURED'],
    ['Sponsored: No', 'P3-REG-SPONSORED'],
    ['Status: draft', 'P3-REG-STATUS'],
    ['Approval Status: pending', 'P3-REG-APPROVAL'],
    ['SEO Slug: ai-agent-engineer-remote', 'P3-REG-SLUG-INLINE'],
    ['SEO Slug:', 'P3-REG-SLUG-HEADING'],
  ];
  for (const [boundary, id] of boundaryCases) {
    const got = await requirementsFrom([
      { text: 'Requirements:' },
      { text: 'Alpha', list: true },
      { text: 'Beta', list: true },
      { text: boundary },
    ]);
    check(got.length === 2, `${id}-01 preceding list terminated (got ${got.length}: ${got.join(' | ')})`);
    check(!got.some((v) => v.toLowerCase().startsWith(boundary.split(':')[0].toLowerCase())), `${id}-02 label not absorbed as an item`);
  }
}

// ── P. BOUNDARY LABELS NEVER BECOME EXTRACTED VALUES ──
{
  const text = (await mammoth.extractRawText({
    buffer: buildDocx([
      { text: 'Requirements:' },
      { text: 'Alpha', list: true },
      { text: 'SEO Slug: ai-agent-engineer-remote' },
      { text: 'Urgent: No' },
      { text: 'Featured: No' },
    ]),
  })).value;
  const s = suggestionsFor(text, 'admin').suggestions;
  check(!Object.keys(s).some((k) => /slug/i.test(k)), 'P3-REG-PROT-01 slug never suggested');
  check(!('urgent' in s), 'P3-REG-PROT-02 urgent never suggested');
  check(!('isFeatured' in s), 'P3-REG-PROT-03 isFeatured never suggested');
  check(!('status' in s), 'P3-REG-PROT-04 status never suggested');
  check(s.requirements?.value?.length === 1, 'P3-REG-PROT-05 requirements bounded by metadata tail');
}

// ── Q. NO SUBSEQUENT SECTION IS SILENTLY LOST ──
{
  const text = (await mammoth.extractRawText({
    buffer: buildDocx([
      { text: 'Requirements:' },
      { text: 'Alpha', list: true },
      { text: 'Bonus: Nice to have', list: true },
      { text: 'Beta', list: true },
      { text: 'Required Skills:' },
      { text: 'Experience: 5+ years', list: true },
      { text: 'Tools: LangGraph and LangChain', list: true },
      { text: 'Kotlin', list: true },
      { text: 'Urgent: No' },
    ]),
  })).value;
  const s = suggestionsFor(text, 'admin').suggestions;
  check(s.requirements?.value?.length === 3, 'P3-REG-SEQ-01 requirements keep all three items');
  check(s.skillsRequired?.value?.length === 3, 'P3-REG-SEQ-02 skills keep all three items');
  check(s.skillsRequired.value[0] === 'Experience: 5+ years', 'P3-REG-SEQ-03 leading colon item retained');
  check(s.skillsRequired.value[2] === 'Kotlin', 'P3-REG-SEQ-04 trailing item not lost');
  check(!s.requirements.value.some((v) => v === 'Experience: 5+ years'), 'P3-REG-SEQ-05 requirements stop at the skills heading');
}

// -- R. ORDERED-LIST MARKERS vs DECIMAL VALUES --
/**
 * The genuine STRIDETO document contains `1.5+ years of experience ...`. Stripping ordered-list
 * numbering without requiring whitespace after the marker rewrote that to `5+ years`, silently
 * tripling a stated hiring requirement. A marker must be followed by real whitespace.
 */
{
  const stripped = [
    ['1. Own the agent roadmap', 'Own the agent roadmap', 'P3-NUM-STRIP-1DOT'],
    ['1) Own the agent roadmap', 'Own the agent roadmap', 'P3-NUM-STRIP-1PAREN'],
    ['10. Own the agent roadmap', 'Own the agent roadmap', 'P3-NUM-STRIP-10DOT'],
  ];
  for (const [source, expected, id] of stripped) {
    const got = await requirementsFrom([
      { text: 'Requirements:' },
      { text: source, list: true },
      { text: 'Beta', list: true },
    ]);
    check(got.length === 2, `${id}-01 both items parsed`);
    check(got[0] === expected, `${id}-02 list marker stripped (got: ${got[0]})`);
  }

  const preserved = [
    ['1.5+ years of evaluation-driven development experience', 'P3-NUM-KEEP-1P5'],
    ['2.5 years of production agent experience', 'P3-NUM-KEEP-2P5'],
    ['3.14 GPA minimum for graduate applicants', 'P3-NUM-KEEP-PI'],
    ['1.25x on-call multiplier understood', 'P3-NUM-KEEP-1P25X'],
    ['10.5+ years of backend engineering proficiency', 'P3-NUM-KEEP-10P5'],
  ];
  for (const [source, id] of preserved) {
    const got = await requirementsFrom([
      { text: 'Requirements:' },
      { text: 'Alpha', list: true },
      { text: source, list: true },
      { text: 'Beta', list: true },
    ]);
    check(got.length === 3, `${id}-01 all three items parsed`);
    check(got[1] === source, `${id}-02 decimal value preserved verbatim (got: ${got[1]})`);
  }
}

// -- S. COLON-LESS STRIDETO LABELS ARE BOUNDARIES --
/**
 * The genuine authoring template writes labels bare on their own paragraph — `SEO Fields`,
 * `SEO Slug`, `Urgent` — with the value in the following paragraph. Colon-only boundary matching
 * absorbed the SEO block into Required Skills, leaking the protected slug value into content.
 */
{
  const GENUINE_SLUG = 'ai-agent-engineer-smart-working-solutions-pakistan-remote';
  const text = (await mammoth.extractRawText({
    buffer: buildDocx([
      { text: 'Required Skills' },
      { text: 'LLM Agents', list: true },
      { text: 'AI Safety and Guardrails (nice to have)', list: true },
      { text: 'SEO Fields' },
      { text: 'SEO Slug' },
      { text: GENUINE_SLUG },
      { text: 'SEO Title' },
      { text: 'AI Agent Engineer | STRIDETO' },
      { text: 'Meta Description' },
      { text: 'Apply for the AI Agent Engineer role.' },
      { text: 'Urgent' },
      { text: 'No' },
      { text: 'Featured' },
      { text: 'No' },
    ]),
  })).value;
  const s = suggestionsFor(text, 'admin').suggestions;
  const skills = s.skillsRequired?.value || [];
  check(skills.length === 2, `P3-NOCOLON-01 skills stop at the colon-less SEO heading (got ${skills.length}: ${skills.join(' | ')})`);
  check(skills[1] === 'AI Safety and Guardrails (nice to have)', 'P3-NOCOLON-02 last genuine skill retained');
  check(!skills.some((v) => /^seo/i.test(v)), 'P3-NOCOLON-03 SEO headings not absorbed as skills');
  check(!skills.includes(GENUINE_SLUG), 'P3-NOCOLON-04 protected slug value not absorbed as a skill');
  check(!Object.keys(s).some((k) => /slug/i.test(k)), 'P3-NOCOLON-05 slug still never suggested');
  check(s.seoTitle?.value === 'AI Agent Engineer | STRIDETO', 'P3-NOCOLON-06 colon-less SEO Title still imports');
  check(s.metaDescription?.value === 'Apply for the AI Agent Engineer role.', 'P3-NOCOLON-07 colon-less Meta Description still imports');
  check(!('urgent' in s) && !('isFeatured' in s), 'P3-NOCOLON-08 colon-less Urgent/Featured never suggested');

  for (const [label, id] of [['Urgent', 'P3-NOCOLON-URGENT'], ['Featured', 'P3-NOCOLON-FEATURED'], ['SEO Fields', 'P3-NOCOLON-SEOF'], ['SEO Slug', 'P3-NOCOLON-SEOS']]) {
    const got = await requirementsFrom([
      { text: 'Requirements' },
      { text: 'Alpha', list: true },
      { text: 'Beta', list: true },
      { text: label },
      { text: 'No' },
    ]);
    check(got.length === 2, `${id}-01 colon-less ${label} terminates the list (got ${got.length})`);
  }

  // A known label as a prefix of ordinary prose must NOT terminate.
  const notBoundary = await requirementsFrom([
    { text: 'Requirements' },
    { text: 'Alpha', list: true },
    { text: 'Status reporting experience in agile teams', list: true },
    { text: 'Featured work must be documented end to end', list: true },
  ]);
  check(notBoundary.length === 3, `P3-NOCOLON-09 label-prefixed prose stays a list item (got ${notBoundary.length}: ${notBoundary.join(' | ')})`);
}

// -- T. EXTERNAL JOB ID / REFERENCE ID --
{
  const text = (await mammoth.extractRawText({
    buffer: buildDocx([
      { text: 'External Job ID / Reference ID' },
      { text: 'AS311' },
      { text: 'Source Website' },
      { text: 'Smart Working Solutions Careers (Lever)' },
    ]),
  })).value;
  const adminS = suggestionsFor(text, 'admin').suggestions;
  const empS = suggestionsFor(text, 'employer').suggestions;
  check(adminS.externalId?.value === 'AS311', `P3-EXTID-01 admin externalId extracted (got: ${adminS.externalId?.value})`);
  check(adminS.sourceWebsite?.value === 'Smart Working Solutions Careers (Lever)', 'P3-EXTID-02 following label still parsed');
  check(!('externalId' in empS), 'P3-EXTID-03 employer mode still receives no externalId');
  check(ADMIN_EXTRA_FIELDS.includes('externalId'), 'P3-EXTID-04 externalId remains admin-only');

  for (const [label, id] of [['External Job ID', 'P3-EXTID-SHORT'], ['Reference ID', 'P3-EXTID-REF'], ['External ID', 'P3-EXTID-PLAIN']]) {
    const t = (await mammoth.extractRawText({ buffer: buildDocx([{ text: label }, { text: 'AS311' }]) })).value;
    check(suggestionsFor(t, 'admin').suggestions.externalId?.value === 'AS311', `${id}-01 ${label} alias resolves`);
  }
}

console.log(`jobDocumentExtractP3DocxParagraphs.test.js: ${count} assertions passed`);
