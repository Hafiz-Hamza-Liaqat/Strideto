/**
 * PF-EMP-INT-B3B — interview timezone identity and candidate-facing time.
 *
 * Live defect this proves fixed: an Employer booked 08/12/2026 07:30 PM in
 * Asia/Karachi, the instant `2026-08-12T14:30:00.000Z` was stored correctly, the
 * Employer's own reload rendered 7:30 PM — and the candidate's in-app notification
 * said "Scheduled for 8/12/2026, 2:30:00 PM." because careerNotificationBridge called
 * `new Date(...).toLocaleString()` with no zone inside a UTC container. The queued
 * invitation carried a raw ISO instant for the same reason.
 *
 * Every assertion below runs against the shipped source, re-bound verbatim, so the
 * behaviour under test is the behaviour that deploys.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderEmailTemplate } from '../templates/emailTemplates.js';
import { formatAppointmentTime, isValidIanaTimeZone, normalizeTimeZone } from '../utils/appointmentTime.js';

let count = 0;
function check(condition, message) {
  assert.ok(condition, message);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const serverSrc = path.resolve(here, '..');

const intelligenceSrc = readFileSync(path.join(serverSrc, 'services/career/EmployerIntelligenceService.js'), 'utf8');
const automationSrc = readFileSync(path.join(serverSrc, 'services/automationService.js'), 'utf8');
const bridgeSrc = readFileSync(path.join(serverSrc, 'services/career/careerNotificationBridge.js'), 'utf8');
const cardServiceSrc = readFileSync(path.join(serverSrc, 'services/career/EmployerCandidateCardService.js'), 'utf8');
const schemaSrc = readFileSync(path.join(serverSrc, 'models/career/ApplicationContact.js'), 'utf8');

/** The appointment from the live defect report. */
const LIVE_INSTANT = new Date('2026-08-12T14:30:00.000Z');

// ---------------------------------------------------------------------------
// Re-bind shipped source
// ---------------------------------------------------------------------------

const methodStart = intelligenceSrc.indexOf('async scheduleInterview(employerId, legacyApplicationId, body = {}) {');
const methodEnd = intelligenceSrc.indexOf('async completeInterview(employerId, legacyApplicationId, body = {}) {');
assert.ok(methodStart !== -1 && methodEnd !== -1 && methodStart < methodEnd, 'scheduleInterview located in the shipped service');
const methodText = intelligenceSrc.slice(methodStart, methodEnd).trim().replace(/,\s*$/, '');

const parseDateStart = intelligenceSrc.indexOf('const ZONE_LESS_DATE_TIME');
const parseDateEnd = intelligenceSrc.indexOf('function parseTimeZone(value) {');
assert.ok(parseDateStart !== -1 && parseDateEnd !== -1 && parseDateStart < parseDateEnd, 'parseScheduledAt located in the shipped service');
const parseScheduledAt = new Function(`${intelligenceSrc.slice(parseDateStart, parseDateEnd)}; return parseScheduledAt;`)();

const parseZoneStart = intelligenceSrc.indexOf('function parseTimeZone(value) {');
const parseZoneEnd = intelligenceSrc.indexOf('function eventForPipelineStage(toStage) {');
assert.ok(parseZoneStart !== -1 && parseZoneEnd !== -1 && parseZoneStart < parseZoneEnd, 'parseTimeZone located in the shipped service');
const parseTimeZone = new Function(
  'normalizeTimeZone',
  `${intelligenceSrc.slice(parseZoneStart, parseZoneEnd)}; return parseTimeZone;`
)(normalizeTimeZone);

const dedupStart = automationSrc.indexOf('export function interviewInvitationDedupKey(');
const dedupEnd = automationSrc.indexOf('\nexport ', dedupStart + 10);
assert.ok(dedupStart !== -1 && dedupEnd !== -1, 'interviewInvitationDedupKey located in the shipped service');
const dedupText = automationSrc.slice(dedupStart, dedupEnd).replace(/^export\s+/, '');
const interviewInvitationDedupKey = new Function('createHash', `${dedupText}; return interviewInvitationDedupKey;`)(createHash);

const oascStart = automationSrc.indexOf('export async function onApplicationStatusChange(');
const oascEnd = automationSrc.indexOf('\nexport ', oascStart + 10);
assert.ok(oascStart !== -1 && oascEnd !== -1, 'onApplicationStatusChange located in the shipped service');
const oascText = automationSrc.slice(oascStart, oascEnd).replace(/^export\s+/, '');

