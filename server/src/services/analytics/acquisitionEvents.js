import { AnalyticsEvent } from '../../models/AnalyticsEvent.js';
import { User } from '../../models/User.js';
import { Employer } from '../../models/Employer.js';
import { recordAnalyticsEvent, scheduleAnalyticsEvent } from './AnalyticsEventService.js';

export const ACQUISITION_EVENTS = Object.freeze({
  userRegistered: 'user_registered', employerRegistered: 'employer_registered',
  userVerified: 'user_verified', employerEmailVerified: 'employer_email_verified', employerVerified: 'employer_verified',
  userActivated: 'user_activated', employerActivated: 'employer_activated',
  jobPublished: 'job_published', internalApplicationCreated: 'internal_application_created',
});

const ATTRIBUTION_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'landingPage', 'referrerCategory'];
function safeAttribution(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const result = {};
  for (const key of ATTRIBUTION_KEYS) {
    if (typeof value[key] === 'string' && value[key].trim()) result[key] = value[key].trim().slice(0, 500);
  }
  return Object.keys(result).length ? result : null;
}

export function registrationEvent({ realm, subjectId, attribution = null }) {
  const isEmployer = realm === 'employer';
  const eventType = isEmployer ? ACQUISITION_EVENTS.employerRegistered : ACQUISITION_EVENTS.userRegistered;
  const id = String(subjectId);
  return { eventType, eventId: `${eventType}:${id}:v1`, schemaVersion: '3',
    entityType: isEmployer ? 'employer' : 'user', entityId: id,
    ...(isEmployer ? {} : { userId: id }),
    metadata: { conversion: eventType, attribution: safeAttribution(attribution), attributionSchemaVersion: '1' } };
}

export async function recordRegistrationEvent(args) {
  return recordAnalyticsEvent(registrationEvent(args), { userId: args.realm === 'employer' ? undefined : args.subjectId });
}

/** Analytics is observability, not an account-creation dependency. */
export async function safeRecordRegistrationEvent(args) {
  try { return await recordRegistrationEvent(args); } catch { return null; }
}

export async function emitVerificationEvent({ realm, subjectId }) {
  const isEmployer = realm === 'employer';
  const eventType = isEmployer ? ACQUISITION_EVENTS.employerEmailVerified : ACQUISITION_EVENTS.userVerified;
  return recordAnalyticsEvent({ eventType, eventId: `${eventType}:${String(subjectId)}:v1`, schemaVersion: '3',
    entityType: isEmployer ? 'employer' : 'user', entityId: String(subjectId),
    ...(isEmployer ? {} : { userId: subjectId }), metadata: { conversion: eventType } });
}

export async function safeEmitVerificationEvent(args) {
  try { return await emitVerificationEvent(args); } catch { return null; }
}

export async function evaluateUserActivation(userId, trigger) {
  const allowed = new Set(['onboarding_completed', 'internal_application_created', 'opportunity_saved', 'eligibility_checked']);
  if (!userId || !allowed.has(trigger)) return { activated: false, code: 'TRIGGER_NOT_ELIGIBLE' };
  const user = await User.findById(userId).select('emailVerified');
  if (!user?.emailVerified) return { activated: false, code: 'USER_NOT_VERIFIED' };
  if (await AnalyticsEvent.exists({ eventType: ACQUISITION_EVENTS.userActivated, userId })) return { activated: false, code: 'ALREADY_ACTIVATED' };
  await recordAnalyticsEvent({ eventType: ACQUISITION_EVENTS.userActivated, eventId: `${ACQUISITION_EVENTS.userActivated}:${String(userId)}:v1`, schemaVersion: '3', entityType: 'user', entityId: String(userId), userId, metadata: { conversion: ACQUISITION_EVENTS.userActivated, trigger } });
  return { activated: true, code: 'ACTIVATED' };
}

export async function evaluateEmployerActivation(employerId) {
  const employer = await Employer.findById(employerId).select('emailVerified verified verificationLevel');
  if (!employer?.emailVerified || !(employer.verified || ['verified', 'trusted'].includes(employer.verificationLevel))) return { activated: false, code: 'EMPLOYER_NOT_VERIFIED' };
  if (await AnalyticsEvent.exists({ eventType: ACQUISITION_EVENTS.employerActivated, entityId: String(employerId) })) return { activated: false, code: 'ALREADY_ACTIVATED' };
  await recordAnalyticsEvent({ eventType: ACQUISITION_EVENTS.employerActivated, eventId: `${ACQUISITION_EVENTS.employerActivated}:${String(employerId)}:v1`, schemaVersion: '3', entityType: 'employer', entityId: String(employerId), metadata: { conversion: ACQUISITION_EVENTS.employerActivated, trigger: 'first_published_job' } });
  return { activated: true, code: 'ACTIVATED' };
}

export function scheduleCanonicalEvent(input, context = {}) { scheduleAnalyticsEvent(input, context); }
