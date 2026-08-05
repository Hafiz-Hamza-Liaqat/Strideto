/**
 * PF-EMP-UX-B3 — the Employer Applications page must present the canonical
 * hiring stage (OpportunityApplication.pipelineStage) as the primary candidate
 * stage, instead of the reduced legacy Application.status projection.
 *
 * Confirmed defect (docs/STRIDETO_EMPLOYER_PORTAL_WORKFLOW_UX_AUDIT.md §9):
 * canonical `assessment` legitimately compresses to legacy `shortlisted`, and
 * the page displayed the legacy value as though it were the official stage,
 * making one candidate appear to hold conflicting stages across surfaces.
 *
 * Executable assertions cover the shared canonical label contract and the
 * repository's batch-projection guard. The presentation itself is asserted at
 * source level: this repository has no jsdom/DOM runner for client pages
 * (consistent with every other client-page test here), so no runtime UI
 * behavior is claimed from string matching.
 *
 * Run: node src/__tests__/employerApplicationsHiringStageClarity.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OpportunityApplicationRepository } from '../repositories/career/OpportunityApplicationRepository.js';

let count = 0;
function check(condition, message) {
  assert.ok(condition, message);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const serverSrc = path.resolve(here, '..');
const repoRoot = path.resolve(serverSrc, '..', '..');
const clientSrc = path.resolve(repoRoot, 'client', 'src');

const page = readFileSync(path.join(clientSrc, 'pages/Employer/EmployerApplications.jsx'), 'utf8');
const controller = readFileSync(path.join(serverSrc, 'controllers/employerController.js'), 'utf8');
const repoFile = readFileSync(path.join(serverSrc, 'repositories/career/OpportunityApplicationRepository.js'), 'utf8');
const stageBadge = readFileSync(path.join(clientSrc, 'components/applications/StageBadge.jsx'), 'utf8');
const employerLocale = JSON.parse(readFileSync(path.join(clientSrc, 'i18n/locales/en/employer.json'), 'utf8'));
const applicationsLocale = JSON.parse(readFileSync(path.join(clientSrc, 'i18n/locales/en/applications.json'), 'utf8'));
const sharedConstants = readFileSync(path.join(repoRoot, 'shared/career/constants.js'), 'utf8');

// Canonical stage list read from the live shared module, never hand-copied here.
const stagesMatch = sharedConstants.match(/export const PIPELINE_STAGES = \[([\s\S]*?)\];/);
assert.ok(stagesMatch, 'PIPELINE_STAGES export located in shared/career/constants.js');
const PIPELINE_STAGES = stagesMatch[1]
  .split(',')
  .map((s) => s.trim().replace(/^'|'$/g, ''))
  .filter(Boolean);

const getJobApplicationsFn = controller.slice(
  controller.indexOf('export const getJobApplications'),
  controller.indexOf('export const updateApplicationStatus')
);

// ---------- Executable: shared canonical label contract (6) ----------
{
  check(PIPELINE_STAGES.length === 13, `6. Canonical stage list resolves to 13 stages (found ${PIPELINE_STAGES.length})`);
  const missing = PIPELINE_STAGES.filter((s) => !applicationsLocale.stages || !applicationsLocale.stages[s]);
  check(
    missing.length === 0,
    `6. Every canonical stage has a human label in the shared applications:stages contract (missing: ${missing.join(', ') || 'none'})`
  );
  check(
    applicationsLocale.stages.assessment === 'Assessment' && applicationsLocale.stages.screening === 'Screening',
    '1/6. The canonical label source renders assessment as "Assessment", distinct from screening'
  );
  check(
    /t\(`applications:stages\.\$\{stage\}`/.test(stageBadge),
    '6. StageBadge resolves labels from the shared applications:stages contract rather than a local list'
  );
}

// ---------- Executable: batch projection guard (no N+1, no empty query) ----------
{
  const empty = await OpportunityApplicationRepository.findStagesByLegacyApplicationIds([]);
  assert.deepStrictEqual(empty, [], 'empty input returns an empty array');
  count += 1;
  check(
    typeof OpportunityApplicationRepository.findStagesByLegacyApplicationIds === 'function',
    'A batch stage-projection helper exists on the repository (single query, not per-row)'
  );
  check(
    /legacyApplicationId: \{ \$in: legacyApplicationIds \}/.test(repoFile)
      && /\.select\('legacyApplicationId pipelineStage'\)/.test(repoFile),
    'The batch helper issues one $in query and projects only the two fields required'
  );
}

// ---------- Server projection (14, 12, 13) ----------
{
  check(
    /hiringStage: stageByLegacyId\.get\(String\(app\._id\)\) \|\| null,/.test(getJobApplicationsFn),
    '1. Each row is projected with a canonical hiringStage, null when no linked tracker exists'
  );
  check(
    /\.\.\.app,\s*candidate,/.test(getJobApplicationsFn),
    '3/14. The pre-existing row shape (including legacy status) is spread through unchanged — hiringStage is additive'
  );
  check(
    /const job = await Job\.findOne\(\{ _id: req\.params\.id, employerId \}\)\.lean\(\);/.test(getJobApplicationsFn),
    '12/13. Employer ownership is still resolved from the authenticated employerId before any application or tracker read'
  );
  const ownershipIdx = getJobApplicationsFn.indexOf('Job.findOne({ _id: req.params.id, employerId })');
  const projectionIdx = getJobApplicationsFn.indexOf('findStagesByLegacyApplicationIds');
  check(
    ownershipIdx !== -1 && projectionIdx !== -1 && ownershipIdx < projectionIdx,
    '13. Ownership is established before the tracker projection runs, so no other Employer tracker is reachable'
  );
  check(
    /applicationsTracked: true,\s*submittedApplicationsCount: enriched\.length,/.test(getJobApplicationsFn),
    '14. Application counts and the tracked flag are unchanged'
  );
}

// ---------- External Jobs unchanged (11) ----------
{
  check(
    /if \(applyType === 'external'\) \{[\s\S]*?applicationsTracked: false,[\s\S]*?submittedApplicationsCount: null,/.test(
      getJobApplicationsFn
    ),
    '11. The external-Job branch still short-circuits with the not-tracked disclosure and never reaches the tracker projection'
  );
  const externalBranchEnd = getJobApplicationsFn.indexOf('const applications = await Application.find');
  check(
    getJobApplicationsFn.slice(0, externalBranchEnd).indexOf('findStagesByLegacyApplicationIds') === -1,
    '11. No canonical stage is fabricated for external Jobs — the projection lives after the external early-return'
  );
}

// ---------- Client presentation (1, 2, 4, 9, 10) ----------
{
  check(
    /\{app\.hiringStage \? \([\s\S]*?<StageBadge stage=\{app\.hiringStage\} \/>/.test(page),
    '1. When a canonical stage exists it is rendered as the primary stage via the shared StageBadge'
  );
  check(
    /import \{ StageBadge \} from '\.\.\/\.\.\/components\/applications\/StageBadge';/.test(page),
    '6. The page reuses the existing shared StageBadge rather than a new local label map'
  );
  check(
    !/t\('employer:statusLabel'/.test(page),
    '2. The old raw "Status: <legacy>" primary label is gone — legacy status is no longer presented as the canonical stage'
  );
  check(
    /t\('employer:applicationStatusFallback', \{ status: statusLabel\(app\.status\) \}\)/.test(page),
    '4. An unlinked historical application falls back to an explicitly-labelled legacy application status'
  );
  check(
    employerLocale.applicationStatusFallback === 'Application status: {{status}}'
      && employerLocale.hiringStageLabel === 'Hiring stage',
    '4. Fallback and primary copy are distinct, human-facing, and do not leak internal field names'
  );
  check(
    !/pipelineStage|OpportunityApplication|legacyApplicationId|migration/.test(
      JSON.stringify({
        a: employerLocale.hiringStageLabel,
        b: employerLocale.applicationStatusFallback,
        c: employerLocale.historicalApplicationHint,
        d: employerLocale.manageCandidateStages,
      })
    ),
    '4. No internal field name is exposed in any user-facing string added by this phase'
  );
  check(
    /to=\{`\$\{ROUTES\.EMPLOYER_INTELLIGENCE_CANDIDATES\}\/\$\{app\._id\}`\}/.test(page),
    '10. Each row links to Candidate Detail using the existing route and the legacy application id it already keys on'
  );
}

// ---------- Quick actions (7, 8, 9) ----------
{
  check(
    /const STATUS_OPTIONS = \['shortlisted', 'rejected', 'interview', 'hired'\];/.test(page),
    '7. The legacy action value set is unchanged'
  );
  check(
    /onClick=\{\(\) => updateStatus\(app\._id, s\)\}/.test(page),
    '7. Actions still submit the same legacy payload via the same handler — no mutation contract change'
  );
  check(
    /shortlisted: 'actionShortlist',[\s\S]*?interview: 'actionMoveToInterview',[\s\S]*?rejected: 'actionReject',[\s\S]*?hired: 'actionMarkHired',/.test(
      page
    ),
    '8. Button labels are phrased as actions, mapped from the unchanged payload values'
  );
  check(
    employerLocale.actionShortlist === 'Shortlist' && employerLocale.actionMoveToInterview === 'Move to interview',
    '8. Action copy reads as an action rather than as a stage name'
  );
  check(
    !/app\.status === s\s*\?\s*'bg-primary text-white'/.test(page),
    '9. The "selected" primary styling keyed to legacy status is removed — a legacy value can no longer look like the canonical current stage'
  );
  check(
    /disabled=\{app\.status === s\}/.test(page),
    '7. The existing guard against re-submitting the current legacy status is preserved'
  );
}

// ---------- Untouched subsystems (15-19) ----------
{
  const updateStatusFn = controller.slice(
    controller.indexOf('export const updateApplicationStatus'),
    controller.indexOf('export const getEmployerAnalytics') === -1
      ? controller.length
      : controller.indexOf('export const getEmployerAnalytics')
  );
  check(
    /void syncOpportunityApplicationFromLegacyStatus\(application, \{/.test(updateStatusFn),
    '17. Employer→User synchronization on the legacy status route is untouched'
  );
  check(
    !/recordView|CandidateViewed/.test(getJobApplicationsFn),
    '19. CandidateViewed behavior is untouched by this phase — the Applications projection emits no view event'
  );
  const oaService = readFileSync(path.join(serverSrc, 'services/career/OpportunityApplicationService.js'), 'utf8');
  const transitionStart = oaService.indexOf('async transitionStage(');
  const transitionBody = oaService.slice(transitionStart, oaService.indexOf('\n  async ', transitionStart + 1));
  check(
    !/Application\.(updateOne|updateMany|findByIdAndUpdate|findOneAndUpdate|create)/.test(transitionBody),
    '18. User→Employer isolation is unchanged — the User tracker still never writes the legacy Application'
  );
  check(
    !/hiringStage/.test(readFileSync(path.join(serverSrc, 'services/employerDashboardMetrics.js'), 'utf8')),
    '15. Dashboard metrics are untouched by the new projection'
  );
  check(
    !/hiringStage/.test(
      readFileSync(path.join(serverSrc, 'services/career/EmployerDashboardCompositionService.js'), 'utf8')
    ),
    '16. Hiring Intelligence / Analytics composition is untouched by the new projection'
  );
}

console.log(`employerApplicationsHiringStageClarity.test.js: ${count} assertions passed`);
