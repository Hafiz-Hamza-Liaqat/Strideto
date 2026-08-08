/**
 * PF-EMP-UX-B5B — Employer pipeline transition notifications must be correlated
 * to the individual Application, never globally deduplicated to an `undefined`
 * identity.
 *
 * Confirmed defect (docs — PF-EMP-UX-B5A audit, finding B5A-01):
 * `EmployerIntelligenceService.transitionPipeline` called
 * `onApplicationStatusChange(application)` with the raw Mongoose document, so
 * `applicationId`/`jobTitle` resolved to `undefined`. Every dedup key collapsed
 * to the global constants `application:status:undefined:<status>` /
 * `email:offer:undefined` (jobQueueService.enqueueJob dedups globally, across
 * pending/processing/completed), suppressing all but the first candidate
 * platform-wide, and the candidate copy rendered "... undefined".
 *
 * The fix correlates every side effect to the real legacy Application id and its
 * real job title, and separates the two concerns that were fused inside
 * onApplicationStatusChange:
 *   - milestone stages already notify the candidate through emitHiringEvent →
 *     careerNotificationBridge, so transitionPipeline must NOT re-notify for them;
 *   - the transactional offer-letter email is the one legacy side effect unique to
 *     onApplicationStatusChange and is preserved (notify:false) on hire;
 *   - non-milestone stages (the bridge is silent for them) still get their status
 *     notification.
 *
 * Part 1 re-binds the real `transitionPipeline` against recording fakes so the
 * per-stage call behavior is exercised as actual behavior. Part 2 re-binds the
 * real `onApplicationStatusChange` (+ its pure dedup-key helper) against fakes so
 * the dedup identities and rendered copy are the shipped ones. Part 3 is a small
 * set of source-boundary checks for the invariants no runtime harness reaches.
 * Source-contract style matches this repository's established convention.
 *
 * Run: node src/__tests__/employerPipelineTransitionNotification.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { formatAppointmentTime } from '../utils/appointmentTime.js';

let count = 0;
function check(condition, message) {
  assert.ok(condition, message);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const serverSrc = path.resolve(here, '..');
const repoRoot = path.resolve(serverSrc, '..', '..');

const serviceSrc = readFileSync(path.join(serverSrc, 'services/career/EmployerIntelligenceService.js'), 'utf8');
const automationSrc = readFileSync(path.join(serverSrc, 'services/automationService.js'), 'utf8');
const employerConstantsSrc = readFileSync(path.join(repoRoot, 'shared/employer/constants.js'), 'utf8');

// ---------------------------------------------------------------------------
// The canonical legacy↔pipeline maps, cross-checked against the shipped module
// so the harness can never silently drift from production semantics.
// ---------------------------------------------------------------------------
const PIPELINE_STAGES = ['interested', 'preparing', 'applied', 'viewed', 'screening', 'assessment', 'interview', 'offer', 'negotiation', 'accepted', 'joined', 'rejected', 'withdrawn'];
const LEGACY_STATUS_TO_PIPELINE = { submitted: 'applied', applied: 'applied', viewed: 'viewed', shortlisted: 'screening', interview: 'interview', hired: 'accepted', rejected: 'rejected' };
const PIPELINE_TO_LEGACY_STATUS = {
  interested: 'submitted', preparing: 'submitted', applied: 'applied', viewed: 'viewed',
  screening: 'shortlisted', assessment: 'shortlisted', interview: 'interview', offer: 'interview',
  negotiation: 'interview', accepted: 'hired', joined: 'hired', rejected: 'rejected', withdrawn: 'rejected',
};
check(
  /screening: 'shortlisted'/.test(employerConstantsSrc)
    && /accepted: 'hired'/.test(employerConstantsSrc)
    && /joined: 'hired'/.test(employerConstantsSrc)
    && /offer: 'interview'/.test(employerConstantsSrc),
  '0. The harness legacy↔pipeline maps match the shipped shared/employer/constants.js (accepted/joined→hired, screening→shortlisted, offer→interview)'
);

// Faithful copy of the shipped eventForPipelineStage milestone set; Part 3 pins it
// to the real source so it cannot drift.
function eventForPipelineStage(s) {
  switch (s) {
    case 'screening': return 'CandidateShortlisted';
    case 'offer':
    case 'negotiation': return 'OfferSent';
    case 'accepted': return 'OfferAccepted';
    case 'joined': return 'CandidateHired';
    case 'rejected':
    case 'withdrawn': return 'CandidateRejected';
    default: return null; // interview, assessment, applied, viewed, interested, preparing
  }
}

// ===========================================================================
// Part 1 — transitionPipeline call behavior (real method body, recording fakes)
// ===========================================================================

const bodyStart = serviceSrc.indexOf('async transitionPipeline(employerId, legacyApplicationId, body = {}) {');
const bodyEnd = serviceSrc.indexOf('async addNote(employerId, legacyApplicationId, body = {}) {');
assert.ok(bodyStart !== -1 && bodyEnd !== -1 && bodyStart < bodyEnd, 'transitionPipeline body located in the shipped service');
const transitionText = serviceSrc.slice(bodyStart, bodyEnd).trim().replace(/,\s*$/, '');

function buildTransitionHarness({ currentStage, legacyStatus, appId = 'app-1', jobTitle = 'Android Developer', linked = true }) {
  const calls = { onApplicationStatusChange: [], emitHiringEvent: [], pushStageHistory: [], applicationSaves: 0 };
  const application = {
    _id: appId,
    status: legacyStatus,
    userId: { _id: 'user-1' },
    jobId: { _id: 'job-1', title: jobTitle },
    talentProfileId: null,
    save: async () => { calls.applicationSaves += 1; },
  };
  const oaDoc = linked ? { _id: 'oa-1', pipelineStage: currentStage, stageTemplateId: 'job_default' } : null;

  const scope = {
    assertEnabled: () => {},
    getOwnedLegacyApplication: async () => application,
    sanitizeString: (v) => String(v || '').trim(),
    PIPELINE_STAGES,
    LEGACY_STATUS_TO_PIPELINE,
    PIPELINE_TO_LEGACY_STATUS,
    onApplicationStatusChange: async (args) => { calls.onApplicationStatusChange.push(args); },
    OpportunityApplicationRepository: {
      findByLegacyApplicationId: async () => oaDoc,
      pushStageHistory: async (id, entry) => { calls.pushStageHistory.push({ id, entry }); },
    },
    canTransition: () => true,
    eventForPipelineStage,
    emitHiringEvent: (type, payload) => { calls.emitHiringEvent.push({ type, payload }); },
    employerActor: (id) => ({ type: 'employer', id }),
    JobVacancyService: { syncVacancyAfterHire: async () => {} },
  };

  const self = {
    getCandidateDetail: async () => ({ candidateId: 'cand-1', pipelineStage: oaDoc ? oaDoc.pipelineStage : null }),
  };
  const argNames = Object.keys(scope);
  self.transitionPipeline = new Function(...argNames, `return ({ ${transitionText} });`)(...argNames.map((n) => scope[n])).transitionPipeline;
  return { self, calls, application };
}

// --- 1. A hire (milestone) sends the offer email only, correlated + notify:false ---
{
  const { self, calls } = buildTransitionHarness({ currentStage: 'offer', legacyStatus: 'interview', appId: 'app-A' });
  const res = await self.transitionPipeline('emp-1', 'app-A', { toStage: 'accepted' });
  check(res.changed === true, '1. accepted is a real transition');
  check(calls.emitHiringEvent.length === 1 && calls.emitHiringEvent[0].type === 'OfferAccepted', '1. The bridge milestone event (OfferAccepted) is emitted for the candidate notification');
  check(calls.onApplicationStatusChange.length === 1, '1. onApplicationStatusChange is invoked exactly once on hire (for the transactional email)');
  const p = calls.onApplicationStatusChange[0];
  check(p.applicationId === 'app-A', '1. It is correlated to the real Application id, never undefined');
  check(p.jobTitle === 'Android Developer', '4. The real job title travels to the payload, never undefined');
  check(p.status === 'hired', '1. The legacy hire status is passed');
  check(p.notify === false, '5/E. notify:false suppresses the duplicate in-app notification (the bridge already notified)');
}

// --- 2. A second application to the same stage gets its OWN correlated payload ---
{
  const hA = buildTransitionHarness({ currentStage: 'offer', legacyStatus: 'interview', appId: 'app-A' });
  const hB = buildTransitionHarness({ currentStage: 'offer', legacyStatus: 'interview', appId: 'app-B' });
  await hA.self.transitionPipeline('emp-1', 'app-A', { toStage: 'accepted' });
  await hB.self.transitionPipeline('emp-1', 'app-B', { toStage: 'accepted' });
  check(
    hA.calls.onApplicationStatusChange[0].applicationId === 'app-A'
      && hB.calls.onApplicationStatusChange[0].applicationId === 'app-B',
    '2/C. Two different applications moving to the same stage carry distinct application ids into their side effects'
  );
}

// --- 3. A non-hired milestone stage does NOT re-notify (bridge owns it) ---
{
  const { self, calls } = buildTransitionHarness({ currentStage: 'applied', legacyStatus: 'applied' });
  await self.transitionPipeline('emp-1', 'app-1', { toStage: 'screening' });
  check(calls.emitHiringEvent.length === 1 && calls.emitHiringEvent[0].type === 'CandidateShortlisted', '5. The bridge emits the shortlist milestone notification');
  check(calls.onApplicationStatusChange.length === 0, '5/E. onApplicationStatusChange is NOT called for a non-hired milestone stage — no double-notification');
}

// --- 6. A non-milestone stage (bare interview column move) still notifies, correlated ---
{
  const { self, calls } = buildTransitionHarness({ currentStage: 'screening', legacyStatus: 'shortlisted', appId: 'app-C' });
  await self.transitionPipeline('emp-1', 'app-C', { toStage: 'interview' });
  check(calls.emitHiringEvent.length === 0, '6. No milestone event is emitted for a bare interview-stage move (B1: no appointment exists)');
  check(calls.onApplicationStatusChange.length === 1, '6. The legacy status notification still fires (the bridge is silent for this stage)');
  const p = calls.onApplicationStatusChange[0];
  check(p.applicationId === 'app-C' && p.status === 'interview', '6. It is correlated to the real Application id with the interview status');
  check(p.notify !== false, '6. notify is left at its default (true) so the candidate is actually notified');
}

// --- 7. A same-stage repeat is a no-op — zero side effects ---
{
  const { self, calls } = buildTransitionHarness({ currentStage: 'joined', legacyStatus: 'hired' });
  const res = await self.transitionPipeline('emp-1', 'app-1', { toStage: 'joined' });
  check(res.changed === false, '7. joined -> joined returns changed:false');
  check(
    calls.onApplicationStatusChange.length === 0 && calls.emitHiringEvent.length === 0 && calls.pushStageHistory.length === 0 && calls.applicationSaves === 0,
    '7/D. A same-stage repeat produces no notification, no email, no history and no write'
  );
}

// ===========================================================================
// Part 2 — onApplicationStatusChange dedup identities & copy (real body)
// ===========================================================================

const oascStart = automationSrc.indexOf('export async function onApplicationStatusChange(');
const oascEnd = automationSrc.indexOf('\nexport ', oascStart + 10);
assert.ok(oascStart !== -1 && oascEnd !== -1, 'onApplicationStatusChange located in the shipped service');
const oascText = automationSrc.slice(oascStart, oascEnd).replace(/^export\s+/, '');
const dedupStart = automationSrc.indexOf('export function interviewInvitationDedupKey(');
const dedupEnd = automationSrc.indexOf('\nexport ', dedupStart + 10);
const dedupText = automationSrc.slice(dedupStart, dedupEnd).replace(/^export\s+/, '');

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
  const fn = new Function(...argNames, `${dedupText}\n${oascText}; return onApplicationStatusChange;`)(...argNames.map((n) => scope[n]));
  return { fn, calls };
}

// --- 3. Offer email is application-scoped and never email:offer:undefined ---
{
  const { fn, calls } = buildAutomationHarness();
  await fn({ applicationId: 'app-A', userId: 'user-1', status: 'hired', jobTitle: 'Android Developer', notify: false });
  check(calls.notifications.length === 0, '3/E. notify:false emits zero in-app notifications (no duplicate of the bridge milestone)');
  check(calls.emails.length === 1 && calls.emails[0].templateKey === 'offerLetter', '3/F. The transactional offer-letter email is still sent on hire');
  check(calls.emails[0].dedupKey === 'email:offer:app-A', '3/A. The offer email dedup key is application-scoped (email:offer:app-A), never email:offer:undefined');
  check(!/undefined/.test(calls.emails[0].dedupKey), '3/A. No undefined ever appears in the offer email dedup key');
  check(calls.emails[0].vars.jobTitle === 'Android Developer', '4. The real job title reaches the offer email payload');
}

// --- 3b. A different application yields a DISTINCT offer key ---
{
  const a = buildAutomationHarness();
  const b = buildAutomationHarness();
  await a.fn({ applicationId: 'app-A', userId: 'u', status: 'hired', jobTitle: 'X', notify: false });
  await b.fn({ applicationId: 'app-B', userId: 'u', status: 'hired', jobTitle: 'X', notify: false });
  check(
    a.calls.emails[0].dedupKey === 'email:offer:app-A' && b.calls.emails[0].dedupKey === 'email:offer:app-B',
    '3/C. Two different applications reaching hired produce distinct application-scoped offer keys'
  );
}

// --- 6. Non-milestone status notification (notify default true) is correlated ---
{
  const { fn, calls } = buildAutomationHarness();
  await fn({ applicationId: 'app-C', userId: 'user-1', status: 'interview', jobTitle: 'Android Developer' });
  check(calls.notifications.length === 1, '6. A status change with notify defaulting true creates exactly one notification');
  check(calls.notifications[0].dedupKey === 'application:status:app-C:interview', '6/A. The status notification dedup key is application-scoped, never application:status:undefined:interview');
  check(calls.notifications[0].title === 'Moved to interview stage: Android Developer', '6/1. The title carries the real job title, never "... undefined"');
  check(calls.emails.length === 0, '6. A bare stage move queues no email (B1 truthfulness preserved)');
}

// --- Legacy PATCH contract unchanged: default notify still notifies AND emails on hire ---
{
  const { fn, calls } = buildAutomationHarness();
  await fn({ applicationId: 'app-D', userId: 'user-1', status: 'hired', jobTitle: 'Android Developer' });
  check(calls.notifications.length === 1 && calls.notifications[0].title === 'Offer for Android Developer', 'H. With notify defaulting true (the legacy Applications PATCH path), the in-app notification still fires');
  check(calls.emails.length === 1 && calls.emails[0].dedupKey === 'email:offer:app-D', 'H. ...and the offer email still fires — the PATCH path is behaviorally unchanged');
}

// ===========================================================================
// Part 3 — source-boundary invariants (B1-B4 preserved, ownership, no raw doc)
// ===========================================================================

const transitionFn = serviceSrc.slice(bodyStart, bodyEnd);
{
  // 9. The raw-document call is gone; the sync is correlated to the real id.
  check(!/onApplicationStatusChange\(application\)/.test(transitionFn), '8/1. transitionPipeline no longer passes the raw Mongoose document to onApplicationStatusChange');
  check(/applicationId: application\._id/.test(transitionFn), '1. The side-effect payload is correlated to application._id');
  check(/jobTitle: application\.jobId\?\.title \|\| 'Job'/.test(transitionFn), '4. The job title comes from the populated Job document');

  // 9. Ownership is still resolved before any write.
  const ownershipIdx = transitionFn.indexOf('getOwnedLegacyApplication(employerId, legacyApplicationId)');
  const firstWriteIdx = transitionFn.indexOf('application.status = legacyStatus;');
  check(ownershipIdx !== -1 && firstWriteIdx !== -1 && ownershipIdx < firstWriteIdx, '9. getOwnedLegacyApplication (404 on cross-tenant) still runs before any write');

  // B1: the interview stage still produces no milestone event.
  const evStart = serviceSrc.indexOf('function eventForPipelineStage(');
  const evBody = serviceSrc.slice(evStart, serviceSrc.indexOf('\n}', evStart));
  check(!/return 'InterviewScheduled'/.test(evBody), '8/B1. eventForPipelineStage still returns no InterviewScheduled event for a stage move (the name survives only in the B1 rationale comment)');
  check(/case 'screening':\s*\n\s*return 'CandidateShortlisted';/.test(evBody), 'B1. The milestone set the harness copies is the shipped one (screening→CandidateShortlisted)');
  check(/default:\s*\n\s*return null;/.test(evBody), 'B1. Non-milestone stages (incl. interview) fall through to null');

  // B2/B3: the genuine interview scheduler still passes the structured, appointment-gated payload.
  check(
    /interviewWhen: isAppointmentChanged \? finalInterview\.scheduledAt : null/.test(serviceSrc),
    'B2/B3. scheduleInterview still passes the appointment-gated structured payload — untouched'
  );
}
{
  // automationService: notify flag added, offer email kept outside the notify block.
  check(/notify = true \}\) \{/.test(automationSrc) || /interviewTimeZone, notify = true \}/.test(automationSrc), 'H. onApplicationStatusChange gained a backward-compatible notify flag (default true)');
  check(/dedupKey: `email:offer:\$\{applicationId\}`,/.test(automationSrc), 'F/A. The offer email dedup key remains application-scoped in the shipped source');
  const hiredIdx = automationSrc.indexOf("if (status === 'hired') {", oascStart);
  const notifyBlockIdx = automationSrc.indexOf('if (notify) {', oascStart);
  check(notifyBlockIdx !== -1 && hiredIdx !== -1 && notifyBlockIdx < hiredIdx, 'F. The offer-letter email sits outside the notify block, so notify:false still sends it');
}
{
  // B4: candidate-side interview ownership guard still present (unrelated file, unchanged).
  const oaService = readFileSync(path.join(serverSrc, 'services/career/OpportunityApplicationService.js'), 'utf8');
  check(/legacyApplicationId/.test(oaService) && /403/.test(oaService), 'B4. Candidate interview ownership 403 guard remains present in OpportunityApplicationService.js — untouched');
}

console.log(`employerPipelineTransitionNotification.test.js: ${count} assertions passed`);
