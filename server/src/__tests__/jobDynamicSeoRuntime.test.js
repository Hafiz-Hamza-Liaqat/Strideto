import assert from 'node:assert/strict';
import fs from 'node:fs';
import { handler } from '../../../client/api/seo/jobs.js';

const baseHtml = '<html><head><title>App</title><meta name="description" content="App"><meta name="robots" content="index, follow"></head><body><div id="root"></div><script type="module" src="/assets/app.js"></script></body></html>';
const eligibleJob = {
  slug: 'runtime-job',
  title: 'Runtime Job',
  company: 'Current Company',
  city: 'Lahore',
  countryCode: 'PK',
  workMode: 'on_site',
  type: 'full-time',
  description: 'Current public description.',
  createdAt: '2026-08-01T00:00:00.000Z',
  status: 'active',
  approvalStatus: 'approved',
  publicationState: 'active',
  jobsGraphEligible: true,
  skillsRequired: ['SQL'],
};

function response({ status = 200, body, text = '' } = {}) {
  return { ok: status >= 200 && status < 300, status, text: async () => text, json: async () => body };
}

async function invoke(jobResponse, { shellFailure = false, apiFailure = false } = {}) {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    if (calls.length === 1 && shellFailure) throw new Error('shell unavailable');
    if (calls.length === 2 && apiFailure) throw new Error('api unavailable');
    return calls.length === 1 ? response({ text: baseHtml }) : jobResponse;
  };
  const output = { headers: {}, body: '', setHeader(key, value) { this.headers[key] = value; }, end(value = '') { this.body = value; } };
  try {
    await handler({ method: 'GET', query: { slug: 'runtime-job' }, headers: { host: 'www.strideto.com' } }, output);
  } finally {
    globalThis.fetch = originalFetch;
  }
  return { output, calls };
}

const first = await invoke(response({ body: eligibleJob }));
assert.equal(first.output.statusCode, 200);
assert.match(first.output.body, /<h1>Runtime Job<\/h1>/);
assert.match(first.output.body, /https:\/\/www\.strideto\.com\/jobs\/runtime-job/);
assert.match(first.output.body, /"@type":"JobPosting"/);
assert.match(first.output.body, /src="\/assets\/app\.js"/);
assert.equal(first.output.headers['Cache-Control'], 'public, s-maxage=60, stale-while-revalidate=300');
assert.ok(first.calls[1].includes('/api/seo/jobs/runtime-job'));

const edited = await invoke(response({ body: { ...eligibleJob, title: 'Edited Runtime Job', description: 'Edited public description.' } }));
assert.match(edited.output.body, /Edited Runtime Job/);
assert.match(edited.output.body, /Edited public description/);

const unauthorized = await invoke(response({ body: { ...eligibleJob, jobsGraphEligible: false } }));
assert.doesNotMatch(unauthorized.output.body, /"@type":"JobPosting"/);

const expired = await invoke(response({ body: { ...eligibleJob, deadline: '2020-01-01' } }));
assert.doesNotMatch(expired.output.body, /"@type":"JobPosting"/);

const hostile = await invoke(response({
  body: {
    ...eligibleJob,
    title: '</script><script>alert(1)</script> "quoted"',
    company: 'A & B <Company>',
    description: '</script><script>alert(2)</script> café',
  },
}));
assert.doesNotMatch(hostile.output.body, /<\/script><script>alert/);
assert.match(hostile.output.body, /&lt;\/script&gt;&lt;script&gt;alert/);
assert.match(hostile.output.body, /\\u003c/);

const unknown = await invoke(response({ status: 404, body: { error: 'Job not found' } }));
assert.equal(unknown.output.statusCode, 404);
assert.match(unknown.output.body, /<title data-rh="true">Job not found \| STRIDETO<\/title>/);
assert.match(unknown.output.body, /noindex, follow/);
assert.doesNotMatch(unknown.output.body, /rel="canonical"/);
assert.doesNotMatch(unknown.output.body, /JobPosting/);

const backendFailure = await invoke(null, { apiFailure: true });
assert.equal(backendFailure.output.statusCode, 502);
assert.match(backendFailure.output.body, /<div id="root"><\/div>/);

const shellFailure = await invoke(null, { shellFailure: true });
assert.equal(shellFailure.output.statusCode, 502);
assert.match(shellFailure.output.body, /temporarily unavailable/);

const seoController = fs.readFileSync(new URL('../controllers/seoController.js', import.meta.url), 'utf8');
const seoEndpoint = seoController.slice(seoController.indexOf('export const getSeoJobBySlug'), seoController.indexOf('export const getSeoJobBySlug') + 1200);
assert.doesNotMatch(seoEndpoint, /findByIdAndUpdate|updateOne|insert|deleteOne/);

assert.match(fs.readFileSync(new URL('../../../client/api/seo/jobs.js', import.meta.url), 'utf8'), /req\.query\?\.slug/);
assert.equal(fs.existsSync(new URL('../../../client/api/seo/jobs/[slug].js', import.meta.url)), false);

console.log('jobDynamicSeoRuntime.test.js: static current-data rendering assertions passed');
