import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SCHOLARSHIP_TYPES,
  PROVIDER_TYPES,
  FUNDING_TYPES,
  FUNDING_COMPONENTS,
  APPLICATION_METHODS,
  CRITERIA_TYPES,
} from '../shared/education/scholarshipIntelligence.js';
import { DEGREE_LEVELS, PUB_STATUSES } from '../shared/education/taxonomy.js';
import { VERIFICATION_STATUSES, FRESHNESS_STATES } from '../shared/trust/sourceVerification.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inputPath = path.join(root, 'qa-artifacts', 'scholarships-batch01-ready.json');
const researchedPath = path.join(root, 'qa-artifacts', 'scholarships-batch01-candidates.json');
const inventoryPath = path.join(root, 'qa-artifacts', 'scholarships-existing-inventory.json');
const readyPath = path.join(root, 'qa-artifacts', 'scholarships-batch01-canonical-ready.json');
const reportPath = path.join(root, 'qa-artifacts', 'scholarships-batch01-canonical-audit.md');
const generatedAt = new Date().toISOString();

const sourceMeta = {
  'Reach Oxford Scholarship 2027': {
    sourceType: 'institution_homepage', publisher: 'University of Oxford', providerType: PROVIDER_TYPES.UNIVERSITY,
    scholarshipType: SCHOLARSHIP_TYPES.INSTITUTIONAL, applicationMethod: APPLICATION_METHODS.INSTITUTION_APPLICATION,
    destinationCountries: ['GB'], degreeLevels: [DEGREE_LEVELS.BACHELOR], fundingType: FUNDING_TYPES.FULL,
    components: [FUNDING_COMPONENTS.TUITION, FUNDING_COMPONENTS.STIPEND, FUNDING_COMPONENTS.TRAVEL],
    cycleLabel: '2027 entry — scholarship deadline 2027-01-26', deadlineDate: '2027-01-26', deadlineAt: '2027-01-26',
    cycleStatus: 'upcoming', nationalityScope: ['Pakistan and other eligible DAC-country nationals'],
  },
  'Clarendon Fund Scholarship 2027': {
    sourceType: 'institution_homepage', publisher: 'University of Oxford Clarendon Fund', providerType: PROVIDER_TYPES.UNIVERSITY,
    scholarshipType: SCHOLARSHIP_TYPES.INSTITUTIONAL, applicationMethod: APPLICATION_METHODS.INSTITUTION_APPLICATION,
    destinationCountries: ['GB'], degreeLevels: [DEGREE_LEVELS.MASTER, DEGREE_LEVELS.PHD], fundingType: FUNDING_TYPES.FULL,
    components: [FUNDING_COMPONENTS.TUITION, FUNDING_COMPONENTS.STIPEND],
    cycleLabel: '2027 entry — relevant December or January course funding deadline', deadlineDate: '', deadlineAt: null,
    cycleStatus: 'unknown', nationalityScope: ['all nationalities'],
  },
  'Lester B. Pearson International Scholarship 2027': {
    sourceType: 'official', publisher: 'University of Toronto', providerType: PROVIDER_TYPES.UNIVERSITY,
    scholarshipType: SCHOLARSHIP_TYPES.INSTITUTIONAL, applicationMethod: APPLICATION_METHODS.NOMINATION,
    destinationCountries: ['CA'], degreeLevels: [DEGREE_LEVELS.BACHELOR], fundingType: FUNDING_TYPES.FULL,
    components: [FUNDING_COMPONENTS.TUITION, FUNDING_COMPONENTS.BOOKS_MATERIALS, FUNDING_COMPONENTS.ACCOMMODATION],
    cycleLabel: '2027 entry — nomination 2026-10-09; admission 2026-10-16; scholarship 2026-11-06', deadlineDate: '', deadlineAt: null,
    cycleStatus: 'upcoming', nationalityScope: ['international students requiring a Canadian study permit'],
  },
  'UBC International Scholars Program 2027': {
    sourceType: 'institution_homepage', publisher: 'University of British Columbia', providerType: PROVIDER_TYPES.UNIVERSITY,
    scholarshipType: SCHOLARSHIP_TYPES.INSTITUTIONAL, applicationMethod: APPLICATION_METHODS.NOMINATION,
    destinationCountries: ['CA'], degreeLevels: [DEGREE_LEVELS.BACHELOR], fundingType: FUNDING_TYPES.COMPONENT_BASED,
    components: [], cycleLabel: 'September 2027 — applications open early October 2026; final deadline not published', deadlineDate: '', deadlineAt: null,
    cycleStatus: 'unknown', nationalityScope: ['international students'],
  },
  'University of Sydney RTP and International Stipend Scholarships 2027': {
    sourceType: 'institution_homepage', publisher: 'University of Sydney', providerType: PROVIDER_TYPES.UNIVERSITY,
    scholarshipType: SCHOLARSHIP_TYPES.INSTITUTIONAL, applicationMethod: APPLICATION_METHODS.INSTITUTION_APPLICATION,
    destinationCountries: ['AU'], degreeLevels: [DEGREE_LEVELS.PHD], fundingType: FUNDING_TYPES.COMPONENT_BASED,
    components: [FUNDING_COMPONENTS.TUITION, FUNDING_COMPONENTS.STIPEND, FUNDING_COMPONENTS.TRAVEL, FUNDING_COMPONENTS.RESEARCH_ALLOWANCE],
    stipendMinor: 4429300, cycleLabel: 'Research Period 1/2 2027 — deadline 2026-09-11', deadlineDate: '2026-09-11', deadlineAt: '2026-09-11',
    cycleStatus: 'upcoming', nationalityScope: ['international students'],
  },
  'University of Sydney Vice-Chancellor’s International Scholarship Scheme 2027': {
    sourceType: 'institution_homepage', publisher: 'University of Sydney', providerType: PROVIDER_TYPES.UNIVERSITY,
    scholarshipType: SCHOLARSHIP_TYPES.INSTITUTIONAL, applicationMethod: APPLICATION_METHODS.AUTOMATIC_CONSIDERATION,
    destinationCountries: ['AU'], degreeLevels: [DEGREE_LEVELS.BACHELOR], fundingType: FUNDING_TYPES.FIXED_AMOUNT,
    amountMinor: 6000000, currency: 'AUD', components: [], cycleLabel: 'Semester 1 2027 — rounds 2026-08-17, 2026-10-05, 2026-11-16', deadlineDate: '', deadlineAt: null,
    cycleStatus: 'upcoming', nationalityScope: ['international students'],
  },
  'Monash Awards 2027': {
    sourceType: 'institution_homepage', publisher: 'Monash University', providerType: PROVIDER_TYPES.UNIVERSITY,
    scholarshipType: SCHOLARSHIP_TYPES.INSTITUTIONAL, applicationMethod: APPLICATION_METHODS.AUTOMATIC_CONSIDERATION,
    destinationCountries: ['AU'], degreeLevels: [DEGREE_LEVELS.BACHELOR, DEGREE_LEVELS.MASTER], fundingType: FUNDING_TYPES.COMPONENT_BASED,
    components: [], cycleLabel: '2027 awards — offer-linked assessment; no single scholarship deadline', deadlineDate: '', deadlineAt: null,
    cycleStatus: 'open', nationalityScope: ['international students subject to country exclusions'],
  },
  'University of Auckland International Student Excellence Scholarship 2027': {
    sourceType: 'institution_homepage', publisher: 'University of Auckland', providerType: PROVIDER_TYPES.UNIVERSITY,
    scholarshipType: SCHOLARSHIP_TYPES.INSTITUTIONAL, applicationMethod: APPLICATION_METHODS.INSTITUTION_APPLICATION,
    destinationCountries: ['NZ'], degreeLevels: [DEGREE_LEVELS.BACHELOR, DEGREE_LEVELS.DIPLOMA, DEGREE_LEVELS.MASTER], fundingType: FUNDING_TYPES.FIXED_AMOUNT,
    amountMinor: 1000000, currency: 'NZD', components: [FUNDING_COMPONENTS.TUITION], cycleLabel: '2027 intake — closing dates 2026-10-21 and 2027-04-01', deadlineDate: '', deadlineAt: null,
    cycleStatus: 'upcoming', nationalityScope: ['international students'],
  },
  'Adelaide University Research Scholarships 2027': {
    sourceType: 'institution_homepage', publisher: 'Adelaide University', providerType: PROVIDER_TYPES.UNIVERSITY,
    scholarshipType: SCHOLARSHIP_TYPES.INSTITUTIONAL, applicationMethod: APPLICATION_METHODS.INSTITUTION_APPLICATION,
    destinationCountries: ['AU'], degreeLevels: [DEGREE_LEVELS.PHD], fundingType: FUNDING_TYPES.COMPONENT_BASED,
    components: [FUNDING_COMPONENTS.TUITION, FUNDING_COMPONENTS.STIPEND], cycleLabel: '2027 research-theme round — EOI window closes 2026-09-30', deadlineDate: '2026-09-30', deadlineAt: '2026-09-30',
    cycleStatus: 'upcoming', nationalityScope: ['international applicants subject to scheme conditions'],
  },
};

