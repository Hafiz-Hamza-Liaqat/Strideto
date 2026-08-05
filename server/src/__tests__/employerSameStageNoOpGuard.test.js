/**
 * PF-EMP-UX-B4A — a repeated same-stage Employer pipeline transition must be a
 * successful, side-effect-free no-op.
 *
 * Confirmed live defect (docs/STRIDETO_PF_EMP_UX_B3_FINAL_LIVE_ACCEPTANCE.md §6):
 * ~23 `joined -> joined` requests were each accepted, each appending a stage-history
 * entry and each emitting a `career.CandidateHired` notification — 26 history
 * entries against 25 notifications, i.e. the event layer behaved correctly once
 * per request and the real fault was that the transition boundary accepted the
 * request at all.
 *
 * Part 1 runs the real `transitionPipeline` against injected fakes, so the
 * no-op and genuine-transition paths are exercised as actual behavior (side
 * effects are counted, not inferred from source text). Part 2 is a small set of
 * source-boundary checks for the client control and the untouched subsystems,
 * where no DOM runner exists in this repository.
 *
 * Run: node src/__tests__/employerSameStageNoOpGuard.test.js
 */
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
const repoRoot = path.resolve(serverSrc, '..', '..');
const clientSrc = path.resolve(repoRoot, 'client', 'src');

const serviceSrc = readFileSync(path.join(serverSrc, 'services/career/EmployerIntelligenceService.js'), 'utf8');

// ---------------------------------------------------------------------------
// Part 1 — behavioral harness
//
// transitionPipeline is a method on an exported object literal, so its module
// scope cannot be stubbed from outside. Rather than assert on source text, the
// method body is re-bound against fake collaborators that record every side
// effect. The body is extracted verbatim from the shipped file, so it stays in
// lockstep with the implementation: if the guard is removed, these tests fail.
// ---------------------------------------------------------------------------

const bodyStart = serviceSrc.indexOf('async transitionPipeline(employerId, legacyApplicationId, body = {}) {');
const bodyEnd = serviceSrc.indexOf('async addNote(employerId, legacyApplicationId, body = {}) {');
assert.ok(bodyStart !== -1 && bodyEnd !== -1 && bodyStart < bodyEnd, 'transitionPipeline body located in the shipped service');
const methodText = serviceSrc.slice(bodyStart, bodyEnd).trim().replace(/,\s*$/, '');

function buildHarness({ currentStage, legacyStatus, linked = true }) {
  const calls = {
    applicationSaves: 0,
    onApplicationStatusChange: 0,
    pushStageHistory: [],
    emitHiringEvent: [],
    syncVacancyAfterHire: 0,
    getCandidateDetail: [],
  };

  const application = {
    _id: 'app-1',
    status: legacyStatus,
    userId: { _id: 'user-1' },
    jobId: { _id: 'job-1' },
    talentProfileId: null,
    save: async () => {
      calls.applicationSaves += 1;
    },
  };

  const oaDoc = linked
    ? { _id: 'oa-1', pipelineStage: currentStage, stageTemplateId: 'job_default' }
    : null;

  const scope = {
    assertEnabled: () => {},
    getOwnedLegacyApplication: async () => application,
    sanitizeString: (v) => String(v || '').trim(),
    PIPELINE_STAGES: ['applied', 'viewed', 'screening', 'assessment', 'interview', 'offer', 'negotiation', 'accepted', 'joined', 'rejected', 'withdrawn', 'interested', 'preparing'],
    LEGACY_STATUS_TO_PIPELINE: { hired: 'accepted', interview: 'interview', shortlisted: 'screening', submitted: 'applied' },
    PIPELINE_TO_LEGACY_STATUS: { joined: 'hired', accepted: 'hired', offer: 'interview', interview: 'interview' },
    onApplicationStatusChange: async () => {
      calls.onApplicationStatusChange += 1;
    },
    OpportunityApplicationRepository: {
      findByLegacyApplicationId: async () => oaDoc,
      pushStageHistory: async (id, entry) => {
        calls.pushStageHistory.push({ id, entry });
      },
    },
    canTransition: () => true,
    eventForPipelineStage: (s) => (s === 'joined' ? 'CandidateHired' : s === 'offer' ? 'OfferSent' : null),
    emitHiringEvent: (type, payload) => {
      calls.emitHiringEvent.push({ type, payload });
    },
    employerActor: (id) => ({ type: 'employer', id }),
    JobVacancyService: {
      syncVacancyAfterHire: async () => {
        calls.syncVacancyAfterHire += 1;
      },
    },
  };

  const self = {
    getCandidateDetail: async (employerId, legacyApplicationId, opts) => {
      calls.getCandidateDetail.push(opts);
      return { candidateId: 'cand-1', pipelineStage: oaDoc ? oaDoc.pipelineStage : null, ranking: { percent: 50 } };
    },
  };

  const argNames = Object.keys(scope);
  const factory = new Function(...argNames, `return ({ ${methodText} });`);
  self.transitionPipeline = factory(...argNames.map((n) => scope[n])).transitionPipeline;

  return { self, calls, application, oaDoc };
}

