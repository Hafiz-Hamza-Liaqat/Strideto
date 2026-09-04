import { AnalyticsEvent } from '../../models/AnalyticsEvent.js';
import { SearchQueryLog } from '../../models/SearchQueryLog.js';
import { User } from '../../models/User.js';
import { Employer } from '../../models/Employer.js';
import { Job } from '../../models/Job.js';
import { Application } from '../../models/Application.js';
import { Payment } from '../../models/Payment.js';
import {
  INVESTOR_ANALYTICS_SCHEMA_VERSION,
  QUALIFYING_USER_EVENTS,
  INVESTOR_METRIC_DEFINITIONS,
  boundedInvestorRange,
  metricState,
} from '../../../../shared/analytics/investorMetrics.js';

const STAFF_ROLES = ['Editor', 'Moderator', 'Admin', 'SuperAdmin'];

function rangeBounds(days) {
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  return { start, end };
}

function productionEventFilter({ start, end }) {
  return {
    createdAt: { $gte: start, $lt: end },
    eventType: { $in: QUALIFYING_USER_EVENTS },
    userId: { $ne: null },
    // V2 events identify production explicitly. Historical events are kept
    // visible as partial coverage rather than silently upgraded to trusted.
    environment: 'production',
  };
}

function eligibleUserFilter() {
  return { role: { $nin: STAFF_ROLES }, accountStatus: { $ne: 'suspended' } };
}

function coverageForEvents() {
  return metricState(
    'PARTIAL_COVERAGE',
    'v2-only',
    'Historical events without an explicit production environment are excluded from investor activity metrics.'
  );
}

async function distinctQualifyingUsers(bounds) {
  const ids = await AnalyticsEvent.distinct('userId', productionEventFilter(bounds));
  if (!ids.length) return [];
  return User.distinct('_id', { _id: { $in: ids }, ...eligibleUserFilter() });
}

async function distinctEventCount(match) {
  const rows = await AnalyticsEvent.aggregate([
    { $match: match },
    { $group: { _id: { $ifNull: ['$eventId', '$_id'] } } },
    { $count: 'value' },
  ]);
  return rows[0]?.value || 0;
}