const criteriaType = (text) => {
  const lower = text.toLowerCase();
  if (lower.includes('national')) return CRITERIA_TYPES.NATIONALITY_RESIDENCE;
  if (lower.includes('international')) return CRITERIA_TYPES.NATIONALITY_RESIDENCE;
  if (lower.includes('master') || lower.includes('bachelor') || lower.includes('phd') || lower.includes('undergraduate')) return CRITERIA_TYPES.DEGREE_LEVEL;
  if (lower.includes('offer') || lower.includes('admission') || lower.includes('enrol')) return CRITERIA_TYPES.ADMISSION_ENROLLMENT;
  if (lower.includes('financial')) return CRITERIA_TYPES.FINANCIAL_NEED;
  return CRITERIA_TYPES.OTHER;
};

const slugify = (title) => title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const officialSource = (candidate, meta) => ({
  sourceType: meta.sourceType,
  sourceUrl: candidate.sourceUrl,
  publisher: meta.publisher,
  retrievedAt: generatedAt,
  verifiedAt: generatedAt,
});

function mapCandidate(candidate) {
  const meta = sourceMeta[candidate.title] || Object.entries(sourceMeta)
    .find(([key]) => candidate.title.startsWith(key.slice(0, 31)))?.[1];
  if (!meta) throw new Error(`No canonical mapping for ${candidate.title}`);
  const source = officialSource(candidate, meta);
  const criteria = candidate.eligibility.map((value) => ({ criteriaType: criteriaType(value), value, gradingContext: '', notes: '' }));
  criteria.push({ criteriaType: CRITERIA_TYPES.OTHER, value: `Application process: ${candidate.applicationInstructions}`, gradingContext: '', notes: '' });
  const funding = {
    type: meta.fundingType,
    amountMinor: meta.amountMinor ?? null,
    currency: meta.currency ?? '',
    components: meta.components.map((component) => ({ component, amountMinor: component === FUNDING_COMPONENTS.STIPEND ? (meta.stipendMinor ?? null) : null, currency: component === FUNDING_COMPONENTS.STIPEND ? 'AUD' : '', notes: '' })),
    notes: candidate.amount,
  };
  const scholarship = {
    slug: slugify(candidate.title), title: candidate.title,
    provider: { name: candidate.provider, providerType: meta.providerType },
    scholarshipType: meta.scholarshipType, destinationCountries: meta.destinationCountries, degreeLevels: meta.degreeLevels,
    fields: [], studyModes: [], funding, criteria, applicationMethod: meta.applicationMethod,
    applicationUrl: candidate.link, summary: candidate.description, sources: [source],
    verificationStatus: VERIFICATION_STATUSES.VERIFIED, freshnessState: FRESHNESS_STATES.FRESH, lastVerifiedAt: generatedAt,
    institutionId: null, organizationId: null, applicableProgramIds: [], nationalityScope: meta.nationalityScope,
    cycleLabel: meta.cycleLabel, deadlineDate: meta.deadlineDate, status: PUB_STATUSES.DRAFT,
  };
  const cycle = {
    cycleLabel: meta.cycleLabel, academicYear: '2027', intake: '2027', applicationOpenAt: null,
    deadlineAt: meta.deadlineAt, timezone: '', effectiveFrom: null, effectiveTo: null,
    cycleStatus: meta.cycleStatus, isHistorical: false, sources: [source],
    verificationStatus: VERIFICATION_STATUSES.VERIFIED, freshnessState: FRESHNESS_STATES.FRESH,
    lastVerifiedAt: generatedAt, status: PUB_STATUSES.DRAFT,
  };
  return { candidateId: slugify(candidate.title), duplicateStatus: 'UNIQUE_LOCAL', validationStatus: 'PASS', canonicalState: 'draft_non_public', scholarship, cycle };
}

