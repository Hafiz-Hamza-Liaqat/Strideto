/**
 * STRIDETO JOB-AUTHORING-P1A — Employer job form completeness + Admin openingsCount.
 * Run: node src/__tests__/jobAuthoringP1a.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { normalizeJobLineItems } from '../../../shared/employer/jobLineItems.js';
import { parseOpeningsCount } from '../../../shared/employer/openingsCount.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');

const read = (rel) => readFileSync(path.join(repoRoot, rel), 'utf8');

const modPath = pathToFileURL(
  path.resolve(repoRoot, 'client/src/pages/Employer/employerPostJobValidation.js')
).href;

const {
  validateEmployerPostJobForm,
  buildCreateJobPayload,
  buildUpdateJobPayload,
  jobToForm,
} = await import(modPath);

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const employerPostJob = read('client/src/pages/Employer/EmployerPostJob.jsx');
const employerValidation = read('client/src/pages/Employer/employerPostJobValidation.js');
const employerController = read('server/src/controllers/employerController.js');
const adminJobsUi = read('client/src/pages/Admin/AdminContentJobs.jsx');
const adminJobsController = read('server/src/controllers/admin/adminJobsController.js');
const jobDetail = read('client/src/pages/Jobs/JobDetail.jsx');
const publicDiscovery = read('shared/publicDiscovery/projectPublicDiscovery.js');

const baseForm = {
  jobTitle: 'React Developer',
  companyName: 'Strideto',
  location: 'Lahore',
  jobType: 'Private',
  type: 'full-time',
  salaryRange: '80,000 - 120,000',
  salaryCurrency: '',
  skillsRequired: 'React, Node.js',
  requirements: '',
  responsibilities: '',
  jobDescription: 'Build and maintain React applications for our platform.',
  applicationDeadline: '',
  applyLink: '',
  applyEmail: '',
  applyMethod: 'internal',
  openingsCount: '1',
};

check(
  employerPostJob.includes('name="requirements"') && employerPostJob.includes('FIELD_IDS.requirements'),
  'JOB-P1A-REQ-01: Employer form exposes Requirements'
);

{
  const lines = '5+ years of relevant experience\nStrong communication skills\nExperience with React and Node.js';
  const normalized = normalizeJobLineItems(lines);
  check(normalized.length === 3, 'JOB-P1A-REQ-02: three requirement lines normalized');
  check(normalized[0] === '5+ years of relevant experience', 'JOB-P1A-REQ-02: first requirement preserved');
  check(normalizeJobLineItems('Comma, inside, one line').length === 1, 'JOB-P1A-REQ-02: commas inside a line are not split');
}

check(
  employerController.includes('requirements: normalizeJobLineItems(body.requirements)'),
  'JOB-P1A-REQ-03: employer create persists normalized requirements'
);
{
  const payload = buildCreateJobPayload({ ...baseForm, requirements: 'Line one\nLine two' }, ['React']);
  check(Array.isArray(payload.requirements) && payload.requirements.length === 2, 'JOB-P1A-REQ-03: create payload carries requirements[]');
}

{
  const form = jobToForm({ title: 'T', company: 'C', requirements: ['Req A', 'Req B'] });
  check(form.requirements === 'Req A\nReq B', 'JOB-P1A-REQ-04: edit form loads requirements one-per-line');
}

{
  const payload = buildUpdateJobPayload({ ...baseForm, requirements: 'Alpha\nBeta', applyMethod: 'internal' }, ['React']);
  check(payload.requirements.join('|') === 'Alpha|Beta', 'JOB-P1A-REQ-05: edit payload round-trips requirements');
}

check(
  publicDiscovery.includes("'requirements'") && jobDetail.includes('job.requirements.map'),
  'JOB-P1A-REQ-06: public Job detail renders requirements section'
);

check(employerPostJob.includes('name="responsibilities"'), 'JOB-P1A-RESP-01: Employer form exposes Responsibilities');
check(
  employerController.includes('responsibilities: normalizeJobLineItems(body.responsibilities)'),
  'JOB-P1A-RESP-02: create persists responsibilities[]'
);
{
  const form = jobToForm({ title: 'T', company: 'C', responsibilities: ['Ship features'] });
  const payload = buildUpdateJobPayload(
    { ...form, applyMethod: 'internal', openingsCount: '1', jobDescription: baseForm.jobDescription },
    []
  );
  check(payload.responsibilities[0] === 'Ship features', 'JOB-P1A-RESP-03: edit round-trip responsibilities');
}
check(jobDetail.includes('job.responsibilities.map'), 'JOB-P1A-RESP-04: public detail renders responsibilities section');

check(employerPostJob.includes('name="salaryCurrency"'), 'JOB-P1A-CUR-01: Employer form exposes controlled salaryCurrency');
{
  const payload = buildCreateJobPayload({ ...baseForm, salaryCurrency: 'pkr' }, ['React']);
  check(payload.salaryCurrency === 'PKR', 'JOB-P1A-CUR-02: valid code normalizes to PKR');
}
{
  const r = validateEmployerPostJobForm({ ...baseForm, salaryCurrency: 'ZZZ' });
  check(r.errors.salaryCurrency === 'validationSalaryCurrencyInvalid', 'JOB-P1A-CUR-03: invalid currency rejected client-side');
}
check(employerController.includes('parseEmployerSalaryCurrency'), 'JOB-P1A-CUR-03: server validates salary currency');
{
  const form = jobToForm({ title: 'T', company: 'C', salaryCurrency: 'USD' });
  const payload = buildUpdateJobPayload(
    { ...form, applyMethod: 'internal', openingsCount: '1', jobDescription: baseForm.jobDescription },
    []
  );
  check(payload.salaryCurrency === 'USD', 'JOB-P1A-CUR-04: edit round-trip salaryCurrency');
}

check(
  adminJobsUi.includes('openingsCount') && adminJobsUi.includes('type="number"'),
  'JOB-P1A-OPEN-01: Admin form exposes openingsCount'
);
check(
  adminJobsController.includes('parseOpeningsCount(body.openingsCount'),
  'JOB-P1A-OPEN-02: Admin write path persists openingsCount'
);
{
  const invalid = parseOpeningsCount('0', { required: false });
  check(!invalid.ok, 'JOB-P1A-OPEN-03: invalid openingsCount rejected');
  const valid = parseOpeningsCount('5', { required: false });
  check(valid.ok && valid.value === 5, 'JOB-P1A-OPEN-03: valid openingsCount accepted');
}
check(
  adminJobsUi.includes("job.openingsCount == null ? '' : String(job.openingsCount)"),
  'JOB-P1A-OPEN-04: Admin edit loads openingsCount'
);

check(!employerController.includes('body.jobsGraphEligible'), 'JOB-P1A-SEC-01: Employer request cannot set jobsGraphEligible');
for (const forbidden of ['body.employerId', 'body.postedByEmployerId']) {
  check(!employerController.includes(forbidden), `JOB-P1A-SEC-02: Employer request cannot spoof ${forbidden}`);
}
check(
  !employerValidation.includes('approvalStatus') && !employerPostJob.includes('name="approvalStatus"'),
  'JOB-P1A-SEC-03: Employer form cannot self-approve'
);
for (const field of ['sourceUrl', 'sourceWebsite', 'externalId']) {
  check(!employerPostJob.includes(`name="${field}"`), `JOB-P1A-SEC-04: Employer form excludes admin provenance ${field}`);
}
check(
  (employerController.match(/jobsGraphEligible/g) || []).length === 1,
  'JOB-P1A-SEC-05: jobsGraphEligible authority unchanged (create-only literal)'
);
check(
  employerController.includes('isFirstJob') && employerController.includes('planType'),
  'JOB-P1A-SEC-06: draft/plan behavior hooks still present on create'
);

check(!publicDiscovery.includes("'benefits'"), 'Benefits deferred: not projected on public Job surfaces');
check(!employerPostJob.includes('name="benefits"'), 'Benefits deferred: no dead Employer benefits field');

for (const key of ['requirements', 'responsibilities', 'salaryCurrency']) {
  check(employerValidation.includes(key), `Future autofill/bulk contract exposes ${key}`);
}

console.log(`jobAuthoringP1a.test.js: ${count} assertions passed`);