const bodyStart = bridgeSrc.indexOf('function bodyForEvent(event) {');
const bodyEnd = bridgeSrc.indexOf('function resolveNotifyUserId(event) {');
assert.ok(bodyStart !== -1 && bodyEnd !== -1 && bodyStart < bodyEnd, 'bodyForEvent located in the shipped bridge');
const bodyForEvent = new Function(
  'formatAppointmentTime',
  `${bridgeSrc.slice(bodyStart, bodyEnd)}; return bodyForEvent;`
)(formatAppointmentTime);

function buildAutomationHarness() {
  const calls = { notifications: [], emails: [] };
  const scope = {
    queueNotification: async (n) => { calls.notifications.push(n); },
    queueEmail: async (e) => { calls.emails.push(e); },
    User: { findById: () => ({ select: () => ({ lean: async () => ({ email: 'x@example.test', name: 'Candidate' }) }) }) },
    createHash,
    formatAppointmentTime,
  };
  const argNames = Object.keys(scope);
  const fn = new Function(...argNames, `${dedupText}\n${oascText}; return onApplicationStatusChange;`)(
    ...argNames.map((n) => scope[n])
  );
  return { fn, calls };
}

function buildServiceHarness({ currentInterview, pipelineStage = 'interview', legacyStatus = 'interview', authError = null }) {
  const calls = { patchInterview: [], pushStageHistory: [], applicationSaves: 0, onApplicationStatusChange: [], emitHiringEvent: [] };
  const application = {
    _id: 'app-1',
    status: legacyStatus,
    userId: { _id: 'user-1' },
    jobId: { _id: 'job-1', title: 'Android Developer' },
    save: async () => { calls.applicationSaves += 1; },
  };
  const oaDoc = { _id: 'oa-1', pipelineStage, stageTemplateId: 'job_default', interview: currentInterview };
  const scope = {
    assertEnabled: () => {},
    getOwnedLegacyApplication: async () => { if (authError) throw authError; return application; },
    sanitizeString: (v) => String(v || '').trim(),
    parseScheduledAt,
    parseTimeZone,
    onApplicationStatusChange: async (args) => { calls.onApplicationStatusChange.push(args); },
    OpportunityApplicationRepository: {
      findByLegacyApplicationId: async () => oaDoc,
      patchInterview: async (id, patch) => { calls.patchInterview.push({ id, patch }); },
      pushStageHistory: async (id, entry) => { calls.pushStageHistory.push({ id, entry }); },
    },
    canTransition: () => true,
    emitHiringEvent: (type, payload) => { calls.emitHiringEvent.push({ type, payload }); },
    employerActor: (id) => ({ type: 'employer', id }),
  };
  const self = {};
  const argNames = Object.keys(scope);
  self.scheduleInterview = new Function(...argNames, `return ({ ${methodText} });`)(
    ...argNames.map((n) => scope[n])
  ).scheduleInterview.bind(self);
  return { self, calls, application };
}

// ---------------------------------------------------------------------------
// 1. The live defect: 19:30 Asia/Karachi round-trip
// ---------------------------------------------------------------------------
{
  const body = bodyForEvent({ eventType: 'InterviewScheduled', payload: { scheduledAt: LIVE_INSTANT, timeZone: 'Asia/Karachi' } });
  check(/7:30/.test(body), '1. The candidate notification states 7:30 — the wall clock the Employer booked.');
  check(!/2:30/.test(body), '1. It no longer states 2:30, the UTC rendering that caused the live defect.');
  check(/Aug 12, 2026/.test(body), '1. The date is the intended local date.');
  check(/Asia\/Karachi|PKT|GMT\+5/.test(body), '1. The zone is named, so the candidate can verify the time themselves.');
}

// ---------------------------------------------------------------------------
// 2. A second, non-UTC, non-Pakistan zone — nothing is hard-coded to one region
// ---------------------------------------------------------------------------
{
  const berlin = bodyForEvent({ eventType: 'InterviewScheduled', payload: { scheduledAt: LIVE_INSTANT, timeZone: 'Europe/Berlin' } });
  check(/4:30/.test(berlin), '2. The same instant renders as 4:30 PM in Europe/Berlin (CEST, UTC+2).');
  check(!/7:30/.test(berlin) && !/2:30/.test(berlin), '2. It is neither the Karachi nor the UTC wall clock.');

  const denver = bodyForEvent({ eventType: 'InterviewScheduled', payload: { scheduledAt: LIVE_INSTANT, timeZone: 'America/Denver' } });
  check(/8:30/.test(denver), '2. And as 8:30 AM in America/Denver (MDT, UTC-6) — a negative offset works too.');

  const kolkata = formatAppointmentTime(LIVE_INSTANT, 'Asia/Kolkata');
  check(/8:00/.test(kolkata.text), '2. A half-hour offset zone (Asia/Kolkata, UTC+5:30) renders 8:00 PM, not a rounded hour.');
}

