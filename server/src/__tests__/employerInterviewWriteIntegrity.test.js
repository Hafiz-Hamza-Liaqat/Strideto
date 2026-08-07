import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let count = 0;
function check(condition, message) {
  assert.ok(condition, message);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const serverSrc = path.resolve(here, '..');

const serviceSrc = readFileSync(path.join(serverSrc, 'services/career/EmployerIntelligenceService.js'), 'utf8');
const repoSrc = readFileSync(path.join(serverSrc, 'repositories/career/OpportunityApplicationRepository.js'), 'utf8');

const bodyStart = serviceSrc.indexOf('async scheduleInterview(employerId, legacyApplicationId, body = {}) {');
const bodyEnd = serviceSrc.indexOf('async completeInterview(employerId, legacyApplicationId, body = {}) {');
assert.ok(bodyStart !== -1 && bodyEnd !== -1 && bodyStart < bodyEnd, 'scheduleInterview body located in the shipped service');
const methodText = serviceSrc.slice(bodyStart, bodyEnd).trim().replace(/,\s*$/, '');

const repoBodyStart = repoSrc.indexOf('async patchInterview(id, patch) {');
const repoBodyEnd = repoSrc.indexOf('async updateReminderStatus(applicationId, reminderId, status) {');
assert.ok(repoBodyStart !== -1 && repoBodyEnd !== -1 && repoBodyStart < repoBodyEnd, 'patchInterview body located in the repository');
const repoMethodText = repoSrc.slice(repoBodyStart, repoBodyEnd).trim().replace(/,\s*$/, '');

function buildRepoHarness() {
  const calls = {
    findById: 0,
    findByIdAndUpdate: [],
  };

  const scope = {
    OpportunityApplication: {
      findByIdAndUpdate: async (id, patch, options) => {
        calls.findByIdAndUpdate.push({ id, patch, options });
        return { _id: id, ...patch.$set };
      },
    }
  };

  const self = {
    findById: async () => { calls.findById += 1; return {}; }
  };

  const argNames = Object.keys(scope);
  const factory = new Function(...argNames, `return ({ ${repoMethodText} });`);
  const methods = factory(...argNames.map((n) => scope[n]));
  self.patchInterview = methods.patchInterview.bind(self);
  return { self, calls };
}

function buildServiceHarness({ currentInterview, pipelineStage = 'interview', legacyStatus = 'interview', authError = null }) {
  const calls = {
    patchInterview: [],
    pushStageHistory: [],
    applicationSaves: 0,
    onApplicationStatusChange: [],
    emitHiringEvent: [],
    getCandidateDetail: [],
  };

  const application = {
    _id: 'app-1',
    status: legacyStatus,
    userId: { _id: 'user-1' },
    jobId: { _id: 'job-1', title: 'Test Job' },
    save: async () => {
      calls.applicationSaves += 1;
    },
  };

  const oaDoc = {
    _id: 'oa-1',
    pipelineStage,
    stageTemplateId: 'job_default',
    interview: currentInterview,
  };

  const scope = {
    assertEnabled: () => {},
    getOwnedLegacyApplication: async () => {
      if (authError) throw authError;
      return application;
    },
    sanitizeString: (v) => String(v || '').trim(),
    onApplicationStatusChange: async (args) => {
      calls.onApplicationStatusChange.push(args);
    },
    OpportunityApplicationRepository: {
      findByLegacyApplicationId: async () => oaDoc,
      patchInterview: async (id, patch) => {
        calls.patchInterview.push({ id, patch });
      },
      pushStageHistory: async (id, entry) => {
        calls.pushStageHistory.push({ id, entry });
      },
    },
    canTransition: () => true,
    emitHiringEvent: (type, payload) => {
      calls.emitHiringEvent.push({ type, payload });
    },
    employerActor: (id) => ({ type: 'employer', id }),
  };

  const self = {
    getCandidateDetail: async (employerId, legacyApplicationId, opts) => {
      calls.getCandidateDetail.push(opts);
      return { candidateId: 'cand-1', pipelineStage: oaDoc.pipelineStage };
    },
  };

  const argNames = Object.keys(scope);
  const factory = new Function(...argNames, `return ({ ${methodText} });`);
  self.scheduleInterview = factory(...argNames.map((n) => scope[n])).scheduleInterview.bind(self);

  return { self, calls, application, oaDoc, scope };
}

// --- Repository write integrity ---
{
  const { self, calls } = buildRepoHarness();
  self.patchInterview('oa-1', { scheduledAt: 'date', mode: 'video', meetingUrl: undefined });
  check(calls.findByIdAndUpdate.length === 1, '17. A genuine change performs exactly one patch write.');
  const $set = calls.findByIdAndUpdate[0].patch.$set;
  check($set['interview.scheduledAt'] === 'date' && $set['interview.mode'] === 'video', '6. The write updates only explicitly supplied scheduling fields.');
  check(!('interview.meetingUrl' in $set), '6. Undefined fields are filtered from the patch.');
}

// --- Contract B: Genuine appointment change while legacy status is already interview ---
{
  const currentInterview = { scheduledAt: new Date('2026-08-01T10:00:00Z'), mode: 'video', meetingUrl: 'http://meet', location: 'Office', notes: 'Private note', outcome: 'Pending' };
  const { self, calls, application } = buildServiceHarness({ currentInterview });

  const result = await self.scheduleInterview('emp-1', 'app-1', { scheduledAt: '2026-08-02T10:00:00Z', mode: 'video' });
  
  check(result.changed === true, '16. A genuine datetime change returns changed true.');
  check(calls.patchInterview.length === 1, '17. Performs exactly one patch write.');
  
  const patch = calls.patchInterview[0].patch;
  check(patch.scheduledAt, '17. Patch contains scheduledAt.');
  check(patch.mode === 'video', '6. Patch contains explicitly supplied mode.');
  check(patch.meetingUrl === undefined, '1. Existing meetingUrl survives an Employer payload that omits meetingUrl.');
  check(patch.location === undefined, '2. Existing location survives omission.');
  check(patch.notes === undefined, '3. Existing notes survive omission.');
  check(patch.outcome === undefined, '4. Existing outcome survives omission.');
  
  check(result.interview.meetingUrl === 'http://meet', '1. Response preserves meetingUrl.');
  check(result.interview.location === 'Office', '2. Response preserves location.');
  check(result.interview.notes === 'Private note', '3. Response preserves notes.');
  check(result.interview.outcome === 'Pending', '4. Response preserves outcome.');

  check(calls.emitHiringEvent.length === 1, '18. A genuine change emits exactly one InterviewScheduled event.');
  check(calls.emitHiringEvent[0].payload.scheduledAt.getTime() === new Date('2026-08-02T10:00:00Z').getTime(), '21. The event receives the real normalized appointment time.');
  
  check(calls.applicationSaves === 0, '10. It performs zero legacy saves since stage is unchanged.');
  check(calls.pushStageHistory.length === 0, 'B. It appends zero stage history when already at interview.');

  // PF-EMP-INT-B2C: live-confirmed defect — the invitation hook used to be reachable
  // only via a legacy status transition, so a genuine appointment for a candidate
  // already at `interview` queued no invitation whatsoever.
  check(calls.onApplicationStatusChange.length === 1, 'B. A genuine appointment queues the invitation even though the legacy status did not change.');
  check(
    calls.onApplicationStatusChange[0].interviewWhen instanceof Date
      && calls.onApplicationStatusChange[0].interviewWhen.getTime() === new Date('2026-08-02T10:00:00Z').getTime(),
    'B. The invitation hook carries the real appointment datetime.'
  );
  check(calls.onApplicationStatusChange[0].status === 'interview', 'B. The hook is invoked with the interview status, never a stale/other status.');
}

// --- Contract C: Genuine appointment AND a required stage transition, together ---
{
  const currentInterview = { scheduledAt: new Date('2026-08-01T10:00:00Z'), mode: 'video' };
  const { self, calls, application } = buildServiceHarness({ currentInterview, pipelineStage: 'screening', legacyStatus: 'shortlisted' });

  const result = await self.scheduleInterview('emp-1', 'app-1', { scheduledAt: '2026-08-02T10:00:00Z' });

  check(result.changed === true, 'C. Returns changed true.');
  check(calls.patchInterview.length === 1, 'C. Performs exactly one appointment patch.');
  check(calls.pushStageHistory.length === 1, 'C. Appends stage history exactly once.');
  check(calls.applicationSaves === 1, 'C. Performs exactly one legacy save.');
  check(application.status === 'interview', 'C. Status updated to interview.');
  check(calls.emitHiringEvent.length === 1, 'C. Emits exactly one InterviewScheduled event.');
  check(calls.onApplicationStatusChange.length === 1, 'C. Calls the notification/invitation hook exactly once — never twice when stage and appointment both change.');
  check(
    calls.onApplicationStatusChange[0].interviewWhen instanceof Date,
    'C. That single call still carries the real appointment datetime, so the invitation is queued.'
  );
}

// --- Contract A: stage-only transition, appointment genuinely unchanged, queues no invitation ---
{
  const currentInterview = { scheduledAt: new Date('2026-08-01T10:00:00Z'), mode: 'video' };
  const { self, calls } = buildServiceHarness({ currentInterview, pipelineStage: 'screening', legacyStatus: 'shortlisted' });

  await self.scheduleInterview('emp-1', 'app-1', { scheduledAt: '2026-08-01T10:00:00Z' });

  check(calls.onApplicationStatusChange.length === 1, 'A. The stage sync still runs for a real stage transition.');
  check(calls.onApplicationStatusChange[0].interviewWhen === null, 'A. But it carries NO appointment datetime, so zero invitation is queued (B1 truthfulness preserved).');
  check(calls.emitHiringEvent.length === 0, 'A. And emits zero InterviewScheduled events.');
}

// --- Contract B guard: a hired application never reaches the status hook from this path ---
{
  const currentInterview = { scheduledAt: new Date('2026-08-01T10:00:00Z'), mode: 'video' };
  const { self, calls } = buildServiceHarness({ currentInterview, pipelineStage: 'interview', legacyStatus: 'hired' });

  await self.scheduleInterview('emp-1', 'app-1', { scheduledAt: '2026-08-02T10:00:00Z' });

  check(calls.patchInterview.length === 1, 'Hired: the appointment itself is still patched.');
  check(calls.applicationSaves === 0, 'Hired: performs zero legacy saves.');
  check(calls.onApplicationStatusChange.length === 0, 'Hired: never invokes the status hook, so the offerLetter branch stays unreachable from scheduling.');
}

// --- Contract D: Identical effective appointment, stage already correct ---
{
  const currentInterview = { scheduledAt: new Date('2026-08-01T10:00:00Z'), mode: 'video', meetingUrl: 'http://meet' };
  const { self, calls } = buildServiceHarness({ currentInterview });

  const result = await self.scheduleInterview('emp-1', 'app-1', { scheduledAt: '2026-08-01T10:00:00Z' });
  
  check(result.changed === false, '8. Identical effective appointment returns changed false.');
  check(calls.patchInterview.length === 0, '9. Identical effective appointment performs zero patch writes.');
  check(calls.applicationSaves === 0, '10. It performs zero legacy saves.');
  check(calls.emitHiringEvent.length === 0, '11. It emits zero InterviewScheduled events.');
  check(calls.onApplicationStatusChange.length === 0, '12. It creates zero notifications/jobs.');
}

// --- Contract A (detail): Stage mismatch prevents a false no-op ---
{
  const currentInterview = { scheduledAt: new Date('2026-08-01T10:00:00Z'), mode: 'video', meetingUrl: 'http://meet' };
  // Pipeline is screening, but appointment values are identical to what's in DB
  const { self, calls, application } = buildServiceHarness({ currentInterview, pipelineStage: 'screening', legacyStatus: 'shortlisted' });

  const result = await self.scheduleInterview('emp-1', 'app-1', { scheduledAt: '2026-08-01T10:00:00Z' });
  
  check(result.changed === true, '22. A stage mismatch prevents a false complete no-op when a required stage transition remains.');
  check(calls.patchInterview.length === 0, '22. Still zero patch writes for the appointment itself.');
  check(calls.pushStageHistory.length === 1, '22. But appends stage history.');
  check(calls.applicationSaves === 1, '22. Performs legacy save to move stage.');
  check(application.status === 'interview', '22. Status updated to interview.');
  check(calls.onApplicationStatusChange.length === 1, '22. Calls status change hook to run stage sync.');
  check(calls.onApplicationStatusChange[0].interviewWhen === null, '22. hook receives NO appointment datetime evidence when appointment is unchanged.');
  check(calls.emitHiringEvent.length === 0, '11. Emits zero InterviewScheduled events (since appointment unchanged).');
}

// --- Case E: Unauthorized Employer ---
{
  const err = new Error('Unauthorized');
  err.status = 403;
  const { self, calls } = buildServiceHarness({ currentInterview: {}, authError: err });
  
  let error;
  try {
    await self.scheduleInterview('emp-1', 'app-unauth', { scheduledAt: '2026-08-01T10:00:00Z' });
  } catch (e) {
    error = e;
  }
  
  check(error && error.status === 403, 'Unauthorized Employer executed and failed.');
  check(calls.patchInterview.length === 0, 'patch writes 0');
  check(calls.applicationSaves === 0, 'legacy saves 0');
  check(calls.pushStageHistory.length === 0, 'history writes 0');
  check(calls.emitHiringEvent.length === 0, 'event emissions 0');
  check(calls.onApplicationStatusChange.length === 0, 'notification/invitation calls 0');
}

// --- Case F: Missing application ---
{
  const err = new Error('Not Found');
  err.status = 404;
  const { self, calls } = buildServiceHarness({ currentInterview: {}, authError: err });
  
  let error;
  try {
    await self.scheduleInterview('emp-1', 'app-missing', { scheduledAt: '2026-08-01T10:00:00Z' });
  } catch (e) {
    error = e;
  }
  
  check(error && error.status === 404, 'Missing application executed and failed.');
  check(calls.patchInterview.length === 0, 'patch writes 0');
  check(calls.applicationSaves === 0, 'legacy saves 0');
  check(calls.pushStageHistory.length === 0, 'history writes 0');
  check(calls.emitHiringEvent.length === 0, 'event emissions 0');
  check(calls.onApplicationStatusChange.length === 0, 'notification/invitation calls 0');
}

// --- Source-boundary checks ---
{
  const oaServiceSrc = readFileSync(path.join(serverSrc, 'services/career/OpportunityApplicationService.js'), 'utf8');
  check(/OpportunityApplicationRepository\.setInterview/.test(oaServiceSrc), '25. The separate User interview path remains source-unchanged.');
  check(repoMethodText.includes('const $set = {}'), 'patchInterview exists and uses $set');
}

console.log(`employerInterviewWriteIntegrity.test.js: ${count} assertions passed`);
