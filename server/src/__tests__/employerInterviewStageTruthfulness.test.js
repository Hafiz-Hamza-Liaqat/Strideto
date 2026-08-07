/**
 * PF-EMP-INT-B1 — reaching the `interview` pipeline stage must not claim that a
 * date/time appointment exists.
 *
 * Confirmed live (docs/STRIDETO_EMPLOYER_INTERVIEW_WORKFLOW_AUDIT.md §3): candidate
 * Usama121 had `interview.scheduledAt: null` and had never been scheduled, yet held
 * one `career.InterviewScheduled` notification and one queued `interviewInvitation`
 * email — both produced by a stage transition alone. The derived status projection
 * additionally reported `scheduled` for that appointment-less state.
 *
 * Part 1 exercises the real `resolveInterviewStatus` and the real
 * `eventForPipelineStage` behavior. Part 2 re-binds the shipped
 * `onApplicationStatusChange` body against fakes so notification/email-job creation
 * is counted rather than inferred. Part 3 covers ordering/boundary facts that cannot
 * be executed here.
 *
 * Only queue/job-creation boundaries are asserted — no email delivery is claimed,
 * and the worker stays stopped.
 *
 * Run: node src/__tests__/employerInterviewStageTruthfulness.test.js
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// emailTemplates.js has no imports of its own, so the real renderer can be exercised
// directly rather than regex-asserted.
import { renderEmailTemplate } from '../templates/emailTemplates.js';

let count = 0;
function check(condition, message) {
  assert.ok(condition, message);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const serverSrc = path.resolve(here, '..');

const cardServiceSrc = readFileSync(path.join(serverSrc, 'services/career/EmployerCandidateCardService.js'), 'utf8');
const intelligenceSrc = readFileSync(path.join(serverSrc, 'services/career/EmployerIntelligenceService.js'), 'utf8');
const automationSrc = readFileSync(path.join(serverSrc, 'services/automationService.js'), 'utf8');

// ---------------------------------------------------------------------------
// Part 1a — eventForPipelineStage (module-private; re-bound verbatim)
// ---------------------------------------------------------------------------

const efpsStart = intelligenceSrc.indexOf('function eventForPipelineStage(toStage) {');
const efpsEnd = intelligenceSrc.indexOf('export const EmployerIntelligenceService');
assert.ok(efpsStart !== -1 && efpsEnd !== -1 && efpsStart < efpsEnd, 'eventForPipelineStage located in the shipped service');
const eventForPipelineStage = new Function(
  `${intelligenceSrc.slice(efpsStart, efpsEnd)}; return eventForPipelineStage;`
)();

// --- 1. Moving to interview emits no appointment event ---
check(
  eventForPipelineStage('interview') === null,
  '1. eventForPipelineStage("interview") returns null — a stage move emits no InterviewScheduled appointment event'
);

// --- Other stages keep their existing milestone events ---
check(eventForPipelineStage('screening') === 'CandidateShortlisted', 'screening still maps to CandidateShortlisted');
check(eventForPipelineStage('offer') === 'OfferSent', 'offer still maps to OfferSent');
check(eventForPipelineStage('joined') === 'CandidateHired', 'joined still maps to CandidateHired');
check(eventForPipelineStage('rejected') === 'CandidateRejected', 'rejected still maps to CandidateRejected');
check(
  eventForPipelineStage('viewed') === null && eventForPipelineStage('assessment') === null,
  'interview now behaves like viewed/assessment — stages with no truthful milestone event'
);

// --- 9. The genuine scheduler remains the only InterviewScheduled producer ---
{
  const scheduleFn = intelligenceSrc.slice(
    intelligenceSrc.indexOf('async scheduleInterview('),
    intelligenceSrc.indexOf('async completeInterview(')
  );
  check(
    /'InterviewScheduled',/.test(scheduleFn),
    '9. scheduleInterview still emits InterviewScheduled for a genuine appointment'
  );
  const transitionFn = intelligenceSrc.slice(
    intelligenceSrc.indexOf('async transitionPipeline('),
    intelligenceSrc.indexOf('async addNote(')
  );
  check(
    !/'InterviewScheduled'/.test(transitionFn),
    '1. transitionPipeline no longer references InterviewScheduled anywhere'
  );
}

// ---------------------------------------------------------------------------
// Part 1b — resolveInterviewStatus (module-private; re-bound verbatim)
// ---------------------------------------------------------------------------

const risStart = cardServiceSrc.indexOf('function resolveInterviewStatus(oa) {');
const risEnd = cardServiceSrc.indexOf('export const EmployerCandidateCardService');
assert.ok(risStart !== -1 && risEnd !== -1 && risStart < risEnd, 'resolveInterviewStatus located in the shipped service');
const resolveInterviewStatus = new Function(
  `${cardServiceSrc.slice(risStart, risEnd)}; return resolveInterviewStatus;`
)();

// --- 8. No appointment => not 'scheduled', regardless of pipeline stage ---
{
  const noAppointment = resolveInterviewStatus({
    pipelineStage: 'interview',
    interview: { scheduledAt: null, mode: 'video', location: '', meetingUrl: '', notes: '', outcome: '' },
  });
  check(noAppointment.status === 'none', '8. A candidate at the interview stage with scheduledAt null resolves to "none", not "scheduled"');
  check(noAppointment.scheduledAt === null, '7. No appointment date is fabricated');
}

// --- The exact live shape that produced the defect ---
{
  const live = resolveInterviewStatus({
    pipelineStage: 'offer',
    interview: { scheduledAt: null, mode: 'video', location: '', meetingUrl: '', notes: '', outcome: '' },
  });
  check(live.status === 'none', "8. Usama121's live interview object (all defaults) now resolves to 'none'");
}

// --- 14. A real appointment still resolves as scheduled ---
{
  const when = new Date('2026-09-01T09:30:00.000Z');
  const scheduled = resolveInterviewStatus({ interview: { scheduledAt: when, mode: 'phone', location: 'HQ', outcome: '' } });
  check(scheduled.status === 'scheduled', '14. A persisted scheduledAt with no outcome resolves to "scheduled"');
  check(scheduled.scheduledAt === when && scheduled.mode === 'phone' && scheduled.location === 'HQ', '12/14. Appointment details are projected unchanged');
}

// --- 13. A completed interview still resolves as completed ---
{
  const completed = resolveInterviewStatus({
    interview: { scheduledAt: new Date('2026-08-01T10:00:00.000Z'), mode: 'video', outcome: 'passed' },
  });
  check(completed.status === 'completed' && completed.outcome === 'passed', '13. A recorded outcome resolves to "completed"');
  const outcomeOnly = resolveInterviewStatus({ interview: { scheduledAt: null, outcome: 'passed' } });
  check(outcomeOnly.status === 'completed', '13. An outcome surviving without scheduledAt still resolves to "completed", not "none"');
}

// --- No tracker at all ---
check(resolveInterviewStatus(null).status === 'none', 'A candidate with no linked tracker resolves to "none"');
check(resolveInterviewStatus({}).status === 'none', 'A tracker with no interview subdocument resolves to "none"');

// ---------------------------------------------------------------------------
// Part 2 — onApplicationStatusChange side effects (re-bound verbatim)
// ---------------------------------------------------------------------------

const oascStart = automationSrc.indexOf('export async function onApplicationStatusChange(');
const oascEnd = automationSrc.indexOf('\nexport ', oascStart + 10);
assert.ok(oascStart !== -1 && oascEnd !== -1, 'onApplicationStatusChange located in the shipped service');
const oascText = automationSrc.slice(oascStart, oascEnd).replace(/^export\s+/, '');

// PF-EMP-INT-B3: the invitation dedup identity now lives in a pure helper, re-bound
// verbatim alongside the hook so the key under test is the shipped one.
const dedupStart = automationSrc.indexOf('export function interviewInvitationDedupKey(');
const dedupEnd = automationSrc.indexOf('\nexport ', dedupStart + 10);
assert.ok(dedupStart !== -1 && dedupEnd !== -1, 'interviewInvitationDedupKey located in the shipped service');
const dedupText = automationSrc.slice(dedupStart, dedupEnd).replace(/^export\s+/, '');

function buildAutomationHarness() {
  const calls = { notifications: [], emails: [] };
  const scope = {
    queueNotification: async (n) => { calls.notifications.push(n); },
    queueEmail: async (e) => { calls.emails.push(e); },
    User: { findById: () => ({ select: () => ({ lean: async () => ({ email: 'x@example.test', name: 'Candidate' }) }) }) },
    createHash,
  };
  const argNames = Object.keys(scope);
  const fn = new Function(
    ...argNames,
    `${dedupText}\n${oascText}; return onApplicationStatusChange;`
  )(...argNames.map((n) => scope[n]));
  return { fn, calls };
}

const interviewInvitationDedupKey = new Function(
  'createHash',
  `${dedupText}; return interviewInvitationDedupKey;`
)(createHash);

// --- 2/3. Stage move (no interviewWhen) creates no invitation email and no invitation copy ---
{
  const { fn, calls } = buildAutomationHarness();
  await fn({ applicationId: 'app-1', userId: 'user-1', status: 'interview', jobTitle: 'Android Developer' });

  check(calls.emails.length === 0, '2. A stage move to interview queues NO interviewInvitation email job');
  check(calls.notifications.length === 1, '3. Exactly one stage notification is still created (the stage change is real)');
  const n = calls.notifications[0];
  check(
    n.title === 'Moved to interview stage: Android Developer',
    '3. The notification title states the stage move and does not claim an invitation'
  );
  check(
    !/invitation|invited|scheduled/i.test(n.title),
    '3. No appointment/invitation wording appears when no appointment exists'
  );
  check(n.type === 'application.interview', 'The notification type is unchanged for response compatibility');
}

// --- 11. Genuine appointment (interviewWhen present) restores the invitation ---
{
  const { fn, calls } = buildAutomationHarness();
  const when = new Date('2026-09-01T09:30:00.000Z');
  await fn({ applicationId: 'app-1', userId: 'user-1', status: 'interview', jobTitle: 'Android Developer', interviewWhen: when, interviewLink: '' });

  check(calls.emails.length === 1, '11. A genuine appointment queues exactly one invitation email job');
  check(calls.emails[0].templateKey === 'interviewInvitation', '11. The invitation template is unchanged');
  check(calls.emails[0].vars.when === when, '11/12. The email now carries a real appointment time');
  check(
    calls.emails[0].dedupKey.startsWith(`email:interview:app-1:${when.toISOString()}:`),
    'B3. The dedup key identifies the appointment, not merely the application'
  );
  check(
    calls.notifications[0].title === 'Interview invitation: Android Developer',
    '10. Invitation wording is restored when an appointment genuinely exists'
  );
}

// ---------------------------------------------------------------------------
// PF-EMP-INT-B3 — the invitation dedup identity is the appointment
//
// Before B3 the key was `email:interview:<applicationId>`, so the first invitation an
// application ever queued blocked every later one: a genuine reschedule emitted a new
// in-app notification while the only queued email still carried the old time
// (docs/STRIDETO_PF_EMP_INT_B2_LIVE_ACCEPTANCE.md §8).
// ---------------------------------------------------------------------------

{
  const first = new Date('2026-09-01T09:30:00.000Z');
  const second = new Date('2026-09-03T14:00:00.000Z');
  const base = { when: first, mode: 'video', link: '', location: '' };
  const key = (extra = {}) => interviewInvitationDedupKey('app-1', { ...base, ...extra });

  check(
    key() !== interviewInvitationDedupKey('app-1', { ...base, when: second }),
    'B3-3. A genuine reschedule to a different instant yields a NEW dedup key, so a new invitation can be queued'
  );
  check(
    key() === key(),
    'B3-4. The key is deterministic — an identical appointment always yields the same key, so no duplicate email'
  );
  check(
    key() === key({ when: new Date(first.getTime()) }),
    'B3-4. Equality is by instant, not by object identity'
  );
  check(
    key() !== interviewInvitationDedupKey('app-2', base),
    'B3. The same appointment on a different application stays a distinct invitation'
  );

  // --- PF-EMP-INT-B3A: every field the invitation communicates is part of the identity ---
  check(
    key({ link: 'https://meet.example/a' }) !== key(),
    'B3A-1. Adding a joining link changes what the invitation must say, so it earns a new key'
  );
  check(
    key({ link: 'https://meet.example/a' }) !== key({ link: 'https://meet.example/b' }),
    'B3A-1. A changed joining link at the same instant yields a new key'
  );
  check(
    key({ mode: 'in_person' }) !== key({ mode: 'video' }),
    'B3A-2. A changed method at the same instant yields a new key — the candidate is told how to attend'
  );
  check(
    key({ mode: 'phone' }) !== key({ mode: 'in_person' }),
    'B3A-2. Every distinct method is a distinct appointment identity'
  );
  check(
    key({ mode: 'in_person', location: 'HQ, Lahore' }) !== key({ mode: 'in_person', location: 'Office 2, Karachi' }),
    'B3A-3. A changed physical location at the same instant yields a new key'
  );
  check(
    key({ mode: 'in_person', location: 'HQ' }) !== key({ mode: 'in_person' }),
    'B3A-3. Adding a location where there was none yields a new key'
  );
  check(
    key({ mode: '' }) === key({ mode: 'video' }),
    'B3A. An absent method normalizes to the schema default — it does not fabricate a second appointment'
  );
  check(
    key({ link: '  ' }) === key({ link: '' }) && key({ location: '  ' }) === key({ location: '' }),
    'B3A. Whitespace-only fields do not fabricate a distinct appointment'
  );
  check(
    key({ mode: 'in_person', location: 'A B' }) !== key({ mode: 'in_person', link: 'A', location: 'B' }),
    'B3A. Field framing is unambiguous — values cannot slide across the separator into the same digest'
  );

  // --- Key hygiene ---
  const longLink = `https://meet.example/${'x'.repeat(2000)}`;
  const longLocation = 'Street '.repeat(400);
  const bigKey = key({ mode: 'in_person', link: longLink, location: longLocation });
  check(bigKey.length < 120, 'B3A. The key stays index-safe regardless of field length');
  check(
    !bigKey.includes('meet.example') && !bigKey.includes('Street') && !bigKey.includes('HQ'),
    'B3A. Raw meeting URLs and physical addresses never appear in the dedup key'
  );
  check(
    bigKey.startsWith(`email:interview:app-1:${first.toISOString()}:`),
    'B3A. The instant stays legible in the key so a queued job can be correlated by inspection'
  );

  check(
    key() !== 'email:interview:app-1',
    'B3-A. The superseded per-application key form is no longer produced'
  );
  check(
    !/dedupKey: `email:interview:\$\{applicationId\}`/.test(automationSrc),
    'B3-A. The per-application dedup literal is gone from the shipped source'
  );
}

// ---------------------------------------------------------------------------
// PF-EMP-INT-B3A — the invitation communicates every instruction it keys on
// ---------------------------------------------------------------------------

{
  const when = new Date('2026-09-01T09:30:00.000Z');

  const remote = renderEmailTemplate('interviewInvitation', 'en', {
    name: 'Candidate', jobTitle: 'Android Developer', when, mode: 'video', link: 'https://meet.example/abc', location: '',
  });
  check(remote.html.includes(String(when)), 'B3A-4. The invitation states the scheduled time');
  check(remote.html.includes('Video call'), 'B3A-4. The invitation states the method');
  check(remote.html.includes('https://meet.example/abc'), 'B3A-4. A remote invitation carries the joining link');
  check(!/Location:/.test(remote.html), 'B3A-4. A remote invitation does not fabricate a physical location');

  const inPerson = renderEmailTemplate('interviewInvitation', 'en', {
    name: 'Candidate', jobTitle: 'Android Developer', when, mode: 'in_person', link: '', location: 'HQ, Lahore',
  });
  check(inPerson.html.includes('In person'), 'B3A-4. An in-person invitation states the method');
  check(inPerson.html.includes('HQ, Lahore'), 'B3A-4. An in-person invitation carries the physical location');
  check(inPerson.text.includes('HQ, Lahore'), 'B3A-4. The plain-text part carries it too');
  check(!/Join \/ Details/.test(inPerson.html), 'B3A-4. An in-person invitation does not offer a joining link it does not have');

  const urdu = renderEmailTemplate('interviewInvitation', 'ur', {
    name: 'امیدوار', jobTitle: 'Android Developer', when, mode: 'video', link: 'https://meet.example/abc', location: '',
  });
  check(urdu.html.includes('https://meet.example/abc'), 'B3A-4. The Urdu invitation no longer drops the joining link');
  check(urdu.html.includes('ویڈیو کال'), 'B3A-4. The Urdu invitation states the method in Urdu');

  const injected = renderEmailTemplate('interviewInvitation', 'en', {
    name: 'Candidate', jobTitle: 'Android Developer', when, mode: 'in_person', link: '', location: '<script>alert(1)</script>',
  });
  check(
    !injected.html.includes('<script>') && injected.html.includes('&lt;script&gt;'),
    'B3A. Employer-supplied location is escaped before it reaches the candidate'
  );

  const bare = renderEmailTemplate('interviewInvitation', 'en', { jobTitle: 'Android Developer', when });
  check(!/Method:/.test(bare.html) && !/Location:/.test(bare.html), 'B3A. Absent details are omitted, never rendered empty');
}

// --- B3-3: a reschedule through the real hook queues a second, distinct invitation ---
{
  const { fn, calls } = buildAutomationHarness();
  const first = new Date('2026-09-01T09:30:00.000Z');
  const second = new Date('2026-09-03T14:00:00.000Z');

  await fn({ applicationId: 'app-1', userId: 'user-1', status: 'interview', jobTitle: 'Android Developer', interviewWhen: first, interviewLink: '', interviewMode: 'video', interviewLocation: '' });
  await fn({ applicationId: 'app-1', userId: 'user-1', status: 'interview', jobTitle: 'Android Developer', interviewWhen: second, interviewLink: '', interviewMode: 'video', interviewLocation: '' });

  check(calls.emails.length === 2, 'B3-3. A genuine reschedule queues a second invitation job');
  check(
    calls.emails[0].dedupKey !== calls.emails[1].dedupKey,
    'B3-3. The two invitations carry distinct dedup keys, so the queue will not collapse them'
  );
  check(calls.emails[1].vars.when === second, 'B3-3. The new invitation carries the NEW appointment');
  check(calls.emails[1].templateKey === 'interviewInvitation', 'B3-3. Still the same invitation template');
}

// --- B3A-1/2/3: same instant, changed instructions — through the real hook ---
{
  const when = new Date('2026-09-01T09:30:00.000Z');
  const invite = async (extra) => {
    const { fn, calls } = buildAutomationHarness();
    await fn({
      applicationId: 'app-1', userId: 'user-1', status: 'interview', jobTitle: 'Android Developer',
      interviewWhen: when, interviewMode: 'video', interviewLink: '', interviewLocation: '', ...extra,
    });
    return calls.emails[0];
  };

  const baseline = await invite({});
  const linkAdded = await invite({ interviewLink: 'https://meet.example/abc' });
  const modeChanged = await invite({ interviewMode: 'in_person', interviewLocation: 'HQ, Lahore' });
  const locationChanged = await invite({ interviewMode: 'in_person', interviewLocation: 'Office 2, Karachi' });
  const repeated = await invite({});

  check(linkAdded.dedupKey !== baseline.dedupKey, 'B3A-1. Same time + changed link queues under a NEW key');
  check(linkAdded.vars.link === 'https://meet.example/abc', 'B3A-1. And the invitation carries the new link');

  check(modeChanged.dedupKey !== baseline.dedupKey, 'B3A-2. Same time + changed method queues under a NEW key');
  check(modeChanged.vars.mode === 'in_person', 'B3A-2. And the invitation carries the new method');

  check(locationChanged.dedupKey !== modeChanged.dedupKey, 'B3A-3. Same time + changed location queues under a NEW key');
  check(locationChanged.vars.location === 'Office 2, Karachi', 'B3A-3. And the invitation carries the new location');

  check(
    repeated.dedupKey === baseline.dedupKey,
    'B3A-5. An identical effective appointment reuses the same key — enqueueJob deduplicates it to zero new jobs'
  );
  check(
    new Set([baseline, linkAdded, modeChanged, locationChanged].map((e) => e.dedupKey)).size === 4,
    'B3A. Each materially different set of candidate instructions is exactly one distinct invitation'
  );
}

// --- Unrelated statuses are untouched ---
{
  const { fn, calls } = buildAutomationHarness();
  await fn({ applicationId: 'app-1', userId: 'user-1', status: 'shortlisted', jobTitle: 'Android Developer' });
  check(calls.notifications[0].title === 'Shortlisted for Android Developer', 'Non-interview statuses keep their existing copy');
  check(calls.emails.length === 0, 'Shortlisted still queues no interview email');
}

// ---------------------------------------------------------------------------
// Part 3 — boundary facts not executable here
// ---------------------------------------------------------------------------

{
  const transitionFn = intelligenceSrc.slice(
    intelligenceSrc.indexOf('async transitionPipeline('),
    intelligenceSrc.indexOf('async addNote(')
  );
  check(
    /await OpportunityApplicationRepository\.pushStageHistory\(oa\._id, historyEntry\);/.test(transitionFn),
    '4/5. The stage move still appends exactly one canonical history entry and synchronizes the tracker'
  );
  check(
    /const legacyStatus = PIPELINE_TO_LEGACY_STATUS\[toStage\] \|\| application\.status;/.test(transitionFn),
    '6. Legacy status projection is unchanged'
  );
  check(
    !/setInterview|interview\.scheduledAt\s*=/.test(transitionFn),
    '7/15. transitionPipeline never writes the interview subdocument, so existing appointments cannot be erased by a stage change'
  );
  check(
    /if \(oa && oa\.pipelineStage === toStage\)/.test(transitionFn),
    '16. The PF-EMP-UX-B4A same-stage no-op guard is unchanged'
  );
  check(
    /const application = await getOwnedLegacyApplication\(employerId, legacyApplicationId\);/.test(transitionFn),
    '18. Employer ownership is still resolved before any work'
  );

  const scheduleFn = intelligenceSrc.slice(
    intelligenceSrc.indexOf('async scheduleInterview('),
    intelligenceSrc.indexOf('async completeInterview(')
  );
  check(
    /interviewWhen:\s*isAppointmentChanged\s*\?\s*finalInterview\.scheduledAt\s*:\s*null/.test(scheduleFn),
    '11. scheduleInterview now passes the real appointment time into the notification/email path only when genuinely changed'
  );
  check(
    !/interviewWhen:\s*null/.test(scheduleFn.split('isAppointmentChanged')[0]),
    'Dateless genuine appointment invitations remain impossible — the genuine scheduling branch must provide the real appointment datetime'
  );
  check(
    /interviewLink:\s*isAppointmentChanged\s*\?/.test(scheduleFn),
    'Conditional appointment-evidence protection: link evidence is also withheld when appointment is unchanged'
  );
  check(
    /getOwnedLegacyApplication\(employerId, legacyApplicationId\)/.test(scheduleFn),
    '18. scheduleInterview still enforces Employer ownership before persisting'
  );

  const oaService = readFileSync(path.join(serverSrc, 'services/career/OpportunityApplicationService.js'), 'utf8');
  check(
    /const existing = await getOwnedApplication\(userId, applicationId\);/.test(
      oaService.slice(oaService.indexOf('async upsertInterview('), oaService.indexOf('async upsertInterview(') + 400)
    ),
    '19/20. Candidate ownership on the User interview route is unchanged — no cross-tenant exposure introduced'
  );
  check(
    /'InterviewScheduled',/.test(oaService),
    '9. The candidate-side genuine scheduler still emits InterviewScheduled — untouched by this phase'
  );

  const bridge = readFileSync(path.join(serverSrc, 'services/career/careerNotificationBridge.js'), 'utf8');
  check(
    /const opportunityApplicationId = event\.payload\?\.opportunityApplicationId \|\| null;/.test(bridge),
    '21. PF-EMP-UX-B2 notification-link behavior is unchanged'
  );
  check(
    /'InterviewScheduled',/.test(bridge),
    '21. InterviewScheduled remains a notifying event — only its false producer was removed'
  );

  check(
    !/recordView/.test(transitionFn) || /recordView: false/.test(transitionFn),
    '17. CandidateViewed behavior is unchanged by this phase'
  );
}

console.log(`employerInterviewStageTruthfulness.test.js: ${count} assertions passed`);