// ---------------------------------------------------------------------------
// 3. Invalid timezones are rejected before any write
// ---------------------------------------------------------------------------
{
  check(isValidIanaTimeZone('Asia/Karachi') && isValidIanaTimeZone('Europe/Berlin') && isValidIanaTimeZone('UTC'), '3. Real IANA identifiers are accepted.');
  check(!isValidIanaTimeZone('Mars/Phobos'), '3. A well-shaped but non-existent zone is rejected by Intl.');
  check(!isValidIanaTimeZone('+05:00') && !isValidIanaTimeZone('GMT+5'), '3. A fixed offset is not a zone and is rejected — it cannot survive a DST boundary.');
  check(!isValidIanaTimeZone('PKT') && !isValidIanaTimeZone('') && !isValidIanaTimeZone(null), '3. Abbreviations, empty strings and non-strings are rejected.');
  check(!isValidIanaTimeZone('Asia/Karachi; DROP'), '3. Punctuation that could travel into a key or a header is rejected.');

  check(parseTimeZone(undefined) === undefined, '3. An omitted timeZone is "not stated" — patch semantics, not a reset.');
  check(parseTimeZone('') === '', '3. An explicitly blank timeZone clears the stored identity.');
  check(parseTimeZone('Mars/Phobos') === null, '3. An invalid stated timeZone resolves to null so the service can reject it.');

  const { self, calls } = buildServiceHarness({ currentInterview: { scheduledAt: new Date('2026-08-01T10:00:00Z'), mode: 'video' } });
  let status = null;
  try {
    await self.scheduleInterview('emp-1', 'app-1', { scheduledAt: '2026-08-12T14:30:00Z', timeZone: 'Mars/Phobos' });
  } catch (err) {
    status = err.status;
  }
  check(status === 400, '3. scheduleInterview rejects an invalid timeZone with 400.');
  check(calls.patchInterview.length === 0, '3. It rejects BEFORE any write — no appointment patch was performed.');
  check(calls.emitHiringEvent.length === 0 && calls.onApplicationStatusChange.length === 0, '3. And before any notification or invitation.');
}

