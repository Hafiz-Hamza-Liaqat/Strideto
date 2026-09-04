import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { requirePermission } from '../middleware/rbac.js';
import { PERMISSIONS } from '../config/rbac.js';
import { User } from '../models/User.js';
import { Employer } from '../models/Employer.js';
import { Job } from '../models/Job.js';
import { Application } from '../models/Application.js';
import { Payment } from '../models/Payment.js';
import { AnalyticsEvent } from '../models/AnalyticsEvent.js';
import { SearchQueryLog } from '../models/SearchQueryLog.js';
import { getInvestorReadiness } from '../services/analytics/InvestorReadinessService.js';
import { investorReadinessInternals } from '../services/analytics/InvestorReadinessService.js';
import { recordAnalyticsEvent } from '../services/analytics/AnalyticsEventService.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const read = (file) => readFileSync(join(root, file), 'utf8');

function responseSpy() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function withMethods(overrides, fn) {
  const originals = [];
  const modelMap = { User, Employer, Job, Application, Payment, AnalyticsEvent, SearchQueryLog };
  for (const [modelName, methods] of Object.entries(overrides)) {
    const model = modelMap[modelName];
    for (const [name, implementation] of Object.entries(methods)) {
      originals.push([model, name, model[name]]);
      model[name] = implementation;
    }
  }
  return Promise.resolve().then(fn).finally(() => {
    for (const [model, name, original] of originals) model[name] = original;
  });
}

function investorFixtures() {
  const calls = [];
  const daily = [{ _id: '2026-09-04', value: 2 }];
  const aggregate = function aggregate(pipeline) {
    calls.push({ model: this.modelName, pipeline });
    if (this === AnalyticsEvent && pipeline.some((stage) => stage.$count)) return Promise.resolve([{ value: 3 }]);
    return Promise.resolve(daily);
  };
  return {
    calls,
    overrides: {
      User: {
        countDocuments: async (filter) => {
          calls.push({ method: 'User.countDocuments', filter });
          if (filter['attribution.utmSource']) return 0;
          return filter.emailVerified ? 8 : 12;
        },
        distinct: async () => ['u1', 'u2'],
        aggregate,
      },
      Employer: {
        countDocuments: async () => 4,
        distinct: async () => ['e1'],
        aggregate,
      },
      Job: {
        countDocuments: async (filter) => {
          calls.push({ method: 'Job.countDocuments', filter });
          return filter.status === 'active' ? 5 : 7;
        },
        distinct: async () => ['e1'],
        aggregate,
      },
      Application: { countDocuments: async () => 3, aggregate },
      Payment: { aggregate: async () => ([
        { _id: { currency: 'PKR', status: 'completed' }, amount: 1000, count: 1 },
        { _id: { currency: 'USD', status: 'completed' }, amount: 20, count: 1 },
        { _id: { currency: 'PKR', status: 'refunded' }, amount: 100, count: 1 },
      ]) },
      AnalyticsEvent: {
        distinct: async () => ['u1', 'u1', 'u2'],
        countDocuments: async () => 2,
        aggregate,
        create: async (payload) => payload,
      },
      SearchQueryLog: {
        countDocuments: async (filter) => filter.resultCount === 0 ? 2 : 10,
        aggregate,
      },
    },
  };
}

test('IR-01..04 investor permission middleware is SuperAdmin-only at runtime', async () => {
  const middleware = requirePermission(PERMISSIONS.INVESTOR_READ);
  for (const [role, status] of [['SuperAdmin', 200], ['Admin', 403], ['User', 403], [null, 401]]) {
    const req = { user: role ? { role } : undefined };
    const res = responseSpy();
    let called = false;
    middleware(req, res, () => { called = true; });
    assert.equal(called, role === 'SuperAdmin');
    assert.equal(res.statusCode, status);
  }
});

test('IR-05..09 investor service applies staff, fixture/demo, and production coverage filters', async () => {
  const fixtures = investorFixtures();
  const result = await withMethods(fixtures.overrides, () => getInvestorReadiness({ range: 30 }));
  const userCall = fixtures.calls.find((call) => call.method === 'User.countDocuments');
  const jobCalls = fixtures.calls.filter((call) => call.method === 'Job.countDocuments');
  assert.deepEqual(userCall.filter.role.$nin, ['Editor', 'Moderator', 'Admin', 'SuperAdmin']);
  assert.ok(jobCalls.every(({ filter }) => filter.isFixture.$ne === true && filter.demoOnly.$ne === true));
  assert.equal(result.dataQuality.testAccountCoverage, 'incomplete');
  assert.equal(result.coverage.activity.state, 'PARTIAL_COVERAGE');
  const eventFilter = fixtures.calls.find((call) => call.model === 'AnalyticsEvent' && call.pipeline?.[0]?.$match)?.pipeline?.[0]?.$match;
  assert.equal(eventFilter.environment, 'production');
});

test('IR-10..17 qualifying users are unique, passive events are excluded, and WAU/MAU windows are distinct', async () => {
  const fixtures = investorFixtures();
  const result = await withMethods(fixtures.overrides, () => getInvestorReadiness({ range: 30 }));
  assert.equal(result.overview.wau.value, 2);
  assert.equal(result.overview.mau.value, 2);
  const activityFilter = investorReadinessInternals.productionEventFilter({ start: new Date(0), end: new Date() });
  assert.deepEqual(activityFilter.eventType, { $in: ['job_view', 'scholarship_view', 'admission_view', 'university_view', 'blog_view', 'career_view', 'search_click', 'application_click', 'application_created', 'application_updated', 'bookmark'] });
  assert.equal(activityFilter.userId.$ne, null);
});

