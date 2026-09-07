import test from 'node:test';
import assert from 'node:assert/strict';
import { hydrateJobDetail, hydrateJobDetails, HYDRATION_STATUS, summarizeHydration, validateDiscoveryRecord } from './job-detail-hydrator.mjs';

const completeHtml = '<h2>Responsibilities</h2><ul><li>Lead delivery teams.</li><li>Coordinate launch work.</li></ul><h2>Requirements</h2><ul><li>Full-time role.</li><li>Five years of experience.</li></ul>';
const thinHtml = '<p>Full-time role coordinating a small hiring program.</p>';
const incompleteHtml = '<h2>Responsibilities</h2><ul><li>Lead delivery.</li></ul><h2>Team Context</h2><p>Work with product partners on a large operating program.</p><h2>Requirements</h2><ul><li>Strong judgment.</li></ul>';

function record(overrides = {}) {
  return { company: 'Example Co', title: 'Platform Engineer', externalId: 'job-1', sourceUrl: 'https://jobs.example.test/job-1', applicationLink: 'https://jobs.example.test/job-1/apply', location: 'Remote', ...overrides };
}

function transportFor({ detail = {}, sourceBody = completeHtml, sourceStatus = 200, applicationStatus = 200, applicationUrl, delay = 0, onRequest } = {}) {
  return async ({ url }) => {
    onRequest?.(url);
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    if (url.includes('/apply')) return { status: applicationStatus, url: applicationUrl ?? url, body: '<html>Apply now</html>' };
    if (url.includes('boards-api.greenhouse.io') || url.includes('api.lever.co')) return { status: 200, url, data: detail, body: JSON.stringify(detail) };
    return { status: sourceStatus, url, body: sourceBody };
  };
}

async function hydrate(overrides = {}, transportOverrides = {}) {
  return hydrateJobDetail(record(overrides), { transport: transportFor(transportOverrides), retryDelayMs: 0 });
}

test('valid Greenhouse detail hydrates through API and source page', async () => {
  const result = await hydrate({ sourceType: 'GREENHOUSE', board: 'example', externalId: '123', sourceUrl: 'https://boards.greenhouse.io/example/jobs/123' }, { detail: { id: '123', title: 'Platform Engineer', company_name: 'Example Co', location: { name: 'Remote' }, commitment: 'Full-time', content: completeHtml } });
  assert.equal(result.hydrationStatus, HYDRATION_STATUS.HYDRATED);
  assert.equal(result.sourceType, 'GREENHOUSE');
});

test('valid Lever detail uses the shared Lever commitment mapper', async () => {
  const result = await hydrate({ sourceType: 'LEVER', board: 'example', externalId: 'lever-1', sourceUrl: 'https://jobs.lever.co/example/lever-1' }, { detail: { id: 'lever-1', text: 'Platform Engineer', company: 'Example Co', categories: { location: 'Remote', commitment: 'full-time' }, description: completeHtml } });
  assert.equal(result.type, 'full-time');
  assert.equal(result.hydrationStatus, HYDRATION_STATUS.HYDRATED);
});

test('employer careers HTML source is supported', async () => { assert.equal((await hydrate()).hydrationStatus, HYDRATION_STATUS.HYDRATED); });
test('source 404 is not retried as a transient failure', async () => { assert.equal((await hydrate({}, { sourceStatus: 404 })).hydrationStatus, HYDRATION_STATUS.CLOSED_OR_FILLED); });
test('application 404 returns APPLICATION_UNAVAILABLE', async () => { assert.equal((await hydrate({}, { applicationStatus: 404 })).hydrationStatus, HYDRATION_STATUS.APPLICATION_UNAVAILABLE); });

test('transient source failure retries', async () => {
  let attempts = 0;
  const result = await hydrateJobDetail(record(), { retryDelayMs: 0, retries: 1, transport: async ({ url }) => { if (!url.includes('/apply') && attempts++ === 0) return { status: 503, url, body: '' }; return url.includes('/apply') ? { status: 200, url, body: '' } : { status: 200, url, body: completeHtml }; } });
  assert.equal(result.hydrationStatus, HYDRATION_STATUS.HYDRATED);
  assert.equal(attempts, 2);
});

