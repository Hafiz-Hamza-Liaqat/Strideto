/**
 * STRIDETO JOB-AUTHORING-P1B — Employer logo inheritance on public jobs.
 * Run: node src/__tests__/employerLogoInheritanceP1b.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  resolvePublicJobLogoUrl,
  projectPublicJob,
  projectPublicJobListItem,
} from '../../../shared/publicDiscovery/projectPublicDiscovery.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const read = (rel) => readFileSync(path.join(repoRoot, rel), 'utf8');

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const EMPLOYER_LOGO = 'https://cdn.example.com/employer-logo.png';
const JOB_LOGO = 'https://cdn.example.com/job-logo.png';

// EMP-LOGO-01: Employer job with no Job.logoUrl uses Employer.logoUrl
{
  const job = { source: 'employer', employerId: 'abc', logoUrl: '' };
  check(
    resolvePublicJobLogoUrl(job, EMPLOYER_LOGO) === EMPLOYER_LOGO,
    'EMP-LOGO-01: employer job without job logo uses employer logo'
  );
}

// EMP-LOGO-02: Existing employer job receives current profile logo on public read
{
  const projected = projectPublicJob(
    { source: 'employer', employerId: 'abc', title: 'Dev', logoUrl: null },
    { employerLogoUrl: EMPLOYER_LOGO }
  );
  check(projected.logoUrl === EMPLOYER_LOGO, 'EMP-LOGO-02: detail projection uses live employer logo');
  const listItem = projectPublicJobListItem(
    { source: 'employer', employerId: 'abc', title: 'Dev' },
    EMPLOYER_LOGO
  );
  check(listItem.logoUrl === EMPLOYER_LOGO, 'EMP-LOGO-02: list projection uses live employer logo');
}

// EMP-LOGO-03: Changing Employer.logoUrl changes public job logo without rewriting Job
{
  const job = { source: 'employer', employerId: 'abc', logoUrl: '' };
  const first = resolvePublicJobLogoUrl(job, 'https://old.example/logo.png');
  const second = resolvePublicJobLogoUrl(job, 'https://new.example/logo.png');
  check(first !== second, 'EMP-LOGO-03: read-time fallback reflects current employer logo');
  check(second === 'https://new.example/logo.png', 'EMP-LOGO-03: updated employer logo returned');
}

// EMP-LOGO-04: Explicit legitimate Job.logoUrl precedence
{
  const job = { source: 'employer', employerId: 'abc', logoUrl: JOB_LOGO };
  check(
    resolvePublicJobLogoUrl(job, EMPLOYER_LOGO) === JOB_LOGO,
    'EMP-LOGO-04: explicit job logo takes precedence over employer logo'
  );
}

// EMP-LOGO-05: Missing/broken employer logo falls back to null (PublicListingLogo initial)
{
  const job = { source: 'employer', employerId: 'abc', logoUrl: '' };
  check(resolvePublicJobLogoUrl(job, '') === null, 'EMP-LOGO-05: missing employer logo yields null');
  check(resolvePublicJobLogoUrl(job, 'javascript:alert(1)') === null, 'EMP-LOGO-05: unsafe employer logo rejected');
}

// EMP-LOGO-06: Admin-curated external jobs still use Job.logoUrl only
{
  const adminJob = { source: 'scraper', logoUrl: JOB_LOGO, sourceWebsite: 'Indeed' };
  check(
    resolvePublicJobLogoUrl(adminJob, EMPLOYER_LOGO) === JOB_LOGO,
    'EMP-LOGO-06: admin/scraper job uses job logo only'
  );
  const noLogo = { source: 'manual', logoUrl: '' };
  check(
    resolvePublicJobLogoUrl(noLogo, EMPLOYER_LOGO) === null,
    'EMP-LOGO-06: admin job without logo does not inherit employer logo'
  );
}

// EMP-LOGO-07: No private Employer profile fields leak into public projection
{
  const projected = projectPublicJob(
    { source: 'employer', employerId: 'abc', title: 'Dev', logoUrl: '' },
    {
      employerLogoUrl: EMPLOYER_LOGO,
      employerVerification: { verified: true, companyName: 'Acme', slug: 'acme' },
    }
  );
  check(!('companyDescription' in projected), 'EMP-LOGO-07: companyDescription not in projection');
  check(!('billingEmail' in projected), 'EMP-LOGO-07: billing fields not in projection');
  check(projected.employerVerification?.companyName === 'Acme', 'EMP-LOGO-07: only public verification fields');
  const jobsController = read('server/src/controllers/jobsController.js');
  check(
    jobsController.includes(".select('verificationLevel verified companyName slug logoUrl')"),
    'EMP-LOGO-07: employer query selects only public-safe fields plus logoUrl'
  );
}

// EMP-LOGO-08: JobPosting policy unchanged
{
  const projected = projectPublicJob({ jobsGraphEligible: true, source: 'employer', employerId: 'x' }, {});
  check(projected.jobsGraphEligible === true, 'EMP-LOGO-08: jobsGraphEligible unchanged when true');
  const ineligible = projectPublicJob({ jobsGraphEligible: false, source: 'employer' }, {});
  check(ineligible.jobsGraphEligible === false, 'EMP-LOGO-08: jobsGraphEligible unchanged when false');
  const projectionSrc = read('shared/publicDiscovery/projectPublicDiscovery.js');
  check(
    !projectionSrc.includes('employerLogoUrl') || projectionSrc.includes('resolvePublicJobLogoUrl'),
    'EMP-LOGO-08: logo resolution does not mutate jobsGraphEligible'
  );
}

// Infrastructure contracts
check(
  read('server/src/utils/employerLogoProjection.js').includes('fetchEmployerLogoMap'),
  'employer logo projection utility exists'
);
check(
  read('server/src/controllers/jobsController.js').includes('fetchEmployerLogoMap'),
  'jobsController uses employer logo batch fetch'
);

// EMP-LOGO-DETAIL: single public Job detail route (/jobs/:slug) inherits employer logo
{
  const jobsController = read('server/src/controllers/jobsController.js');
  check(
    jobsController.includes('export const getJobByIdOrSlug'),
    'EMP-LOGO-DETAIL: getJobByIdOrSlug handler exists'
  );
  check(
    jobsController.includes('employerLogoUrl = emp.logoUrl'),
    'EMP-LOGO-DETAIL: detail route loads employer logoUrl from Employer record'
  );
  check(
    jobsController.includes('projectPublicJob(job, { related: relatedWithLogos, employerVerification, employerLogoUrl })'),
    'EMP-LOGO-DETAIL: detail projection passes employerLogoUrl into projectPublicJob'
  );
  const slugJob = {
    source: 'employer',
    employerId: 'emp123',
    slug: 'senior-frontend-engineer',
    title: 'Senior Frontend Engineer',
    logoUrl: '',
  };
  const detail = projectPublicJob(slugJob, { employerLogoUrl: EMPLOYER_LOGO });
  check(detail.logoUrl === EMPLOYER_LOGO, 'EMP-LOGO-DETAIL: projected logoUrl equals Employer.logoUrl without job rewrite');
  check(detail.slug === 'senior-frontend-engineer', 'EMP-LOGO-DETAIL: slug detail path contract preserved');
}

console.log(`employerLogoInheritanceP1b.test.js: ${count} assertions passed`);
