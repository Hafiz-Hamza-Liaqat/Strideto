import { createHash } from 'node:crypto';
import { isValidApplicationMethod, isValidFundingType, isValidScholarshipType } from '../../shared/education/scholarshipIntelligence.js';
import { isValidDegreeLevel, isValidPubStatus } from '../../shared/education/taxonomy.js';
import { validateSource } from '../../shared/international/evidence.js';

export const BATCH_TITLES = Object.freeze([
  'Reach Oxford Scholarship 2027', 'Clarendon Fund Scholarship 2027',
  'Lester B. Pearson International Scholarship 2027', 'UBC International Scholars Program 2027',
  'University of Sydney RTP and International Stipend Scholarships 2027',
  'University of Sydney Vice-Chancellor’s International Scholarship Scheme 2027',
  'Monash Awards 2027', 'University of Auckland International Student Excellence Scholarship 2027',
  'Adelaide University Research Scholarships 2027',
]);

export const normalize = (value) => String(value ?? '').trim().toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9]+/g, ' ').trim();
export const host = (value) => { try { return new URL(value).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; } };
export const recordsFrom = (body) => Array.isArray(body?.data) ? body.data : Array.isArray(body?.items) ? body.items : Array.isArray(body?.results) ? body.results : Array.isArray(body) ? body : [];
export const sourceUrls = (record) => (Array.isArray(record?.sources) ? record.sources : []).map((s) => s?.sourceUrl).filter(Boolean);

export function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex'); }

