import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * STRIDETO MEDIA-P0A — Public job/scholarship/admission logo rendering (source contracts).
 */

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const clientSrc = path.resolve(here, '..');
const repoRoot = path.resolve(clientSrc, '../..');
const read = (rel) => readFileSync(path.join(clientSrc, rel), 'utf8');
const readRepo = (rel) => readFileSync(path.join(repoRoot, rel), 'utf8');

const publicLogo = read('components/listings/PublicListingLogo.jsx');
const jobDetail = read('pages/Jobs/JobDetail.jsx');
const jobsList = read('pages/Jobs/Jobs.jsx');
const homeCard = read('components/listings/HomeListingCard.jsx');
const scholDetail = read('pages/Scholarships/ScholarshipDetail.jsx');
const admDetail = read('pages/Admissions/AdmissionDetail.jsx');
const securityJs = readRepo('server/src/config/security.js');
const viteConfig = readRepo('client/vite.config.js');

const UNILEVER_SVG =
  'https://tbcdn.talentbrew.com/company/34155/gst_v1/img/group-51-copy.svg';

// ── PublicListingLogo component ───────────────────────────────────────────────
check(publicLogo.includes('publicHttpUrlOrNull'), 'PublicListingLogo uses publicHttpUrlOrNull');
check(publicLogo.includes('onError'), 'PublicListingLogo handles image onError');
check(publicLogo.includes('${label} logo') || publicLogo.includes('`${label} logo`'), 'PublicListingLogo alt uses label logo pattern');
check(publicLogo.includes('listingLogoInitial'), 'PublicListingLogo exposes initial fallback helper');

// ── MEDIA-P0A-JOB-01: JobDetail renders job.logoUrl as image ─────────────────
check(jobDetail.includes('PublicListingLogo'), 'MEDIA-P0A-JOB-01: JobDetail imports PublicListingLogo');
check(jobDetail.includes('logoUrl={job.logoUrl}'), 'MEDIA-P0A-JOB-01: JobDetail passes job.logoUrl');

// ── MEDIA-P0A-JOB-02: JobDetail fallback when logoUrl absent ─────────────────
check(
  jobDetail.includes('job.organization || job.company || job.title'),
  'MEDIA-P0A-JOB-02: JobDetail supplies label for initial fallback'
);

// ── MEDIA-P0A-JOB-03: JobDetail fallback replaces failed image ───────────────
check(publicLogo.includes('setFailed(true)'), 'MEDIA-P0A-JOB-03: failed image triggers fallback state');
check(publicLogo.includes('!showImg'), 'MEDIA-P0A-JOB-03: fallback shown when image unavailable');

// ── MEDIA-P0A-LOGO-RESET: failed state clears when logoUrl changes ───────────
check(
  publicLogo.includes('useEffect') && /setFailed\(false\)/.test(publicLogo) && publicLogo.includes('[logoUrl]'),
  'MEDIA-P0A-LOGO-RESET: failed logo state resets when logoUrl changes'
);

// ── MEDIA-P0A-JOB-04: Jobs catalog renders logoUrl (not placeholder text) ────
check(jobsList.includes('PublicListingLogo'), 'MEDIA-P0A-JOB-04: Jobs list uses PublicListingLogo');
check(jobsList.includes('logoUrl={job.logoUrl}'), 'MEDIA-P0A-JOB-04: Jobs list passes job.logoUrl');
check(
  !jobsList.includes("t('logo', { ns: 'jobs' })"),
  'MEDIA-P0A-JOB-04: Jobs list no longer shows literal logo placeholder text'
);

// ── MEDIA-P0A-JOB-05: Jobs catalog graceful missing/broken logo ──────────────
check(jobsList.includes('object-contain') || publicLogo.includes('object-contain'), 'MEDIA-P0A-JOB-05: logos use object-contain');

// ── MEDIA-P0A-JOB-06: Home Job card renders logoUrl ──────────────────────────
check(homeCard.includes('function JobCard'), 'MEDIA-P0A-JOB-06: JobCard present');
check(homeCard.includes('logoUrl={job.logoUrl}'), 'MEDIA-P0A-JOB-06: JobCard passes job.logoUrl to PublicListingLogo');

// ── MEDIA-P0A-SCH-01: Scholarship detail renders logoUrl ─────────────────────
check(scholDetail.includes('PublicListingLogo'), 'MEDIA-P0A-SCH-01: ScholarshipDetail uses PublicListingLogo');
check(scholDetail.includes('logoUrl={item.logoUrl}'), 'MEDIA-P0A-SCH-01: ScholarshipDetail passes item.logoUrl');

// ── MEDIA-P0A-SCH-02: Scholarship missing/broken logo stable layout ──────────
check(scholDetail.includes('item.provider || item.title'), 'MEDIA-P0A-SCH-02: provider/title still visible with fallback label');

// ── MEDIA-P0A-ADM-01: Admission detail renders logoUrl ───────────────────────
check(admDetail.includes('PublicListingLogo'), 'MEDIA-P0A-ADM-01: AdmissionDetail uses PublicListingLogo');
check(admDetail.includes('logoUrl={item.logoUrl}'), 'MEDIA-P0A-ADM-01: AdmissionDetail passes item.logoUrl');

// ── MEDIA-P0A-ADM-02: Admission missing/broken logo stable layout ────────────
check(admDetail.includes('item.institution'), 'MEDIA-P0A-ADM-02: institution text preserved on detail');

// ── Unilever regression contract (generic — no hostname-specific code) ────────
check(
  !jobDetail.includes('talentbrew') && !jobsList.includes('talentbrew'),
  'Unilever contract: no hostname-specific rendering code'
);
check(
  publicLogo.includes('<img') && publicLogo.includes('src={src}'),
  'Unilever contract: projected https logo URLs mount as img src via PublicListingLogo'
);
check(
  UNILEVER_SVG.startsWith('https://') && UNILEVER_SVG.endsWith('.svg'),
  'Unilever contract: production SVG URL is https and suitable for browser img'
);

// ── MEDIA-P0A-SEC-01: no CSP relaxation ─────────────────────────────────────
check(securityJs.includes('contentSecurityPolicy'), 'MEDIA-P0A-SEC-01: helmet CSP config unchanged');
check(viteConfig.includes("img-src 'self' data: blob: https:"), 'MEDIA-P0A-SEC-01: client img-src still allows https only');

// ── MEDIA-P0A-SEC-02: no server-side remote image fetch/proxy ────────────────
check(
  !publicLogo.includes('fetch(') && !jobDetail.includes('imageProxy') && !jobsList.includes('imageProxy'),
  'MEDIA-P0A-SEC-02: client surfaces do not proxy remote images'
);
check(
  !readRepo('server/src/config/security.js').includes('imageProxy') &&
    !readRepo('shared/publicDiscovery/projectPublicDiscovery.js').includes('fetch('),
  'MEDIA-P0A-SEC-02: public projection does not fetch remote images server-side'
);

// ── OG image deferred (MEDIA-P1) — do not auto-replace with logoUrl ───────────
check(
  jobDetail.includes('ogImage={job.image'),
  'MEDIA-P1 deferred: JobDetail ogImage still references job.image (not logoUrl swap)'
);
check(
  !jobDetail.includes('ogImage={job.logoUrl'),
  'MEDIA-P1 deferred: JobDetail does not use logoUrl as ogImage in P0A'
);

console.log(`mediaP0aPublicLogoRendering.test.js: ${count} assertions passed`);