test('IR-18..27 activation and retention remain explicit non-numeric states', async () => {
  const fixtures = investorFixtures();
  const result = await withMethods(fixtures.overrides, () => getInvestorReadiness({ range: 30 }));
  assert.equal(result.overview.activatedUsers.value, null);
  assert.equal(result.overview.activatedUsers.state, 'NOT_YET_MEASURED');
  assert.equal(result.traction.retention.d1.value, null);
  assert.equal(result.traction.retention.d7.value, null);
  assert.equal(result.traction.retention.d30.value, null);
  assert.notEqual(result.traction.retention.d30.state, 'TRUSTED');
});

test('IR-28..42 employer, Job, application, and external-click metrics remain bounded and distinct', async () => {
  const fixtures = investorFixtures();
  const result = await withMethods(fixtures.overrides, () => getInvestorReadiness({ range: 30 }));
  assert.equal(result.overview.eligibleEmployers.value, 4);
  assert.equal(result.overview.employersWithPublishedJobs.value, 1);
  assert.equal(result.overview.internalApplications.value, 3);
  assert.equal(result.overview.externalApplyClicks.value, 3);
  assert.match(result.overview.externalApplyClicks.detail, /not completed applications/i);
  assert.equal(result.overview.publishedJobs.value, 7);
});

test('IR-43..48 search metrics are aggregate-only and source-bounded', async () => {
  const fixtures = investorFixtures();
  const result = await withMethods(fixtures.overrides, () => getInvestorReadiness({ range: 30 }));
  assert.equal(result.overview.searchVolume.value, 10);
  assert.equal(result.overview.zeroResultRate.value, 0.2);
  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /raw search query/i);
  assert.doesNotMatch(serialized, /"query"\s*:/i);
});

test('IR-49..57 revenue is grouped by currency and unsupported finance metrics stay unavailable', async () => {
  const fixtures = investorFixtures();
  const result = await withMethods(fixtures.overrides, () => getInvestorReadiness({ range: 30 }));
  const revenue = result.overview.revenueByCurrency.value;
  assert.deepEqual(revenue.map((row) => row.currency), ['PKR', 'USD', 'PKR']);
  assert.equal(result.businessReadiness.cac, 'NOT_MEASURED');
  assert.equal(result.businessReadiness.ltv, 'NOT_MEASURED');
  assert.doesNotMatch(JSON.stringify(result), /MRR|ARR/);
});

test('IR-58..63 attribution remains factual and does not upgrade missing durable history', async () => {
  const fixtures = investorFixtures();
  const result = await withMethods(fixtures.overrides, () => getInvestorReadiness({ range: 30 }));
  assert.equal(result.traction.acquisition.state, 'NOT_YET_MEASURED');
  assert.equal(result.traction.acquisition.totalRegistrations, 12);
  assert.equal(result.traction.acquisition.attributedRegistrations, 0);
  assert.equal(result.traction.acquisition.coverageRate, 0);
});

test('IR-64..69 event envelope gets an ID and ignores client environment/source spoofing', async () => {
  let created;
  await withMethods({ AnalyticsEvent: { create: async (payload) => { created = payload; return payload; } } }, () => recordAnalyticsEvent({ eventType: 'job_view', source: 'system', environment: 'production' }, {}));
  assert.match(created.eventId, /.+/);
  assert.equal(created.schemaVersion, '2');
  assert.equal(created.source, 'server');
  assert.equal(created.environment, process.env.NODE_ENV || 'development');
});

test('IR-70..75 investor ranges are bounded', async () => {
  const fixtures = investorFixtures();
  for (const range of [7, 30, 90, 99999]) {
    const result = await withMethods(fixtures.overrides, () => getInvestorReadiness({ range }));
    assert.ok([7, 30, 90].includes(result.range));
  }
});

test('IR-76..82 payload privacy and missing-data states are preserved', async () => {
  const fixtures = investorFixtures();
  const result = await withMethods(fixtures.overrides, () => getInvestorReadiness({ range: 30 }));
  const forbidden = /password|refreshToken|privateMessage|document contents|raw search query|user email/i;
  assert.doesNotMatch(JSON.stringify(result), forbidden);
  for (const state of ['TRUSTED', 'CONDITIONAL', 'PARTIAL_COVERAGE', 'NOT_YET_MEASURED', 'INSUFFICIENT_COVERAGE']) {
    assert.ok(JSON.stringify(result).includes(state) || state === 'TRUSTED');
  }
  assert.equal(result.overview.activatedUsers.value, null);
});

test('IR-83..100 dashboard states, currency separation, and fundraising boundary are visible', () => {
  const page = read('client/src/pages/Admin/InvestorReadinessDashboard.jsx');
  assert.match(page, /Overview/);
  assert.match(page, /Traction/);
  assert.match(page, /Business Readiness/);
  assert.match(page, /Fundraising Readiness/);
  assert.match(page, /External Apply Clicks/);
  assert.match(page, /NOT YET MEASURED/);
  assert.match(page, /metric\.state|replaceAll\('_', ' '\)/);
  assert.match(page, /revenueByCurrency/);
  assert.match(page, /not_tracked|NOT_TRACKED/);
  assert.match(page, /loading/);
  assert.match(page, /role="alert"/);
  assert.doesNotMatch(page, /localStorage/);
  assert.doesNotMatch(page, /search.*query.*map/i);
});

test('IR-101..104 investor service uses bounded server-side aggregation without per-user loops', () => {
  const source = read('server/src/services/analytics/InvestorReadinessService.js');
  assert.match(source, /createdAt:\s*\{\s*\$gte:\s*start/);
  assert.match(source, /aggregate\(\[/);
  assert.doesNotMatch(source, /for\s*\(.*User|forEach\(.*User/i);
  assert.match(source, /boundedInvestorRange/);
});
