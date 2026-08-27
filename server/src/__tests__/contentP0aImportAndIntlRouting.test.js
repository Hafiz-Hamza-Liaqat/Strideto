/**
 * CONTENT-P0A — import publication parity + Intl Scholarship slug routing.
 * Run: node --experimental-vm-modules src/__tests__/contentP0aImportAndIntlRouting.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const read = (rel) => readFileSync(path.join(root, rel), 'utf8');

const cmsImport = await import(pathToFileURL(path.join(root, 'server/src/services/cmsImportPublication.js')).href);
const launch = await import(pathToFileURL(path.join(root, 'shared/cms/launchEligible.js')).href);

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const { deriveImportLaunchEligible, resolveImportCmsStatus, resolveImportCountryCode } = cmsImport;
const { CMS_STATUS } = launch;

// ── ADMISSION-IMPORT ─────────────────────────────────────────────────────────
check(
  deriveImportLaunchEligible({}, CMS_STATUS.ACTIVE) === true,
  'ADMISSION-IMPORT-01 valid imported public Admission receives correctly derived launchEligible',
);
check(
  deriveImportLaunchEligible({}, CMS_STATUS.DRAFT) === false,
  'ADMISSION-IMPORT-02 imported draft/non-public Admission is not falsely launchEligible',
);
check(
  deriveImportLaunchEligible({ launchEligible: true, isFixture: true }, CMS_STATUS.ACTIVE) === false,
  'ADMISSION-IMPORT-02b fixture active stays ineligible',
);
check(
  deriveImportLaunchEligible({ launchEligible: true }, CMS_STATUS.ACTIVE) === true,
  'ADMISSION-IMPORT-03 imported launchEligible=true cannot bypass policy when status active (derived true)',
);
check(
  deriveImportLaunchEligible({ launchEligible: true }, CMS_STATUS.DRAFT) === false,
  'ADMISSION-IMPORT-03b imported launchEligible=true ignored when draft',
);
check(
  resolveImportCountryCode({ countryCode: 'PK' }) === 'PK',
  'ADMISSION-IMPORT-04 countryCode round-trips when valid',
);
check(
  resolveImportCountryCode({ country: 'Pakistan' }) === 'PK',
  'ADMISSION-IMPORT-04b country name maps to code when recognized',
);
check(
  resolveImportCountryCode({ countryCode: 'NOT-A-CODE' }) === '',
  'ADMISSION-IMPORT-05 invalid country returns empty',
);
check(
  resolveImportCountryCode({}) === '',
  'ADMISSION-IMPORT-05b missing country returns empty',
);

const importHandlers = read('server/src/services/importHandlers.js');
check(importHandlers.includes('deriveImportLaunchEligible'), 'ADMISSION-IMPORT-06 import uses launch derivation helper');
check(importHandlers.includes("onContentSaved('admissions'"), 'ADMISSION-IMPORT-06b admission import triggers onContentSaved');
check(importHandlers.includes('resolveImportCountryCode'), 'ADMISSION-IMPORT-04c import maps countryCode');

// ── SCHOLARSHIP-IMPORT ───────────────────────────────────────────────────────
check(
  deriveImportLaunchEligible({}, CMS_STATUS.ACTIVE) === true,
  'SCHOLARSHIP-IMPORT-01 launchEligible derived correctly for active',
);
check(
  deriveImportLaunchEligible({ launchEligible: true }, CMS_STATUS.DRAFT) === false,
  'SCHOLARSHIP-IMPORT-02 input cannot force launchEligible when draft',
);
check(
  deriveImportLaunchEligible({}, CMS_STATUS.DRAFT) === false,
  'SCHOLARSHIP-IMPORT-03 draft/non-public records stay non-public',
);
check(
  deriveImportLaunchEligible({ isFixture: true, launchEligible: true }, CMS_STATUS.ACTIVE) === false,
  'SCHOLARSHIP-IMPORT-04 fixture exclusions remain intact',
);
check(importHandlers.includes("onContentSaved('scholarships'"), 'SCHOLARSHIP-IMPORT-05 content saved/index hook parity preserved');

// ── IMPORT-STATUS ─────────────────────────────────────────────────────────────
check(resolveImportCmsStatus({ status: 'active' }) === CMS_STATUS.ACTIVE, 'IMPORT-STATUS-01 valid active accepted');
check(resolveImportCmsStatus({ status: 'draft' }) === CMS_STATUS.DRAFT, 'IMPORT-STATUS-02 valid draft accepted');
check(resolveImportCmsStatus({ status: 'closed' }) === CMS_STATUS.CLOSED, 'IMPORT-STATUS-03 valid closed accepted');
assert.throws(
  () => resolveImportCmsStatus({ status: 'bogus' }),
  /Invalid status.*bogus/,
  'IMPORT-STATUS-04 explicit invalid status throws instead of resolving active',
);
check(resolveImportCmsStatus({ status: 'ACTIVE' }) === CMS_STATUS.ACTIVE, 'IMPORT-STATUS-05 case normalization for active');
check(resolveImportCmsStatus({ status: ' Draft ' }) === CMS_STATUS.DRAFT, 'IMPORT-STATUS-05b case normalization for draft');
check(resolveImportCmsStatus({}) === CMS_STATUS.ACTIVE, 'IMPORT-STATUS-06 omitted status defaults to active');
check(resolveImportCmsStatus({ status: '' }) === CMS_STATUS.ACTIVE, 'IMPORT-STATUS-06b blank status defaults to active');
check(resolveImportCmsStatus({ status: '   ' }) === CMS_STATUS.ACTIVE, 'IMPORT-STATUS-06c whitespace-only status defaults to active');
check(
  deriveImportLaunchEligible({ launchEligible: true }, 'bogus') === false,
  'IMPORT-STATUS-07 invalid Admission import row cannot become launchEligible',
);
check(
  deriveImportLaunchEligible({ launchEligible: true }, 'bogus') === false,
  'IMPORT-STATUS-08 invalid Scholarship import row cannot become launchEligible',
);

// ── INTL-SEO routing contracts ────────────────────────────────────────────────
const intlCtrl = read('server/src/controllers/intlScholarshipsController.js');
const intlRoutes = read('server/src/routes/intlScholarships.js');
const intlList = read('client/src/pages/IntlScholarships/IntlScholarships.jsx');
const intlDetail = read('client/src/pages/IntlScholarships/IntlScholarshipDetail.jsx');
const intlAdmin = read('client/src/pages/Admin/AdminIntlScholarships.jsx');
const seoCtrl = read('server/src/controllers/seoController.js');
const adminIntlCtrl = read('server/src/controllers/admin/adminIntlScholarshipsController.js');

check(intlList.includes('item.slug || item._id') || intlList.includes('intlScholarshipPath'),
  'INTL-SEO-01 public list prefers slug links');
check(intlCtrl.includes('findPublicIntlScholarship'), 'INTL-SEO-02 detail resolves by slug helper');
check(intlCtrl.includes('slug: idOrSlug'), 'INTL-SEO-02b slug lookup in public controller');
check(intlCtrl.includes("status: PUBLIC_STATUS") || intlCtrl.includes("status: 'active'"),
  'INTL-SEO-05 public detail filters active status');
check(seoCtrl.includes('/intl-scholarships/${s.slug}'), 'INTL-SEO-03 sitemap emits slug URLs');
check(intlDetail.includes('item.slug') && intlDetail.includes('canonicalPath'),
  'INTL-SEO-04 canonical uses slug path');
check(intlDetail.includes('navigate') && intlDetail.includes('replace: true'),
  'INTL-SEO-07 ObjectId compatibility redirects to canonical slug');
check(intlCtrl.includes('isObjectIdParam'), 'INTL-SEO-07b ObjectId detection on server');
check(intlCtrl.includes('canonicalSlug'), 'INTL-SEO-07c API exposes canonicalSlug for legacy ObjectId fetch');
check(seoCtrl.includes("IntlScholarship.find({ status: 'active'"), 'INTL-SEO-06 sitemap only queries active intl scholarships');
check(adminIntlCtrl.includes('delete source.slug'), 'INTL-SEO-08 duplicate clears slug before regeneration');
check(adminIntlCtrl.includes("applyResolvedSlug('intl-scholarship'"), 'INTL-SEO-08b duplicate regenerates unique slug');
check(intlRoutes.includes(':idOrSlug'), 'INTL-SEO-02c route param accepts slug or id');
check(intlAdmin.includes('row.slug ?'), 'INTL-SEO-01b admin view public uses slug href');
check(intlCtrl.includes('return res.status(404)'), 'INTL-SEO-09 invalid slug returns controlled not-found');

console.log(`contentP0aImportAndIntlRouting.test.js: ${count} assertions passed`);