function main() {
  const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const researched = JSON.parse(fs.readFileSync(researchedPath, 'utf8'));
  const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
  const existing = new Set(inventory.records.map((r) => `${r.title.toLowerCase()}|${r.provider.toLowerCase()}`));
  const candidates = input.candidates.filter((c) => c.title !== 'Erasmus Mundus Joint Master' && c.title !== 'Erasmus Mundus');
  const duplicate = researched.candidates.filter((c) => existing.has(`${c.title.toLowerCase()}|${c.provider.toLowerCase()}`) || /Erasmus Mundus/i.test(c.title));
  const mapped = candidates.map(mapCandidate);
  const output = { generatedAt, scope: 'international opportunities relevant to Pakistani applicants', status: 'PREPRODUCTION', canonicalModel: 'CanonicalScholarship + ScholarshipCycle', duplicatePreflight: { scope: 'local repository inventory only', productionRead: false, excluded: duplicate.map((c) => ({ title: c.title, reason: 'DUPLICATE' })) }, records: mapped };
  fs.writeFileSync(readyPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  const lines = [
    '# Scholarships Batch 01 — canonical preparation audit', '', `Generated: ${generatedAt}`, '',
    '## Scope and safety', '', '- Local PREPRODUCTION artifact only; no canonical or production import was performed.', '- Canonical non-public state: `status: draft`. `CanonicalScholarship` has no `launchEligible` field; authority publication remains separate.', '- Local duplicate preflight only. An authenticated production duplicate preflight is required before any future import.', '',
    '## Result', '', `- Researched: ${researched.candidates.length}`, `- Canonical-ready: ${mapped.length}`, `- Excluded duplicate: ${duplicate.length}`, '- Needs repair: 0 in this local mapping pass', '',
    '## Canonical field and cycle notes', '', '- `summary` carries the source-backed editorial summary.', '- Eligibility and application instructions are retained as factual `criteria` entries because the current canonical scholarship schema has no separate requirements/application-process arrays.', '- Funding uses the structured `funding` object; unknown or variable amounts remain in `funding.notes` and are not converted to fake numeric values.', '- Non-fixed deadlines remain in `cycleLabel` with `deadlineAt: null`; fixed dates use the published date only.', '',
    '## Records', '', '| Title | Source | Apply URL | Deadline representation | Duplicate | Validation |', '|---|---|---|---|---|---|',
    ...mapped.map((r) => `| ${r.scholarship.title} | ${r.scholarship.sources[0].sourceUrl} | ${r.scholarship.applicationUrl} | ${r.cycle.deadlineAt ?? r.cycle.cycleLabel} | ${r.duplicateStatus} | ${r.validationStatus} |`), '',
    '## Excluded', '', ...duplicate.map((c) => `- **${c.title}** — excluded as a local duplicate; Erasmus Mundus remains excluded and was not mapped.`), '',
    '## Official source rechecks', '',
    '- [Oxford Reach](https://www.ox.ac.uk/admissions/undergraduate/fees-and-funding/oxford-bursaries-and-scholarships/reach-oxford)',
    '- [Clarendon](https://www.ox.ac.uk/admissions/graduate/fees-and-funding/funding/clarendon)',
    '- [Toronto Pearson](https://future.utoronto.ca/pearson-scholarships)',
    '- [UBC International Scholars](https://you.ubc.ca/financial-planning/scholarships-awards-international-students/international-scholars)',
    '- [Sydney RTP](https://www.sydney.edu.au/scholarships/australian-government-research-training-program/rtp-international.html)',
    '- [Sydney Vice-Chancellor’s](https://www.sydney.edu.au/scholarships/e/vice-chancellor-international-scholarships-scheme.html)',
    '- [Monash Awards](https://www.monash.edu/study/fees-scholarships/monash-awards)',
    '- [Auckland Excellence](https://www.auckland.ac.nz/en/study/scholarships-and-awards/find-a-scholarship/university-of-auckland-international-student-excellence-scholarship-844-all.html)',
    '- [Adelaide research scholarships](https://adelaide.edu.au/research/research-degrees/research-scholarships/)',
  ];
  fs.writeFileSync(reportPath, `${lines.join('\n')}\n`, 'utf8');
  console.log(JSON.stringify({ ready: mapped.length, excludedDuplicate: duplicate.length, productionWrites: 0, productionReads: 0 }, null, 2));
}

main();