async function trend(Model, match, days, field = 'createdAt') {
  const { start, end } = rangeBounds(days);
  const rows = await Model.aggregate([
    { $match: { ...match, [field]: { $gte: start, $lt: end } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: `$${field}` } }, value: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  return rows.map((row) => ({ date: row._id, value: row.value }));
}

async function paymentSummary(bounds) {
  const rows = await Payment.aggregate([
    { $match: { createdAt: { $gte: bounds.start, $lt: bounds.end }, status: { $in: ['completed', 'refunded'] } } },
    { $group: { _id: { currency: '$currency', status: '$status' }, amount: { $sum: '$amount' }, count: { $sum: 1 } } },
    { $sort: { '_id.currency': 1, '_id.status': 1 } },
  ]);
  return rows.map((row) => ({ currency: row._id.currency || 'unknown', status: row._id.status, amount: row.amount, count: row.count }));
}

export async function getInvestorReadiness({ range = 30 } = {}) {
  const days = boundedInvestorRange(range);
  const bounds = rangeBounds(days);
  const userFilter = eligibleUserFilter();
  const eventFilter = productionEventFilter(bounds);
  const [, weeklyUsers, monthlyUsers] = await Promise.all([
    distinctQualifyingUsers(bounds),
    distinctQualifyingUsers(rangeBounds(7)),
    distinctQualifyingUsers(rangeBounds(30)),
  ]);

  const [registeredUsers, verifiedUsers, activeJobs, publishedJobs, eligibleEmployers,
    verifiedEmployers, employersWithJobs, internalApplications, externalApplyClicks,
    searches, zeroResultSearches, attributedRegistrations, paymentSummaryRows,
    registrationTrend] = await Promise.all([
    User.countDocuments(userFilter),
    User.countDocuments({ ...userFilter, emailVerified: true }),
    Job.countDocuments({ status: 'active', publicationState: 'active', isFixture: { $ne: true }, demoOnly: { $ne: true } }),
    Job.countDocuments({ publicationState: 'active', isFixture: { $ne: true }, demoOnly: { $ne: true } }),
    Employer.countDocuments({ accountStatus: 'active' }),
    Employer.countDocuments({ accountStatus: 'active', $or: [{ verified: true }, { verificationLevel: { $in: ['verified', 'trusted'] } }] }),
    Job.distinct('employerId', { publicationState: 'active', employerId: { $ne: null }, isFixture: { $ne: true }, demoOnly: { $ne: true } }),
    Application.countDocuments({ createdAt: { $gte: bounds.start, $lt: bounds.end } }),
    distinctEventCount({ ...eventFilter, eventType: 'application_click' }),
    SearchQueryLog.countDocuments({ createdAt: { $gte: bounds.start, $lt: bounds.end }, source: { $in: ['public', 'suggestions'] } }),
    SearchQueryLog.countDocuments({ createdAt: { $gte: bounds.start, $lt: bounds.end }, source: { $in: ['public', 'suggestions'] }, resultCount: 0 }),
    // Durable attribution is not yet present on User; remain truthful.
    User.countDocuments({ ...userFilter, 'attribution.utmSource': { $exists: true, $ne: '' } }),
    paymentSummary(bounds),
    trend(User, userFilter, days),
  ]);

  const activeEmployers = await Job.distinct('employerId', {
    publicationState: 'active',
    employerId: { $ne: null },
    isFixture: { $ne: true },
    demoOnly: { $ne: true },
    updatedAt: { $gte: bounds.start, $lt: bounds.end },
  });

  const metric = (value, state = 'CONDITIONAL', coverage = 'complete', detail = '') => ({ value, ...metricState(state, coverage, detail) });
  const activityState = coverageForEvents();
  const attributionCoverage = registeredUsers ? attributedRegistrations / registeredUsers : null;

  return {
    generatedAt: new Date().toISOString(),
    range: days,
    analyticsSchemaVersion: INVESTOR_ANALYTICS_SCHEMA_VERSION,
    metricDefinitions: INVESTOR_METRIC_DEFINITIONS,
    coverage: {
      activity: activityState,
      historicalActivation: metricState('NOT_YET_MEASURED', 'none', 'No proven activation timestamp exists for historical cohorts.'),
      attribution: metricState('NOT_YET_MEASURED', 'new-only', 'Durable registration attribution is not yet persisted.'),
      opportunityEvents: metricState('PARTIAL_COVERAGE', 'family-dependent', 'Event coverage differs across opportunity families.'),
    },
    dataQuality: {
      testAccountCoverage: 'incomplete',
      historicalEnvironmentCoverage: 'incomplete',
      staffExcluded: true,
      fixtureAndDemoJobsExcluded: true,
      mixedCurrencySeparated: true,
      blockers: [
        'Universal test-account classification is incomplete.',
        'Historical analytics events lack explicit environment classification.',
        'Activation and retention history are not fully measured.',
      ],
    },
    overview: {
      registeredUsers: metric(registeredUsers, 'CONDITIONAL', 'eligible-user-filter'),
      verifiedUsers: metric(verifiedUsers, 'CONDITIONAL', 'eligible-user-filter'),
      activatedUsers: metric(null, 'NOT_YET_MEASURED', 'none', 'Canonical activation timestamps are not available.'),
      wau: metric(weeklyUsers.length, activityState.state, activityState.coverage, activityState.detail),
      mau: metric(monthlyUsers.length, activityState.state, activityState.coverage, activityState.detail),
      verifiedEmployers: metric(verifiedEmployers, 'CONDITIONAL', 'employer-state'),
      eligibleEmployers: metric(eligibleEmployers, 'CONDITIONAL', 'employer-state'),
      activeEmployers: metric(activeEmployers.length, 'CONDITIONAL', 'job-employer-links', 'Active means a verified/active employer with a recently updated published Job.'),
      employersWithPublishedJobs: metric(employersWithJobs.length, 'CONDITIONAL', 'job-employer-links'),
      publishedJobs: metric(publishedJobs, 'CONDITIONAL', 'publication-state'),
      activeJobs: metric(activeJobs, 'CONDITIONAL', 'publication-state'),
      internalApplications: metric(internalApplications, 'CONDITIONAL', 'Application'),
      externalApplyClicks: metric(externalApplyClicks, activityState.state, activityState.coverage, 'Tracked click-outs are not completed applications.'),
      searchVolume: metric(searches, 'CONDITIONAL', 'SearchQueryLog'),
      zeroResultRate: metric(searches ? zeroResultSearches / searches : null, 'CONDITIONAL', 'SearchQueryLog'),
      revenueByCurrency: metric(paymentSummaryRows, 'CONDITIONAL', 'Payment', 'Amounts are never combined across currencies.'),
    },
    traction: {
      registrations: registrationTrend,
      activeUsers: { dau: metric(null, 'NOT_YET_MEASURED', 'none', 'This response does not synthesize daily cohorts from weak historical events.'), wau: metric(weeklyUsers.length, activityState.state, activityState.coverage, activityState.detail), mau: metric(monthlyUsers.length, activityState.state, activityState.coverage, activityState.detail) },
      retention: { d1: metric(null, 'NOT_YET_MEASURED', 'none'), d7: metric(null, 'NOT_YET_MEASURED', 'none'), d30: metric(null, 'INSUFFICIENT_COVERAGE', 'none', 'Activation/cohort history is insufficient.') },
      employerGrowth: await trend(Employer, { accountStatus: 'active' }, days),
      publishedJobs: await trend(Job, { publicationState: 'active', isFixture: { $ne: true }, demoOnly: { $ne: true } }, days),
      internalApplications: await trend(Application, {}, days),
      externalApplyClicks: await trend(AnalyticsEvent, { ...eventFilter, eventType: 'application_click' }, days),
      searchVolume: await trend(SearchQueryLog, { source: { $in: ['public', 'suggestions'] } }, days),
      acquisition: { state: 'NOT_YET_MEASURED', coverage: 'none', attributedRegistrations, totalRegistrations: registeredUsers, coverageRate: attributionCoverage },
    },
    businessReadiness: {
      monetizationModel: 'PARTIAL', pricingValidation: 'PARTIAL', paidValidation: paymentSummaryRows.length ? 'PARTIAL' : 'NOT_MEASURED',
      employerValidation: employersWithJobs.length ? 'PARTIAL' : 'NOT_MEASURED', marketplaceValidation: internalApplications ? 'PARTIAL' : 'NOT_MEASURED',
      repeatBehavior: 'NOT_MEASURED', revenueReadiness: paymentSummaryRows.length ? 'PARTIAL' : 'NOT_MEASURED', cac: 'NOT_MEASURED', ltv: 'NOT_MEASURED', dataQuality: 'PARTIAL',
    },
    fundraisingReadiness: { state: 'NOT_TRACKED', items: [] },
  };
}

export const investorReadinessInternals = Object.freeze({ rangeBounds, eligibleUserFilter, productionEventFilter, distinctQualifyingUsers });
