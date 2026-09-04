import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  QUALIFYING_USER_EVENTS,
  INVESTOR_METRIC_DEFINITIONS,
  boundedInvestorRange,
} from '../../../shared/analytics/investorMetrics.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const read = (file) => readFileSync(join(root, file), 'utf8');

test('IR-09 qualifying activity excludes passive delivery events', () => {
  assert.ok(QUALIFYING_USER_EVENTS.includes('application_created'));
  assert.ok(QUALIFYING_USER_EVENTS.includes('job_view'));
  assert.ok(!QUALIFYING_USER_EVENTS.includes('page_view'));
  assert.ok(!QUALIFYING_USER_EVENTS.includes('search'));
});

test('IR-34/35/36 revenue and missing-data definitions are explicit', () => {
  assert.match(INVESTOR_METRIC_DEFINITIONS.completedPayments, /currency/i);
  assert.match(INVESTOR_METRIC_DEFINITIONS.externalApplyClicks, /does not prove/i);
  assert.match(INVESTOR_METRIC_DEFINITIONS.retention, /cohort/i);
});

test('IR-49 date range is bounded to 7, 30, or 90 days', () => {
  assert.equal(boundedInvestorRange(7), 7);
  assert.equal(boundedInvestorRange(30), 30);
  assert.equal(boundedInvestorRange(90), 90);
  assert.equal(boundedInvestorRange(365), 30);
});

test('IR-44/45 investor API and UI contain no arbitrary user lookup or raw query export', () => {
  const controller = read('server/src/controllers/admin/investorReadinessController.js');
  const page = read('client/src/pages/Admin/InvestorReadinessDashboard.jsx');
  assert.doesNotMatch(controller, /req\.query\.userId|req\.query\.email/);
  assert.doesNotMatch(page, /raw search|user email|private profile/i);
  assert.match(page, /NOT YET MEASURED/);
});

test('IR-51/52/53 investor route is SuperAdmin-only and has four responsive tabs', () => {
  const route = read('server/src/routes/admin.js');
  const page = read('client/src/pages/Admin/InvestorReadinessDashboard.jsx');
  const rbac = read('server/src/config/rbac.js');
  assert.match(route, /investor-readiness.*INVESTOR_READ/);
  assert.match(rbac, /INVESTOR_READ/);
  assert.match(page, /Overview.*Traction.*Business Readiness.*Fundraising Readiness/);
  assert.match(page, /grid-cols-2/);
  assert.match(page, /md:flex/);
});

test('IR-57 existing analytics dashboards remain wired to their original endpoints', () => {
  const api = read('client/src/services/listingsService.js');
  assert.match(api, /growthDashboard/);
  assert.match(api, /executiveDashboard/);
});
