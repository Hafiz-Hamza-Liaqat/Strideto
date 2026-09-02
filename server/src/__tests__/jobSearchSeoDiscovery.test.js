import assert from 'node:assert/strict';
import fs from 'node:fs';
import { renderJobShell } from '../../../scripts/prerender-seo.mjs';
import { buildJobDiscoverySummary } from '../../../shared/jobs/jobDiscovery.js';
import { isJobDetailPubliclyEligible } from '../../../shared/seo/entityDetailSeoPolicy.js';

const read = (file) => fs.readFileSync(new URL(`../../../${file}`, import.meta.url), 'utf8');
const base = '<html><head><meta name="description" content="old"><meta name="robots" content="index, follow"><title>Old</title><link rel="canonical" href="https://old.example/" /></head><body><div id="root"></div></body></html>';
const job = {
  slug: 'data-analyst-karachi',
  title: 'Data Analyst',
  company: 'US Mobile',
  category: 'Data & Analytics',
  city: 'Karachi',
  region: 'Sindh',
  countryCode: 'PK',
  workMode: 'on_site',
  type: 'full-time',
  description: 'Analyze data for the company.',
  experience: '1+ year',
  educationRequirement: "Bachelor's degree",
  requirements: ['SQL'],
  responsibilities: ['Build reports'],
  skillsRequired: ['SQL', 'Python'],
  benefits: ['Health insurance'],
  jobsGraphEligible: true,
  status: 'active',
  approvalStatus: 'approved',
  publicationState: 'active',
  createdAt: '2026-08-01T00:00:00.000Z',
};

const detail = read('client/src/pages/Jobs/JobDetail.jsx');
const jobsPage = read('client/src/pages/Jobs/Jobs.jsx');
const mapper = read('server/src/services/search/documentMappers.js');

assert.equal(buildJobDiscoverySummary(job), 'US Mobile is hiring a full-time on-site Data Analyst in Karachi, Sindh, PK.');
assert.match(jobsPage, /Jobs & Career Opportunities \| STRIDETO/);
assert.match(jobsPage, /Browse jobs and career opportunities by location/);
assert.match(detail, /job\.metaDescription \|\| fallbackDiscoveryDescription/);
assert.match(detail, /job\.seoTitle \|\|/);
assert.match(mapper, /doc\.city/);
assert.match(mapper, /doc\.workMode/);
assert.match(mapper, /doc\.skillsRequired/);

const html = renderJobShell(base, job);
assert.match(html, /"experienceRequirements":"1\+ year"/);
assert.match(html, /"educationRequirements":"Bachelor's degree"/);
assert.match(html, /"qualifications":\["SQL"\]/);
assert.match(html, /"responsibilities":\["Build reports"\]/);
assert.match(html, /"occupationalCategory"/);
assert.match(html, /"addressRegion":"Sindh"/);
assert.match(html, /<h1>Data Analyst<\/h1>/);
assert.match(html, /US Mobile/);
assert.match(html, /Karachi/);
assert.match(html, /data-analyst-karachi/);
assert.match(html, /<script type="application\/ld\+json">/);
assert.match(html, /"@type":"JobPosting"/);
assert.match(html, /"skills":"SQL, Python"/);
assert.match(html, /"jobBenefits":\["Health insurance"\]/);

assert.equal(isJobDetailPubliclyEligible(job), true);
assert.equal(isJobDetailPubliclyEligible({ ...job, deadline: '2020-01-01' }), false);
assert.equal(isJobDetailPubliclyEligible({ ...job, jobsGraphEligible: false }), true);

console.log('jobSearchSeoDiscovery.test.js: focused Job SEO/search assertions passed');