// ---------------------------------------------------------------------------
// 4. The timezone is stored with the appointment, and preserved when omitted
// ---------------------------------------------------------------------------
{
  check(/timeZone:\s*\{\s*type:\s*String/.test(schemaSrc), '4. interviewScheduleSchema persists a timeZone field.');

  const { self, calls } = buildServiceHarness({ currentInterview: { scheduledAt: new Date('2026-08-01T10:00:00Z'), mode: 'video' } });
  const result = await self.scheduleInterview('emp-1', 'app-1', { scheduledAt: '2026-08-12T14:30:00Z', mode: 'video', timeZone: 'Asia/Karachi' });
  check(result.changed === true, '4. A genuine appointment with a zone is a change.');
  check(calls.patchInterview[0].patch.timeZone === 'Asia/Karachi', '4. The zone is written with the appointment.');
  check(result.interview.timeZone === 'Asia/Karachi', '4. And is present on the returned appointment.');

  const kept = buildServiceHarness({ currentInterview: { scheduledAt: new Date('2026-08-01T10:00:00Z'), mode: 'video', timeZone: 'Asia/Karachi' } });
  await kept.self.scheduleInterview('emp-1', 'app-1', { scheduledAt: '2026-08-12T14:30:00Z', mode: 'video' });
  check(kept.calls.patchInterview[0].patch.timeZone === undefined, '4. A payload omitting timeZone does not write the field...');
  check(kept.calls.onApplicationStatusChange[0].interviewTimeZone === 'Asia/Karachi', '4. ...and the stored zone still reaches the invitation, so it is preserved rather than lost.');

  check(/timeZone: oa\.interview\.timeZone/.test(cardServiceSrc), '4. The Employer projection exposes the stored zone so a reload can render it.');
}

// ---------------------------------------------------------------------------
// 5. Formatting follows the appointment, never the process/container zone
// ---------------------------------------------------------------------------
{
  // Scoped to the InterviewScheduled branch: `ReminderCreated` still formats with a
  // bare toLocaleString, which is the same latent defect but explicitly out of B3B
  // scope (reminders are deferred), so this must not silently start asserting it.
  const bodySrc = bridgeSrc.slice(bodyStart, bodyEnd);
  const interviewCaseStart = bodySrc.indexOf("case 'InterviewScheduled'");
  const interviewCaseEnd = bodySrc.indexOf("case 'ReminderCreated'");
  assert.ok(interviewCaseStart !== -1 && interviewCaseEnd !== -1 && interviewCaseStart < interviewCaseEnd, 'InterviewScheduled branch located');
  // Comments in that branch name the removed call when explaining the defect, so
  // assert against code only.
  const interviewCase = bodySrc.slice(interviewCaseStart, interviewCaseEnd).replace(/\/\/.*$/gm, '');
  check(
    !/toLocaleString\(\)/.test(interviewCase),
    '5. The InterviewScheduled branch no longer calls bare toLocaleString() — the call that read the container zone.'
  );
  check(
    /formatAppointmentTime\(\s*event\.payload\?\.scheduledAt,\s*event\.payload\?\.timeZone\s*\)/.test(interviewCase),
    '5. It formats through the shared helper using the appointment\'s own stored zone.'
  );
  const formatterCode = readFileSync(path.join(serverSrc, 'utils/appointmentTime.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  check(
    !/process\.env\.TZ/.test(formatterCode),
    '5. The formatter never consults process.env.TZ as appointment truth.'
  );
  check(
    !/Asia\/Karachi/.test(formatterCode),
    '5. And infers no regional default — the zone comes from the appointment or is UTC.'
  );

  // The process zone is whatever this test host runs in. Formatting the same instant
  // in an explicit zone must produce that zone's wall clock regardless.
  const original = process.env.TZ;
  try {
    process.env.TZ = 'America/New_York';
    const a = formatAppointmentTime(LIVE_INSTANT, 'Asia/Karachi').text;
    process.env.TZ = 'Australia/Sydney';
    const b = formatAppointmentTime(LIVE_INSTANT, 'Asia/Karachi').text;
    check(a === b, '5. The rendered time is identical under two different process zones.');
    check(/7:30/.test(a), '5. And is the appointment zone wall clock in both.');
  } finally {
    if (original === undefined) delete process.env.TZ; else process.env.TZ = original;
  }
}

// ---------------------------------------------------------------------------
// 5b. Legacy appointments: the smallest truthful fallback, stated explicitly
// ---------------------------------------------------------------------------
{
  const legacy = formatAppointmentTime(LIVE_INSTANT, '');
  check(legacy.zone === 'UTC' && legacy.isFallbackZone === true, '5b. An appointment with no stored zone falls back to UTC and is flagged as a fallback.');
  check(/UTC/.test(legacy.text), '5b. The UTC fallback is labelled, so the reader is never shown an unlabelled wall clock.');
  check(/2:30/.test(legacy.text), '5b. It states the true UTC instant rather than inventing a region.');
  check(formatAppointmentTime(null, 'Asia/Karachi') === null, '5b. A missing instant formats to null so callers keep their own wording.');

  const noAppointment = bodyForEvent({ eventType: 'InterviewScheduled', payload: {} });
  check(noAppointment === 'Interview details were updated.', '5b. A stage-only event keeps its appointment-free wording (B1).');
}

// ---------------------------------------------------------------------------
// 6. The email carries a human-readable time plus the zone
// ---------------------------------------------------------------------------
{
  const { fn, calls } = buildAutomationHarness();
  await fn({
    applicationId: 'app-1', userId: 'user-1', status: 'interview', jobTitle: 'Android Developer',
    interviewWhen: LIVE_INSTANT, interviewMode: 'video', interviewLink: 'https://example.com/i', interviewLocation: '',
    interviewTimeZone: 'Asia/Karachi',
  });
  check(calls.emails.length === 1, '6. A genuine appointment queues exactly one invitation.');
  const vars = calls.emails[0].vars;
  check(/7:30/.test(vars.whenLabel), '6. The queued vars carry the appointment rendered at 7:30 in its own zone.');
  check(vars.timeZone === 'Asia/Karachi', '6. The zone identity is queued alongside it.');
  check(vars.when === LIVE_INSTANT, '6. The raw instant is retained internally for correlation.');

  for (const lang of ['en', 'ur']) {
    const rendered = renderEmailTemplate('interviewInvitation', lang, vars);
    check(/7:30/.test(rendered.html) && /7:30/.test(rendered.text), `6. The ${lang} invitation shows the human-readable 7:30 time.`);
    check(/Asia\/Karachi|PKT|GMT\+5/.test(rendered.text), `6. The ${lang} invitation names the timezone.`);
    check(!/2026-08-12T14:30/.test(rendered.text), `6. The ${lang} invitation no longer shows a raw ISO instant as the human-facing time.`);
  }

  // A pre-B3B job already sitting in the queue has no whenLabel and must still render.
  const legacyRender = renderEmailTemplate('interviewInvitation', 'en', { name: 'C', jobTitle: 'Job', when: '2026-08-12T14:30:00.000Z', mode: 'video' });
  check(/2026-08-12T14:30/.test(legacyRender.text), '6. A queued pre-B3B job still renders, falling back to its unambiguous ISO instant.');
}

// ---------------------------------------------------------------------------
// 7. Effective-appointment dedup remains correct with timezone identity
// ---------------------------------------------------------------------------
{
  const base = { when: LIVE_INSTANT, mode: 'video', link: 'https://example.com/i', location: '', timeZone: 'Asia/Karachi' };
  const key = (extra = {}) => interviewInvitationDedupKey('app-1', { ...base, ...extra });

  check(key() === key(), '7. The same effective appointment always produces the same key.');
  check(key() !== key({ timeZone: 'Europe/Berlin' }), '7. Changing only the zone produces a new key — the candidate is being told a different time.');
  check(key() !== key({ when: new Date('2026-08-13T14:30:00.000Z') }), '7. Changing the instant produces a new key (B3A).');
  check(key() !== key({ mode: 'in_person' }), '7. Changing the method produces a new key (B3A).');
  check(key() !== key({ link: 'https://example.com/other' }), '7. Changing the link produces a new key (B3A).');
  check(key() !== key({ location: 'Office' }), '7. Changing the location produces a new key (B3A).');
  check(key() !== interviewInvitationDedupKey('app-2', base), '7. The key is scoped to the application.');

  check(!key().includes('Asia/Karachi'), '7. The raw zone never appears in the key — it is folded into the digest.');
  check(!key().includes('example.com'), '7. Nor does the raw meeting URL (B3A).');
  check(key().includes(LIVE_INSTANT.toISOString()), '7. The instant stays legible so a queued job can be correlated by inspection.');
  check(/^email:interview:app-1:\d{4}-\d{2}-\d{2}T[\d:.]+Z:[0-9a-f]{12}$/.test(key()), '7. The key keeps its fixed, index-safe shape.');

  // A pre-B3B appointment carries no zone, so it must keep producing the exact B3A key
  // — otherwise this change alone would orphan or re-send already-queued invitations.
  const zoneless = { when: LIVE_INSTANT, mode: 'video', link: '', location: '' };
  check(
    interviewInvitationDedupKey('app-1', zoneless) === interviewInvitationDedupKey('app-1', { ...zoneless, timeZone: '' }),
    '7. An absent zone and an empty zone are one appointment.'
  );
  check(
    interviewInvitationDedupKey('app-1', zoneless) === 'email:interview:app-1:2026-08-12T14:30:00.000Z:53cab88e1d72',
    '7. A zoneless appointment reproduces the live B3A key byte-for-byte — no queued invitation is orphaned by B3B.'
  );
}

// ---------------------------------------------------------------------------
// 8. An identical save remains a no-op
// ---------------------------------------------------------------------------
{
  const currentInterview = { scheduledAt: LIVE_INSTANT, mode: 'video', meetingUrl: 'https://example.com/i', location: '', timeZone: 'Asia/Karachi' };
  const { self, calls } = buildServiceHarness({ currentInterview });
  const result = await self.scheduleInterview('emp-1', 'app-1', {
    scheduledAt: '2026-08-12T14:30:00.000Z', mode: 'video', meetingUrl: 'https://example.com/i', location: '', timeZone: 'Asia/Karachi',
  });
  check(result.changed === false, '8. Re-saving the identical appointment, zone included, reports no change.');
  check(calls.patchInterview.length === 0, '8. It performs zero writes.');
  check(calls.emitHiringEvent.length === 0, '8. Zero events.');
  check(calls.onApplicationStatusChange.length === 0, '8. Zero notifications and zero invitations.');
  check(calls.applicationSaves === 0 && calls.pushStageHistory.length === 0, '8. Zero legacy saves and zero stage history.');

  // The zone is the only difference — still a genuine change.
  const moved = buildServiceHarness({ currentInterview });
  const movedResult = await moved.self.scheduleInterview('emp-1', 'app-1', {
    scheduledAt: '2026-08-12T14:30:00.000Z', mode: 'video', meetingUrl: 'https://example.com/i', location: '', timeZone: 'Europe/Berlin',
  });
  check(movedResult.changed === true, '8. Changing only the zone is a genuine change...');
  check(moved.calls.onApplicationStatusChange[0].interviewTimeZone === 'Europe/Berlin', '8. ...and the new zone reaches the invitation so it is not wrongly deduped.');
}

// ---------------------------------------------------------------------------
// 9. B1: a stage-only transition still queues no invitation
// ---------------------------------------------------------------------------
{
  const { fn, calls } = buildAutomationHarness();
  await fn({ applicationId: 'app-1', userId: 'user-1', status: 'interview', jobTitle: 'Android Developer' });
  check(calls.emails.length === 0, '9. A stage move with no appointment queues no invitation email.');
  check(calls.notifications.length === 1 && !/invitation|invited/i.test(calls.notifications[0].title), '9. And makes no claim that an interview was booked.');

  const { self, calls: sCalls } = buildServiceHarness({
    currentInterview: { scheduledAt: LIVE_INSTANT, mode: 'video', timeZone: 'Asia/Karachi' },
    pipelineStage: 'screening',
    legacyStatus: 'shortlisted',
  });
  await self.scheduleInterview('emp-1', 'app-1', { scheduledAt: '2026-08-12T14:30:00.000Z', mode: 'video', timeZone: 'Asia/Karachi' });
  check(sCalls.onApplicationStatusChange[0].interviewWhen === null, '9. A stage-only move withholds the datetime from the hook.');
  check(sCalls.onApplicationStatusChange[0].interviewTimeZone === '', '9. And withholds the zone too, so no invitation wording can be built.');
}

// ---------------------------------------------------------------------------
// 10. B2: fields the Employer payload omits are still preserved
// ---------------------------------------------------------------------------
{
  const currentInterview = {
    scheduledAt: new Date('2026-08-01T10:00:00Z'), mode: 'video',
    meetingUrl: 'http://meet', location: 'Office', notes: 'Candidate note', outcome: 'Pending', timeZone: 'Asia/Karachi',
  };
  const { self, calls } = buildServiceHarness({ currentInterview });
  const result = await self.scheduleInterview('emp-1', 'app-1', { scheduledAt: '2026-08-12T14:30:00Z', mode: 'video' });
  const patch = calls.patchInterview[0].patch;
  check(patch.notes === undefined && patch.outcome === undefined, '10. Omitted notes/outcome are absent from the patch.');
  check(patch.meetingUrl === undefined && patch.location === undefined, '10. Omitted meetingUrl/location are absent from the patch.');
  check(patch.timeZone === undefined, '10. An omitted timeZone is absent from the patch — B3B adds no new wipe hazard.');
  check(
    result.interview.notes === 'Candidate note' && result.interview.outcome === 'Pending'
      && result.interview.meetingUrl === 'http://meet' && result.interview.location === 'Office'
      && result.interview.timeZone === 'Asia/Karachi',
    '10. Every omitted field survives on the resulting appointment.'
  );
}

// ---------------------------------------------------------------------------
// 11. Authorization still runs before any write
// ---------------------------------------------------------------------------
{
  for (const status of [403, 404]) {
    const authError = Object.assign(new Error('denied'), { status });
    const { self, calls } = buildServiceHarness({ currentInterview: { scheduledAt: LIVE_INSTANT, mode: 'video' }, authError });
    let seen = null;
    try {
      await self.scheduleInterview('other-emp', 'app-1', { scheduledAt: '2026-08-13T14:30:00Z', timeZone: 'Asia/Karachi' });
    } catch (err) {
      seen = err.status;
    }
    check(seen === status, `11. A non-owning employer still receives ${status}.`);
    check(calls.patchInterview.length === 0, `11. No appointment write occurs on ${status}.`);
    check(calls.emitHiringEvent.length === 0 && calls.onApplicationStatusChange.length === 0, `11. No event, notification or invitation on ${status}.`);
  }

  const ownershipFirst = methodText.indexOf('getOwnedLegacyApplication');
  check(
    ownershipFirst !== -1 && ownershipFirst < methodText.indexOf('parseTimeZone'),
    '11. Ownership is resolved before the timezone is even parsed.'
  );
}

console.log(`employerInterviewTimezoneIdentity: ${count} assertions passed`);
