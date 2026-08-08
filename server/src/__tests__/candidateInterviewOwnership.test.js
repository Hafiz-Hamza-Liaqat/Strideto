import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// PF-EMP-INT-B4 — Candidate interview ownership boundary + notification correlation.
//
// The candidate `PUT /applications/:id/interview` path used to write the same
// OpportunityApplication.interview subdocument the Employer scheduler owns, letting a
// candidate silently overwrite an Employer-scheduled appointment (audit P1 item 3), and
// it emitted InterviewScheduled without an `opportunityApplicationId`, so the in-app
// notification fell back to the generic /applications route.
//
// The shipped `upsertInterview` is re-bound verbatim below and exercised against a
// spon harness so the assertions test the real shipped control flow, not a stub.

let count = 0;
function check(condition, message) {
  assert.ok(condition, message);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const serverSrc = path.resolve(here, '..');

const serviceSrc = readFileSync(path.join(serverSrc, 'services/career/OpportunityApplicationService.js'), 'utf8');

const bodyStart = serviceSrc.indexOf('async upsertInterview(userId, applicationId, body, actor) {');
const bodyEnd = serviceSrc.indexOf('getAllowedTransitions(application) {');
assert.ok(bodyStart !== -1 && bodyEnd !== -1 && bodyStart < bodyEnd, 'upsertInterview body located in the shipped service');
const methodText = serviceSrc.slice(bodyStart, bodyEnd).trim().replace(/,\s*$/, '');

function buildHarness({ legacyApplicationId, currentInterview = {} }) {
  const calls = {
    setInterview: [],
    emit: [],
  };

  const existing = {
    _id: 'oa-1',
    userId: 'user-1',
    talentProfileId: 'tp-1',
    status: 'active',
    legacyApplicationId,
    interview: currentInterview,
  };

  const scope = {
    getOwnedApplication: async () => existing,
    ApplicationValidationService: {
      assertInterview: (b = {}) => ({
        scheduledAt: b.scheduledAt ?? null,
        mode: b.mode ?? 'video',
        location: b.location ?? '',
        meetingUrl: b.meetingUrl ?? '',
        notes: b.notes ?? '',
        outcome: b.outcome ?? '',
      }),
    },
    OpportunityApplicationRepository: {
      setInterview: async (id, interview) => {
        calls.setInterview.push({ id, interview });
        return { _id: id, interview };
      },
    },
    toPlain: (doc) => doc,
    emitApplicationEvent: (eventType, application, payload, actor) => {
      calls.emit.push({ eventType, application, payload, actor });
      return { eventId: 'evt-1' };
    },
    actorFromUserId: (userId) => ({ type: 'talent', id: String(userId) }),
  };

  const argNames = Object.keys(scope);
  const factory = new Function(...argNames, `return ({ ${methodText} });`);
  const upsertInterview = factory(...argNames.map((n) => scope[n])).upsertInterview;

  return { upsertInterview, calls, existing };
}

// ---------------------------------------------------------------------------
// Employer-owned appointment: every scheduling field is rejected, zero side effects.
// ---------------------------------------------------------------------------
{
  const employerAppointment = {
    scheduledAt: new Date('2026-08-15T13:15:00.000Z'),
    timeZone: 'Asia/Karachi',
    mode: 'video',
    meetingUrl: 'https://meet.example/strideto',
    location: 'HQ',
    notes: 'Employer note',
    outcome: 'Pending',
  };

  const mutations = [
    { field: 'scheduledAt', body: { scheduledAt: '2026-09-01T09:00:00.000Z' }, n: '1' },
    { field: 'timeZone', body: { timeZone: 'America/New_York' }, n: '2' },
    { field: 'mode', body: { mode: 'phone' }, n: '3' },
    { field: 'meetingUrl', body: { meetingUrl: 'https://evil.example/hijack' }, n: '4' },
    { field: 'location', body: { location: 'Candidate chosen cafe' }, n: '5' },
    { field: 'outcome', body: { outcome: 'Candidate says passed' }, n: '6' },
  ];

  for (const m of mutations) {
    const { upsertInterview, calls } = buildHarness({
      legacyApplicationId: 'legacy-1',
      currentInterview: { ...employerAppointment },
    });

    let error;
    try {
      await upsertInterview('user-1', 'oa-1', m.body, { type: 'talent', id: 'user-1' });
    } catch (e) {
      error = e;
    }

    check(error && error.status === 403, `${m.n}. A candidate cannot mutate ${m.field} on an Employer-owned appointment — the write is rejected (403).`);
    check(calls.setInterview.length === 0, `7. Blocked ${m.field} write performs zero OA interview writes (no updatedAt churn).`);
    check(calls.emit.length === 0, `7. Blocked ${m.field} write emits zero InterviewScheduled events (so zero invitation / notification / history).`);
  }
}

// ---------------------------------------------------------------------------
// Read projection is untouched: the guard rejects the write but the Employer
// appointment the candidate already owns-to-read is never altered.
// ---------------------------------------------------------------------------
{
  const employerAppointment = {
    scheduledAt: new Date('2026-08-15T13:15:00.000Z'),
    timeZone: 'Asia/Karachi',
    mode: 'video',
    meetingUrl: 'https://meet.example/strideto',
    location: 'HQ',
    outcome: '',
  };
  const { upsertInterview, calls, existing } = buildHarness({
    legacyApplicationId: 'legacy-1',
    currentInterview: { ...employerAppointment },
  });

  try {
    await upsertInterview('user-1', 'oa-1', { scheduledAt: '2026-09-01T09:00:00.000Z' }, null);
  } catch { /* expected 403 */ }

  check(existing.interview.scheduledAt.toISOString() === '2026-08-15T13:15:00.000Z', '8. The Employer appointment the candidate reads is left byte-identical after a blocked write.');
  check(existing.interview.timeZone === 'Asia/Karachi' && existing.interview.meetingUrl === 'https://meet.example/strideto', '8. Timezone and meeting link are preserved for the candidate read projection.');
  check(calls.setInterview.length === 0, '8. No write occurred, so the projection cannot have drifted.');
}

// ---------------------------------------------------------------------------
// Self-tracked (no employer link): the candidate keeps a self-managed appointment,
// and the emitted event now carries an exact application correlation.
// ---------------------------------------------------------------------------
{
  const { upsertInterview, calls } = buildHarness({
    legacyApplicationId: null,
    currentInterview: {},
  });

  const result = await upsertInterview('user-1', 'oa-1', {
    scheduledAt: '2026-09-01T09:00:00.000Z',
    mode: 'phone',
    location: 'Downtown office',
  }, { type: 'talent', id: 'user-1' });

  check(calls.setInterview.length === 1, 'Self-tracked: a candidate-owned appointment still persists exactly one write.');
  check(calls.setInterview[0].interview.scheduledAt instanceof Date, 'Self-tracked: scheduledAt is coerced to a Date before persistence.');
  check(calls.setInterview[0].interview.mode === 'phone' && calls.setInterview[0].interview.location === 'Downtown office', 'Self-tracked: the candidate-supplied fields are persisted.');
  check(calls.emit.length === 1, 'Self-tracked: exactly one InterviewScheduled event is emitted.');
  check(calls.emit[0].payload.opportunityApplicationId === 'oa-1', '9. The event carries the exact OpportunityApplication id — no /applications generic fallback.');
  check(result.interview.mode === 'phone', '8. The read projection returned to the candidate reflects the saved appointment.');
}

// ---------------------------------------------------------------------------
// Source-boundary checks — the ownership boundary lives on the server, not merely in
// a hidden Save button, and the correlation reaches the notification bridge.
// ---------------------------------------------------------------------------
{
  check(
    /if \(existing\.legacyApplicationId\)/.test(methodText),
    'Server enforcement: upsertInterview gates on legacyApplicationId — the authoritative employer-link signal.',
  );
  check(
    /err\.status = 403/.test(methodText) && methodText.indexOf('err.status = 403') < methodText.indexOf('setInterview'),
    'Server enforcement: the 403 is thrown BEFORE any setInterview write, guaranteeing zero persistence on a blocked write.',
  );
  check(
    /opportunityApplicationId: String\(plain\._id\)/.test(methodText),
    '9. The candidate InterviewScheduled event now supplies opportunityApplicationId for exact correlation.',
  );

  const bridge = readFileSync(path.join(serverSrc, 'services/career/careerNotificationBridge.js'), 'utf8');
  check(
    /const opportunityApplicationId = event\.payload\?\.opportunityApplicationId \|\| null;/.test(bridge),
    '9. The notification bridge reads opportunityApplicationId — the field the corrected event now provides — and only falls back to /applications when it is absent.',
  );

  // The Employer scheduling path (B1–B3) is untouched: it still owns writes via its own
  // service and repository patch method.
  const employerSrc = readFileSync(path.join(serverSrc, 'services/career/EmployerIntelligenceService.js'), 'utf8');
  check(
    /async scheduleInterview\(employerId, legacyApplicationId, body = \{\}\) \{/.test(employerSrc)
      && /async completeInterview\(employerId, legacyApplicationId, body = \{\}\) \{/.test(employerSrc),
    '10. Employer scheduling/completion entry points remain intact.',
  );

  // The candidate client no longer offers a Save control for an Employer-owned appointment.
  const panelSrc = readFileSync(
    path.resolve(serverSrc, '../../client/src/components/applications/InterviewPanel.jsx'),
    'utf8',
  );
  check(
    /employerOwned/.test(panelSrc) && /if \(employerOwned\) \{\s*return <ReadOnlyAppointment/.test(panelSrc),
    '11. The candidate panel renders a read-only appointment (no Save) when the interview is Employer-owned.',
  );
}

console.log(`candidateInterviewOwnership.test.js: ${count} assertions passed`);