test('closed posting is rejected', async () => { assert.equal((await hydrate({}, { sourceBody: `${completeHtml}<p>This position has been filled.</p>` })).hydrationStatus, HYDRATION_STATUS.CLOSED_OR_FILLED); });
test('identity mismatch is rejected', async () => { const result = await hydrate({ sourceType: 'GREENHOUSE', board: 'example', externalId: '123', sourceUrl: 'https://boards.greenhouse.io/example/jobs/123' }, { detail: { id: '123', title: 'Different Role', company_name: 'Example Co', commitment: 'Full-time', content: completeHtml } }); assert.equal(result.hydrationStatus, HYDRATION_STATUS.IDENTITY_MISMATCH); });
test('explicit full-time is preserved', async () => { assert.equal((await hydrate({ explicitType: 'full-time' })).type, 'full-time'); });
test('explicit contract is preserved', async () => { assert.equal((await hydrate({ explicitType: 'contract' })).type, 'contract'); });
test('explicit internship is preserved', async () => { assert.equal((await hydrate({ explicitType: 'internship' })).type, 'internship'); });
test('unsupported employment type is not inferred', async () => { const result = await hydrate({ explicitType: 'seasonal' }, { sourceBody: completeHtml.replace('Full-time', 'Seasonal') }); assert.equal(result.hydrationStatus, HYDRATION_STATUS.MISSING_EMPLOYMENT_TYPE); assert.equal(result.type, null); });
test('jobType is not inferred from employment type', async () => { const result = await hydrate({ explicitType: 'full-time' }); assert.equal(result.jobType, null); });
test('explicit canonical jobType is retained', async () => { const result = await hydrate({ explicitType: 'full-time', jobType: 'Private' }); assert.equal(result.jobType, 'Private'); });
test('application redirect to generic careers is rejected', async () => { const result = await hydrate({}, { applicationUrl: 'https://jobs.example.test/careers' }); assert.equal(result.hydrationStatus, HYDRATION_STATUS.APPLICATION_UNAVAILABLE); });
test('EXTRACTION_COMPLETE is accepted', async () => { assert.equal((await hydrate()).extractionClassification, 'EXTRACTION_COMPLETE'); });
test('SOURCE_THIN_OK remains a valid hydration result', async () => { const result = await hydrate({}, { sourceBody: thinHtml }); assert.equal(result.hydrationStatus, HYDRATION_STATUS.SOURCE_THIN_OK); });
test('EXTRACTION_INCOMPLETE fails normal hydration', async () => { const result = await hydrate({ explicitType: 'full-time' }, { sourceBody: incompleteHtml }); assert.equal(result.hydrationStatus, HYDRATION_STATUS.EXTRACTION_INCOMPLETE); });
test('diagnostic-only returns incomplete extraction without accepting it', async () => { const result = await hydrateJobDetail(record(), { diagnosticOnly: true, transport: transportFor({ sourceBody: incompleteHtml }) }); assert.equal(result.extractionClassification, 'EXTRACTION_INCOMPLETE'); assert.notEqual(result.hydrationStatus, HYDRATION_STATUS.HYDRATED); });
test('nested structural content is extracted by the shared parser', async () => { const result = await hydrate({}, { sourceBody: '<div><p><strong>Responsibilities</strong></p><div><ul><li>Lead teams<ul><li>Coach managers</li></ul></li></ul></div><p><strong>Requirements</strong></p><ol><li>Five years of experience.</li></ol></div>' }); assert.deepEqual(result.responsibilities, ['Lead teams', 'Coach managers']); assert.deepEqual(result.experience, ['Five years of experience.']); });
test('generic careers source is rejected when supplied as application route', async () => { const result = await hydrate({ applicationLink: 'https://jobs.example.test/careers' }); assert.equal(result.hydrationStatus, HYDRATION_STATUS.APPLICATION_UNAVAILABLE); });
test('generic careers source URL is rejected before hydration', async () => { const result = await hydrate({ sourceUrl: 'https://jobs.example.test/careers' }); assert.equal(result.hydrationStatus, HYDRATION_STATUS.SOURCE_UNAVAILABLE); });
test('missing externalId is invalid input', async () => { const result = await hydrateJobDetail(record({ externalId: '' }), { transport: transportFor() }); assert.equal(result.hydrationStatus, HYDRATION_STATUS.INVALID_INPUT); });
test('unsupported source family is rejected', async () => { const result = await hydrate({ sourceType: 'UNKNOWN' }); assert.equal(result.hydrationStatus, HYDRATION_STATUS.UNSUPPORTED_SOURCE); });
test('location, salary and deadline are not invented', async () => { const result = await hydrate({ location: 'Remote' }); assert.equal(result.salary, null); assert.equal(result.currency, null); assert.equal(result.deadline, null); assert.equal(result.location, 'Remote'); });
test('output is deterministic and input is not mutated', async () => { const input = record({ metadata: { keep: true } }); const before = JSON.stringify(input); const one = await hydrateJobDetail(input, { transport: transportFor() }); const two = await hydrateJobDetail(input, { transport: transportFor() }); assert.equal(JSON.stringify(input), before); assert.deepEqual(one, two); });
test('concurrency is bounded', async () => { let active = 0; let peak = 0; const transport = async ({ url }) => { active += 1; peak = Math.max(peak, active); await new Promise((resolve) => setTimeout(resolve, 5)); active -= 1; return url.includes('/apply') ? { status: 200, url, body: '' } : { status: 200, url, body: completeHtml }; }; const rows = await hydrateJobDetails([record({ externalId: '1', sourceUrl: 'https://jobs.example.test/1', applicationLink: 'https://jobs.example.test/1/apply' }), record({ externalId: '2', sourceUrl: 'https://jobs.example.test/2', applicationLink: 'https://jobs.example.test/2/apply' }), record({ externalId: '3', sourceUrl: 'https://jobs.example.test/3', applicationLink: 'https://jobs.example.test/3/apply' })], { concurrency: 2, transport, retryDelayMs: 0 }); assert.equal(rows.length, 3); assert.ok(peak <= 2); });
test('summaries count explicit statuses', () => { assert.deepEqual(summarizeHydration([{ hydrationStatus: 'HYDRATED' }, { hydrationStatus: 'HYDRATED' }, { hydrationStatus: 'SOURCE_THIN_OK' }]), { HYDRATED: 2, SOURCE_THIN_OK: 1 }); });
test('input validation reports all required fields', () => { assert.deepEqual(validateDiscoveryRecord({}), ['missing company', 'missing title', 'missing externalId', 'missing sourceUrl']); });