export function validateBatch(artifact) {
  const records = artifact?.records;
  if (!Array.isArray(records) || records.length !== BATCH_TITLES.length) throw new Error(`Expected exactly ${BATCH_TITLES.length} canonical scholarship records.`);
  const titles = records.map((r) => r?.scholarship?.title);
  if (JSON.stringify(titles.map(normalize)) !== JSON.stringify(BATCH_TITLES.map(normalize))) throw new Error('Input does not match the exact Batch 01 allowlist and order.');
  for (const record of records) {
    const s = record.scholarship;
    const c = record.cycle;
    if (!s.title || !s.slug || !s.provider?.name || !isValidScholarshipType(s.scholarshipType)) throw new Error(`Invalid scholarship identity: ${s.title || 'untitled'}`);
    if (!Array.isArray(s.degreeLevels) || !s.degreeLevels.every(isValidDegreeLevel)) throw new Error(`Invalid degree level: ${s.title}`);
    if (!isValidFundingType(s.funding?.type) || !isValidApplicationMethod(s.applicationMethod)) throw new Error(`Invalid taxonomy: ${s.title}`);
    if (!isValidPubStatus(s.status) || s.status !== 'draft') throw new Error(`Scholarship must remain draft: ${s.title}`);
    if (!Array.isArray(s.sources) || s.sources.length === 0 || s.sources.some((source) => !validateSource(source).ok)) throw new Error(`Official source evidence is invalid: ${s.title}`);
    if (!s.applicationUrl || !/^https:\/\//i.test(s.applicationUrl)) throw new Error(`Official application URL is required: ${s.title}`);
    if (!c || c.status !== 'draft' || !Array.isArray(c.sources) || c.sources.length === 0 || c.sources.some((source) => !validateSource(source).ok)) throw new Error(`Invalid draft cycle: ${s.title}`);
    if (c.deadlineAt !== null && Number.isNaN(Date.parse(c.deadlineAt))) throw new Error(`Invalid cycle deadline: ${s.title}`);
    if (Object.hasOwn(s, 'launchEligible') || Object.hasOwn(c, 'launchEligible')) throw new Error(`Unsupported launchEligible field in payload: ${s.title}`);
  }
  return records;
}

export function payloads(record) {
  const s = record.scholarship;
  const c = record.cycle;
  return {
    scholarship: {
      slug: s.slug, title: s.title, provider: s.provider, scholarshipType: s.scholarshipType,
      destinationCountries: s.destinationCountries, degreeLevels: s.degreeLevels, fields: s.fields,
      studyModes: s.studyModes, funding: s.funding, criteria: s.criteria, applicationMethod: s.applicationMethod,
      applicationUrl: s.applicationUrl, summary: s.summary, sources: s.sources, institutionId: s.institutionId,
      organizationId: s.organizationId, applicableProgramIds: s.applicableProgramIds, nationalityScope: s.nationalityScope,
      cycleLabel: s.cycleLabel, deadlineDate: s.deadlineDate, status: 'draft',
    },
    cycle: {
      cycleLabel: c.cycleLabel, academicYear: c.academicYear, intake: c.intake,
      applicationOpenAt: c.applicationOpenAt, deadlineAt: c.deadlineAt, timezone: c.timezone,
      effectiveFrom: c.effectiveFrom, effectiveTo: c.effectiveTo, cycleStatus: c.cycleStatus,
      isHistorical: false, sources: c.sources, status: 'draft',
    },
  };
}

export function matchScholarship(candidate, existing) {
  const c = candidate.scholarship;
  const title = normalize(c.title);
  const provider = normalize(c.provider?.name);
  const sourceHosts = new Set(sourceUrls(c).map(host).filter(Boolean));
  const applyHost = host(c.applicationUrl);
  return existing.map((item) => {
    const signals = [];
    if (title && normalize(item.title) === title) signals.push('normalized-title');
    if (provider && normalize(item.provider?.name || item.provider) === provider) signals.push('provider');
    const itemHosts = new Set(sourceUrls(item).map(host).filter(Boolean));
    if ([...sourceHosts].some((h) => itemHosts.has(h))) signals.push('official-source-domain');
    if (applyHost && (host(item.applicationUrl) === applyHost || itemHosts.has(applyHost))) signals.push('application-domain');
    if (normalize(item.destinationCountries || item.country) === normalize(c.destinationCountries)) signals.push('country');
    return { item, signals };
  }).filter(({ signals }) => signals.includes('normalized-title') && signals.some((s) => ['provider', 'official-source-domain', 'application-domain'].includes(s)));
}

export function classify(record, existing, cycles) {
  const matches = matchScholarship(record, existing);
  if (matches.length > 1) return { classification: 'REVIEW_REQUIRED', relationship: 'PARTIAL_REVIEW_REQUIRED', matches };
  if (matches.length === 0) return { classification: 'SAFE_TO_CREATE', relationship: 'NEW_SCHOLARSHIP_NEW_CYCLE', matches };
  const existingId = String(matches[0].item._id || matches[0].item.id);
  const cycleMatch = cycles.find((cycle) => String(cycle.scholarshipId || cycle.scholarship?._id) === existingId && normalize(cycle.academicYear) === normalize(record.cycle.academicYear));
  return cycleMatch
    ? { classification: 'DUPLICATE_SKIP', relationship: 'EXISTING_SCHOLARSHIP_EXISTING_CYCLE', matches, cycleMatch }
    : { classification: 'EXISTING_SCHOLARSHIP_NEW_CYCLE', relationship: 'EXISTING_SCHOLARSHIP_NEW_CYCLE', matches };
}

export function compareReadback(expected, actual) {
  const fields = ['title', 'slug', 'scholarshipType', 'applicationUrl', 'summary', 'status', 'cycleLabel', 'deadlineDate'];
  const mismatches = fields.filter((field) => normalize(expected[field]) !== normalize(actual[field]));
  if (normalize(expected.provider?.name) !== normalize(actual.provider?.name)) mismatches.push('provider.name');
  if (JSON.stringify(expected.destinationCountries || []) !== JSON.stringify(actual.destinationCountries || [])) mismatches.push('destinationCountries');
  if (JSON.stringify(expected.degreeLevels || []) !== JSON.stringify(actual.degreeLevels || [])) mismatches.push('degreeLevels');
  if (JSON.stringify(expected.sources || []) !== JSON.stringify(actual.sources || [])) mismatches.push('sources');
  if (JSON.stringify(expected.funding || {}) !== JSON.stringify(actual.funding || {})) mismatches.push('funding');
  return { ok: mismatches.length === 0, mismatches };
}