// --- 1-8. Same-stage request is a clean no-op ---
{
  const { self, calls, application } = buildHarness({ currentStage: 'joined', legacyStatus: 'hired' });
  const result = await self.transitionPipeline('emp-1', 'app-1', { toStage: 'joined' });

  check(result && result.changed === false, '1/8. joined -> joined returns successfully and is flagged changed:false');
  check(calls.pushStageHistory.length === 0, '2. No stage-history entry is appended');
  check(calls.emitHiringEvent.length === 0, '3. No hiring event is published, so no notification can be produced');
  check(calls.syncVacancyAfterHire === 0, '4. No downstream synchronization callback runs');
  check(calls.applicationSaves === 0, '5. No legacy Application write occurs');
  check(application.status === 'hired', '5. Legacy Application status is left untouched in memory');
  check(calls.onApplicationStatusChange === 0, '3. The legacy status-change notification hook is not invoked');
  check(calls.getCandidateDetail.length === 1, '8. Current state is read back exactly once to build the response');
  check(
    calls.getCandidateDetail[0] && calls.getCandidateDetail[0].recordView === false,
    '19. The no-op read passes recordView:false, so CandidateViewed behavior is unchanged'
  );
  // 6/7: with no pushStageHistory and no save, neither the canonical stage nor
  // any updatedAt can be rewritten by this request.
  check(calls.pushStageHistory.length === 0 && calls.applicationSaves === 0, '6/7. No canonical stage write and no updatedAt churn are possible');
}

// --- 12-16. A genuine transition still performs every side effect exactly once ---
{
  const { self, calls, application } = buildHarness({ currentStage: 'offer', legacyStatus: 'interview' });
  const result = await self.transitionPipeline('emp-1', 'app-1', { toStage: 'joined' });

  check(result && result.changed === true, '12. offer -> joined is still a real transition, flagged changed:true');
  check(calls.pushStageHistory.length === 1, '13. Exactly one stage-history entry is appended');
  check(
    calls.pushStageHistory[0].entry.fromStage === 'offer' && calls.pushStageHistory[0].entry.toStage === 'joined',
    '13. The history entry records the canonical from/to stages'
  );
  check(calls.pushStageHistory[0].entry.byActorType === 'employer', '17. The entry is attributed to the employer actor');
  check(calls.emitHiringEvent.length === 1, '14. Exactly one hiring event is published (one notification)');
  check(calls.emitHiringEvent[0].type === 'CandidateHired', '14. The event type matches the destination stage');
  check(calls.applicationSaves === 1, '15. The legacy Application is written exactly once');
  check(application.status === 'hired', '16. Legacy projection remains correct (joined -> hired)');
  check(calls.syncVacancyAfterHire === 1, '15. Vacancy synchronization runs once for a hire-class stage');
}

