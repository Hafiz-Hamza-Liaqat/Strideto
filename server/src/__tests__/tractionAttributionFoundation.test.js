import assert from 'node:assert/strict';
import test from 'node:test';
import { AnalyticsEvent } from '../models/AnalyticsEvent.js';
import { recordAnalyticsEvent } from '../services/analytics/AnalyticsEventService.js';
import { registrationEvent, ACQUISITION_EVENTS, safeRecordRegistrationEvent, safeEmitVerificationEvent, evaluateUserActivation, scheduleCanonicalEvent } from '../services/analytics/acquisitionEvents.js';
import { User } from '../models/User.js';
import { extractApprovedAttributionParams, normalizeAttribution } from '../../../shared/seo/measurement/landingAttribution.js';

test('TA-01..06 analytics identity and runtime envelope are server-authoritative', async () => {
  let created;
  const original = AnalyticsEvent.create;
  AnalyticsEvent.create = async (payload) => { created = payload; return payload; };
  try {
    await recordAnalyticsEvent({ eventType: 'job_view', userId: '507f1f77bcf86cd799439011', source: 'server', environment: 'production' }, { userId: '507f1f77bcf86cd799439012', source: 'server', environment: 'test' });
  } finally {
    AnalyticsEvent.create = original;
  }
  assert.equal(String(created.userId), '507f1f77bcf86cd799439012');
  assert.equal(created.source, 'server');
  assert.equal(created.environment, 'test');
});

test('TA-01 anonymous analytics cannot inject a logged-in identity', async () => {
  let created;
  const original = AnalyticsEvent.create;
  AnalyticsEvent.create = async (payload) => { created = payload; return payload; };
  try { await recordAnalyticsEvent({ eventType: 'job_view', userId: '507f1f77bcf86cd799439011' }, {}); } finally { AnalyticsEvent.create = original; }
  assert.equal(created.userId, undefined);
});

test('TA-02 employer analytics uses authenticated employer entity context', async () => {
  let created;
  const original = AnalyticsEvent.create;
  AnalyticsEvent.create = async (payload) => { created = payload; return payload; };
  try { await recordAnalyticsEvent({ eventType: 'cta_click', entityType: 'job', entityId: 'spoofed' }, { entityType: 'employer', entityId: 'employer-1' }); } finally { AnalyticsEvent.create = original; }
  assert.equal(created.entityType, 'employer');
  assert.equal(created.entityId, 'employer-1');
});

test('TA-07..12 approved first-touch attribution is bounded and strips unknown fields', () => {
  const params = extractApprovedAttributionParams('?utm_source=Google&utm_medium=CPC&utm_campaign=launch&utm_content=card_01&utm_term=private&evil=1');
  assert.deepEqual(params, { utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'launch', utm_content: 'card_01' });
  const normalized = normalizeAttribution({ ...params, landingPage: '/jobs', referrerCategory: 'social', userId: 'spoof', rawQuery: 'secret' });
  assert.deepEqual(normalized, { utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'launch', utm_content: 'card_01', landingPage: '/jobs', referrerCategory: 'social' });
});

test('TA-15..23 registration conversion identity is deterministic and privacy-safe', () => {
  const event = registrationEvent({ realm: 'user', subjectId: '507f1f77bcf86cd799439011', attribution: { utm_source: 'facebook', utm_content: 'creative_1', email: 'secret@example.com' } });
  assert.equal(event.eventType, ACQUISITION_EVENTS.userRegistered);
  assert.equal(event.eventId, 'user_registered:507f1f77bcf86cd799439011:v1');
  assert.equal(event.metadata.attribution.utm_content, 'creative_1');
  assert.equal(event.metadata.attribution.email, undefined);
});

test('TA-24..31 verification and activation event names are canonical and going-forward', () => {
  assert.equal(ACQUISITION_EVENTS.userVerified, 'user_verified');
  assert.equal(ACQUISITION_EVENTS.userActivated, 'user_activated');
  assert.equal(ACQUISITION_EVENTS.employerActivated, 'employer_activated');
  assert.equal(ACQUISITION_EVENTS.jobPublished, 'job_published');
});

test('TA-38..41 primary internal application conversion remains distinct from click-outs', () => {
  assert.equal(ACQUISITION_EVENTS.internalApplicationCreated, 'internal_application_created');
  assert.notEqual(ACQUISITION_EVENTS.internalApplicationCreated, 'application_click');
});

test('CORE-01..03 analytics persistence failure cannot fail registration or verification', async () => {
  const original = AnalyticsEvent.create;
  AnalyticsEvent.create = async () => { throw new Error('analytics unavailable'); };
  try {
    assert.equal(await safeRecordRegistrationEvent({ realm: 'user', subjectId: 'u1' }), null);
    assert.equal(await safeRecordRegistrationEvent({ realm: 'employer', subjectId: 'e1' }), null);
    assert.equal(await safeEmitVerificationEvent({ realm: 'user', subjectId: 'u1' }), null);
  } finally { AnalyticsEvent.create = original; }
});

test('CORE-04..06 non-blocking event scheduling does not reject the product write path', async () => {
  const original = AnalyticsEvent.create;
  AnalyticsEvent.create = async () => { throw new Error('analytics unavailable'); };
  try {
    assert.doesNotThrow(() => scheduleCanonicalEvent({ eventType: ACQUISITION_EVENTS.jobPublished }));
    await new Promise((resolve) => setImmediate(resolve));
  } finally { AnalyticsEvent.create = original; }
});

test('TA-47..56 activation requires verification, an allowlisted trigger, and deduplicates', async () => {
  const originals = { findById: User.findById, exists: AnalyticsEvent.exists, create: AnalyticsEvent.create };
  let created = 0;
  User.findById = () => ({ select: async () => ({ emailVerified: true }) });
  AnalyticsEvent.exists = async () => created > 0;
  AnalyticsEvent.create = async () => { created += 1; return {}; };
  try {
    assert.equal((await evaluateUserActivation('u1', 'login')).code, 'TRIGGER_NOT_ELIGIBLE');
    assert.equal((await evaluateUserActivation('u1', 'onboarding_completed')).activated, true);
    assert.equal((await evaluateUserActivation('u1', 'onboarding_completed')).code, 'ALREADY_ACTIVATED');
  } finally {
    User.findById = originals.findById;
    AnalyticsEvent.exists = originals.exists;
    AnalyticsEvent.create = originals.create;
  }
});

test('TA-57..63 employer activation requires approved employer and is idempotent by event identity', async () => {
  const originals = { findById: User.findById, exists: AnalyticsEvent.exists, create: AnalyticsEvent.create };
  let created = 0;
  const EmployerModel = (await import('../models/Employer.js')).Employer;
  const employerOriginal = EmployerModel.findById;
  EmployerModel.findById = () => ({ select: async () => ({ emailVerified: true, verified: true, verificationLevel: 'verified' }) });
  AnalyticsEvent.exists = async () => created > 0;
  AnalyticsEvent.create = async () => { created += 1; return {}; };
  try {
    const { evaluateEmployerActivation } = await import('../services/analytics/acquisitionEvents.js');
    assert.equal((await evaluateEmployerActivation('e1')).activated, true);
    assert.equal((await evaluateEmployerActivation('e1')).code, 'ALREADY_ACTIVATED');
  } finally {
    EmployerModel.findById = employerOriginal;
    User.findById = originals.findById;
    AnalyticsEvent.exists = originals.exists;
    AnalyticsEvent.create = originals.create;
  }
});
