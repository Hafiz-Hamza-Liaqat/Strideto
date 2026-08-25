/**
 * Admission publication hotfix — live production regression (Phase 9 post-deploy).
 * Run: node src/__tests__/admissionPublicationHotfix.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const read = (rel) => readFileSync(path.join(root, rel), 'utf8');

const launch = await import(pathToFileURL(path.join(root, 'shared/cms/launchEligible.js')).href);
const readiness = await import(pathToFileURL(path.join(root, 'shared/cms/publicReadiness.js')).href);
const fixture = await import(pathToFileURL(path.join(root, 'shared/publicDiscovery/fixtureExclusion.js')).href);

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const { deriveCmsLaunchEligible, CMS_STATUS } = launch;
const { isAdmissionPublicReady } = readiness;
const { withFixtureExclusion, isFixtureRecord } = fixture;

// ── ADM-LIVE server derivation ───────────────────────────────────────────────
check(
  deriveCmsLaunchEligible({ status: CMS_STATUS.DRAFT, launchEligible: false }, CMS_STATUS.ACTIVE) === true,
  'ADM-LIVE-01 draft+false → active reconciles to launchEligible true'
);
check(
  deriveCmsLaunchEligible({ status: CMS_STATUS.ACTIVE, launchEligible: false }, CMS_STATUS.ACTIVE) === true,
  'ADM-LIVE-02 historical active+false re-save reconciles to true'
);
check(
  deriveCmsLaunchEligible({ status: CMS_STATUS.ACTIVE, isFixture: true, launchEligible: false }, CMS_STATUS.ACTIVE) === false,
  'ADM-LIVE-03 active fixture stays ineligible'
);
check(
  deriveCmsLaunchEligible({ status: CMS_STATUS.ACTIVE, launchEligible: false }, CMS_STATUS.ACTIVE) === true,
  'ADM-LIVE-04 server derivation wins over client launchEligible=false intent'
);
check(
  deriveCmsLaunchEligible({ status: CMS_STATUS.DRAFT, launchEligible: false }, CMS_STATUS.DRAFT) === false,
  'ADM-LIVE-05 draft stays ineligible even if client sends launchEligible=true path blocked'
);
check(
  deriveCmsLaunchEligible({ status: CMS_STATUS.DRAFT, launchEligible: false }, CMS_STATUS.DRAFT) === false,
  'ADM-LIVE-06 duplicate pattern draft+false'
);

const prodDetailFilter = withFixtureExclusion({ status: CMS_STATUS.ACTIVE, slug: 'sample-slug' }, { NODE_ENV: 'production' });
check(JSON.stringify(prodDetailFilter).includes('"launchEligible":true'), 'ADM-LIVE-07 public detail requires launchEligible true');
check(
  isAdmissionPublicReady({ status: CMS_STATUS.ACTIVE, launchEligible: true, slug: 'x' }) === true,
  'ADM-LIVE-07b public readiness when active+eligible+slug'
);
check(
  isAdmissionPublicReady({ status: CMS_STATUS.ACTIVE, launchEligible: false, slug: 'x' }) === false,
  'ADM-LIVE-08 public readiness rejects active+false'
);

// Fixture classification — title strings never classify
check(
  isFixtureRecord({ program: 'BS Computer Science — Platform Preview', institution: 'STRIDETO Demo University' }) === false,
  'production sample titles are not fixture by name alone'
);

// Controller does not trust client launchEligible
const admCtrl = read('server/src/controllers/admin/adminAdmissionsController.js');
check(!admCtrl.includes('body.launchEligible'), 'ADM-LIVE-04b client launchEligible not applied from body');
check(admCtrl.includes('syncAdmissionLaunchEligible'), 'update path re-derives launchEligible');

// Duplicate stays draft + false
check(admCtrl.includes('source.launchEligible = false') && admCtrl.includes("source.status = CMS_STATUS.DRAFT"), 'ADM-LIVE-06 duplicate wiring');

// ── ADM-VIEW UI readiness ─────────────────────────────────────────────────────
const viewPublic = read('client/src/components/admin/AdminViewPublicLink.jsx');
const adminAdmissions = read('client/src/pages/Admin/AdminContentAdmissions.jsx');
const slugField = read('client/src/components/admin/AdminSlugField.jsx');

function viewReady(record, status) {
  const merged = { ...record, status: status ?? record.status };
  return isAdmissionPublicReady(merged);
}

check(viewReady({ status: CMS_STATUS.ACTIVE, launchEligible: false, slug: 'x' }) === false, 'ADM-VIEW-01 table/slug disabled when active+false');
check(viewReady({ status: CMS_STATUS.ACTIVE, launchEligible: true, slug: 'x' }) === true, 'ADM-VIEW-02 enabled when active+true');
check(viewReady({ status: CMS_STATUS.DRAFT, slug: 'x' }) === false, 'ADM-VIEW-03 draft disabled');

check(adminAdmissions.includes('isAdminSlugPreviewReady'), 'ADM-VIEW-01b edit form wires publicPreviewReady');
check(adminAdmissions.includes("publicPreviewReady={isAdminSlugPreviewReady('admission'"), 'ADM-VIEW-01c AdminSlugField uses shared readiness');
check(slugField.includes('publicPreviewReady === true'), 'ADM-VIEW-04 slug field requires explicit publicPreviewReady true');
check(viewPublic.includes('isAdmissionPublicReady'), 'ADM-VIEW shared readiness helper for admission');

console.log(`admissionPublicationHotfix.test.js: ${count} assertions passed`);
