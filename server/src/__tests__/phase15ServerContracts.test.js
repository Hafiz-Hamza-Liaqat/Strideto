import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  isFixtureRecord,
  isLaunchProjection,
  withFixtureExclusion,
} from '../../../shared/publicDiscovery/fixtureExclusion.js';
import { isValidTransition, VERIFICATION_STATUSES as VS } from '../../../shared/international/verification.js';

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(path.resolve(here, '..', rel), 'utf8');

check(isFixtureRecord({ isFixture: true }) === true, 'explicit isFixture is a fixture');
check(isFixtureRecord({ title: 'P13 ACCEPTANCE' }) === false, 'title string matching is not used');
check(isLaunchProjection({ NODE_ENV: 'production' }) === true, 'production is launch projection');
check(isLaunchProjection({ NODE_ENV: 'development' }) === false, 'local development includes fixtures unless forced');
check(withFixtureExclusion({ status: 'active' }, { NODE_ENV: 'production' }).$and.some((p) => p.launchEligible === true), 'production filter requires launchEligible true');

check(isValidTransition(VS.REVOKED, VS.VERIFICATION_PENDING) === true, 'revoked → new attempt');
check(isValidTransition(VS.REVOKED, VS.APPROVED) === false, 'revoked does not resurrect approved');
check(isValidTransition(VS.NEEDS_INFORMATION, VS.NEEDS_INFORMATION) === false, 'same-state needs_information is not a machine transition');

const handler = read('middleware/errorHandler.js');
check(/status !== 422 && status !== 409/.test(handler), '422/409 pass through');
check(/err.code/.test(handler), 'error codes are preserved');

const consult = read('services/consultationService.js');
check(/SLOT_UNAVAILABLE/.test(consult) && /SLOT_CONFLICT/.test(consult), 'consultation conflict codes exist');

const ver = read('services/verificationService.js');
check(/noStatusChange: true/.test(ver), 'needs_information update does not applyTransition');
check(/isNewAttempt = fromStatus === VS\.REVOKED/.test(ver), 'revoked submit is a new attempt');

const alerts = readFileSync(path.resolve(here, '../../../client/src/pages/Admin/AlertsAdmin.jsx'), 'utf8');
check(/not_configured/.test(alerts) && !/Send Telegram alert/.test(alerts), 'alerts UI does not advertise unconfigured Telegram send');

console.log(`phase15ServerContracts.test.js: ${count} assertions passed`);