// --- Regression proof: the lossy legacy path would NOT have caught this ---
{
  // Live case: canonical 'joined', legacy 'hired'. LEGACY_STATUS_TO_PIPELINE
  // maps 'hired' -> 'accepted', so a legacy-derived comparison yields
  // 'accepted' !== 'joined' and would wrongly proceed. The guard must read
  // oa.pipelineStage, which this asserts by construction.
  const { self, calls } = buildHarness({ currentStage: 'joined', legacyStatus: 'hired' });
  await self.transitionPipeline('emp-1', 'app-1', { toStage: 'joined' });
  check(
    calls.emitHiringEvent.length === 0,
    'The guard compares against the canonical oa.pipelineStage, not the lossy legacy round-trip (hired -> accepted), which is why the live joined -> joined case is now suppressed'
  );
}

// --- Unlinked application keeps its existing behavior (scoped guard) ---
{
  const { self, calls } = buildHarness({ currentStage: null, legacyStatus: 'hired', linked: false });
  const result = await self.transitionPipeline('emp-1', 'app-1', { toStage: 'joined' });
  check(result.changed === true, 'An unlinked application is not suppressed — no canonical stage exists to compare, so prior behavior is preserved');
  check(calls.pushStageHistory.length === 0, 'An unlinked application still appends no OA history (no tracker exists)');
  check(calls.applicationSaves === 1, 'An unlinked application still performs its legacy write, unchanged');
}

// --- 9-11. Ownership and validation ordering ---
{
  const guardIdx = serviceSrc.indexOf('if (oa && oa.pipelineStage === toStage)');
  const ownershipIdx = serviceSrc.indexOf('const application = await getOwnedLegacyApplication(employerId, legacyApplicationId);');
  const validationIdx = serviceSrc.indexOf("if (!PIPELINE_STAGES.includes(toStage))");
  const firstWriteIdx = serviceSrc.indexOf('application.status = legacyStatus;');
  check(ownershipIdx !== -1 && ownershipIdx < guardIdx, '9/10. Ownership is resolved before the guard, so unauthorized requests still throw first');
  check(validationIdx !== -1 && validationIdx < guardIdx, '11. Invalid stage values are still rejected with 400 before the guard');
  check(guardIdx !== -1 && guardIdx < firstWriteIdx, '1. The guard precedes every write in the method');
}

// ---------------------------------------------------------------------------
// Part 2 — client control and untouched subsystems (source-boundary)
// ---------------------------------------------------------------------------

const detailPage = readFileSync(path.join(clientSrc, 'pages/Employer/EmployerCandidateDetail.jsx'), 'utf8');

// --- 22. Client prevention ---
{
  check(
    /disabled=\{saving \|\| !stage \|\| stage === candidate\?\.pipelineStage\}/.test(detailPage),
    '22. The Update-stage button is disabled while saving, when no stage is selected, and when the selection already equals the current canonical stage'
  );
  check(
    /const \{ data \} = await employerApi\.intelligenceTransitionStage\(id, \{ toStage: stage \}\);/.test(detailPage),
    '22. The submission payload is unchanged — only the disabled condition changed'
  );
  check(
    !/setTimeout|debounce/i.test(detailPage),
    'The client protection is state-based, not a debounce timer, and is not the only protection'
  );
}

// --- 18-20. Untouched subsystems ---
{
  const oaService = readFileSync(path.join(serverSrc, 'services/career/OpportunityApplicationService.js'), 'utf8');
  const transitionStart = oaService.indexOf('async transitionStage(');
  const transitionBody = oaService.slice(transitionStart, oaService.indexOf('\n  async ', transitionStart + 1));
  check(
    !/Application\.(updateOne|updateMany|findByIdAndUpdate|findOneAndUpdate|create)/.test(transitionBody),
    '18. User->Employer isolation unchanged — the User tracker still never writes the legacy Application'
  );
  const scheduleStart = serviceSrc.indexOf('async scheduleInterview(');
  const scheduleBody = serviceSrc.slice(scheduleStart, serviceSrc.indexOf('async completeInterview('));
  check(
    /if \(!body\.scheduledAt\)|scheduledAt/.test(scheduleBody) && !/pipelineStage === toStage/.test(scheduleBody),
    '20. Interview scheduling is untouched by this guard'
  );
  check(
    (serviceSrc.match(/oa\.pipelineStage === toStage/g) || []).length === 1,
    'Exactly one equality guard exists — it was not duplicated into another code path'
  );
}

console.log(`employerSameStageNoOpGuard.test.js: ${count} assertions passed`);
