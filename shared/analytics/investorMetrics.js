/**
 * Investor analytics contract. Keep definitions here so API, aggregation and
 * UI labels cannot silently drift apart.
 */
export const INVESTOR_ANALYTICS_SCHEMA_VERSION = '1';

export const INVESTOR_METRIC_STATES = Object.freeze([
  'TRUSTED',
  'CONDITIONAL',
  'PARTIAL_COVERAGE',
  'NOT_YET_MEASURED',
  'INSUFFICIENT_COVERAGE',
]);

export const QUALIFYING_USER_EVENTS = Object.freeze([
  'job_view',
  'scholarship_view',
  'admission_view',
  'university_view',
  'blog_view',
  'career_view',
  'search_click',
  'application_click',
  'application_created',
  'application_updated',
  'bookmark',
]);

export const INVESTOR_METRIC_DEFINITIONS = Object.freeze({
  registeredUsers: 'Eligible student accounts created through the selected period.',
  verifiedUsers: 'Eligible student accounts with verified email status.',
  activatedUsers: 'Verified users with a recorded onboarding milestone or qualifying product action.',
  activeUsers: 'Unique eligible users performing a qualifying product action in the selected period.',
  returningUsers: 'Eligible users with qualifying activity in the period who had qualifying activity before it.',
  internalApplications: 'Application records created inside STRIDETO; this does not include external click-outs.',
  externalApplyClicks: 'Tracked outbound apply actions; this does not prove an application was completed.',
  retention: 'Cohort users performing qualifying activity in the documented D1/D7/D30 return window.',
  activeEmployers: 'Verified or approved employers with a qualifying marketplace action in the selected period.',
  eligibleSearches: 'SearchQueryLog records from the public or suggestions surfaces in the selected period.',
  completedPayments: 'Payment records with completed status, reported separately by currency.',
});

export const INVESTOR_RANGE_DAYS = Object.freeze([7, 30, 90]);

export const INVESTOR_FUNDRAISING_CHECKLIST = Object.freeze([
  'Pitch Deck',
  'One-Pager',
  'Financial Model',
  'Traction Sheet',
  'Market Sizing',
  'Competitor Analysis',
  'Business Model',
  'Use of Funds',
  'Fundraising Ask',
  'Cap Table',
  'Incorporation Documents',
  'Data Room',
  'Investor Target List',
  'Outreach Messaging',
]);

export function metricState(state, coverage = 'complete', detail = '') {
  return { state, coverage, detail };
}

export function boundedInvestorRange(value = 30) {
  const days = Number(value);
  return INVESTOR_RANGE_DAYS.includes(days) ? days : 30;
}
