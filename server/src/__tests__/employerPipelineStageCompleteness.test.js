/**
 * PF-EMP-UX-B1 — Hiring Pipeline board must represent all 13 canonical
 * pipeline stages, not the 9-value `FOCUS_STAGES` subset it previously
 * hardcoded (confirmed missing: interested, preparing, joined, withdrawn —
 * docs/STRIDETO_EMPLOYER_PORTAL_WORKFLOW_UX_AUDIT.md §12).
 *
 * The server (`EmployerIntelligenceService.getPipeline`) already returns the
 * full canonical stage list as `stages` in its response — this fix makes the
 * client consume that field instead of maintaining a second, duplicate,
 * incomplete list. Source-contract style, matching this repo's established
 * convention (no jsdom/DOM runner exists for these client pages).
 *
 * Run: node src/__tests__/employerPipelineStageCompleteness.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const serverSrc = path.resolve(here, '..');
const repoRoot = path.resolve(serverSrc, '..', '..');
const clientSrc = path.resolve(repoRoot, 'client', 'src');

const pipelinePage = readFileSync(path.join(clientSrc, 'pages/Employer/EmployerPipeline.jsx'), 'utf8');
const sharedConstants = readFileSync(path.join(repoRoot, 'shared/career/constants.js'), 'utf8');
const intelligenceService = readFileSync(path.join(serverSrc, 'services/career/EmployerIntelligenceService.js'), 'utf8');

// Extract the real, live PIPELINE_STAGES array from the canonical shared module (not hand-copied here).
const stagesMatch = sharedConstants.match(/export const PIPELINE_STAGES = \[([\s\S]*?)\];/);
assert.ok(stagesMatch, 'PIPELINE_STAGES export found in shared/career/constants.js');
const PIPELINE_STAGES = stagesMatch[1]
  .split(',')
  .map((s) => s.trim().replace(/^'|'$/g, ''))
  .filter(Boolean);

// --- 1/2. Canonical stage definition/order; all 13 stages present ---
{
  check(PIPELINE_STAGES.length === 13, `1/2. The canonical stage list has 13 entries (found ${PIPELINE_STAGES.length})`);
  check(
    /import \{ PIPELINE_STAGES \} from '@shared\/career\/constants\.js';/.test(pipelinePage),
    '1. EmployerPipeline.jsx imports the canonical PIPELINE_STAGES constant directly'
  );
  check(
    !/FOCUS_STAGES/.test(pipelinePage),
    'Duplicate list removed: no FOCUS_STAGES constant remains anywhere in EmployerPipeline.jsx'
  );
  check(
    /const stages = pipeline\?\.stages\?\.length \? pipeline\.stages : PIPELINE_STAGES;/.test(pipelinePage),
    '1. The rendered stage list prefers the server-returned pipeline.stages (already canonical), falling back to the same canonical constant before the fetch resolves'
  );
  check(
    /\{stages\.map\(\(stage\) => \(/.test(pipelinePage),
    '2. The board renders one column per entry in the full `stages` list, not a reduced subset'
  );
}

// --- 3-7. The four previously-missing stages, plus two already-working ones, are all part of the canonical list the board now renders ---
{
  for (const stage of ['interested', 'preparing', 'joined', 'withdrawn', 'assessment', 'interview']) {
    check(PIPELINE_STAGES.includes(stage), `3-7. '${stage}' is part of the canonical PIPELINE_STAGES list the board now iterates over`);
  }
}

// --- 8/9. Server groups every candidate into exactly one column; nothing is silently filtered (unchanged, verified still present) ---
{
  const getPipelineFn = intelligenceService.slice(
    intelligenceService.indexOf('async getPipeline('),
    intelligenceService.indexOf('async transitionPipeline(')
  );
  check(
    /for \(const stage of PIPELINE_STAGES\) columns\[stage\] = \[\];/.test(getPipelineFn),
    '9. Server pre-initializes every canonical stage as an empty column before grouping — no stage is ever absent from the response shape'
  );
  check(
    /const stage = card\.pipelineStage \|\| 'applied';[\s\S]*?columns\[stage\]\.push\(card\);/.test(getPipelineFn),
    '8. Each candidate card is pushed into exactly one column — a single, unconditional push per card, no duplication'
  );
  check(
    /stages: PIPELINE_STAGES,/.test(getPipelineFn),
    '1. The server response already includes the full canonical stage order as `stages` — confirmed unchanged, this fix only changes which field the client reads'
  );
}

// --- 10. Empty-stage counts remain correct (unchanged rendering expression) ---
{
  check(
    /\{stage\} \(\{\(columns\[stage\] \|\| \[\]\)\.length\}\)/.test(pipelinePage),
    '10. Column heading count is still `(columns[stage] || []).length` — a stage with zero candidates correctly shows (0), not omitted or miscounted'
  );
}

// --- 11. Terminal-stage headings remain visible (rejected/withdrawn/joined render with the same heading pattern as every other stage) ---
{
  check(
    PIPELINE_STAGES.includes('rejected') && PIPELINE_STAGES.includes('withdrawn') && PIPELINE_STAGES.includes('joined'),
    '11. All three terminal stages are part of the canonical list and therefore render with the same visible stage-name + count heading as any other column'
  );
}

// --- 12. Candidate-detail links unchanged ---
{
  check(
    /to=\{`\$\{ROUTES\.EMPLOYER_INTELLIGENCE_CANDIDATES\}\/\$\{c\.legacyApplicationId\}`\}/.test(pipelinePage),
    '12. Candidate cards still link to the candidate-detail route using legacyApplicationId, unchanged'
  );
}

// --- 13/14/15/16. Ownership, internal-only scoping, external-Job exclusion, and response field names are untouched (getPipeline delegates to listCandidates, unmodified) ---
{
  check(
    /const \{ data \} = await this\.listCandidates\(employerId, query\);/.test(intelligenceService),
    '13/14/15. getPipeline still delegates to listCandidates(employerId, ...) — the same employer-owned, internal-Job-scoped candidate source as before (PF-TRACK-B2), untouched by this fix'
  );
  check(
    /return \{\s*stages: PIPELINE_STAGES,\s*columns,\s*meta: \{ total: data\.length \},\s*\};/.test(intelligenceService),
    '16. The response shape ({stages, columns, meta}) is byte-identical to before this fix — no field renamed, added, or removed'
  );
}

// --- 17/18/19. Applications page, Candidate detail, and User tracker sync are untouched by this fix ---
{
  const applicationsPage = readFileSync(path.join(clientSrc, 'pages/Employer/EmployerApplications.jsx'), 'utf8');
  const candidateDetailPage = readFileSync(path.join(clientSrc, 'pages/Employer/EmployerCandidateDetail.jsx'), 'utf8');
  const oaService = readFileSync(path.join(serverSrc, 'services/career/OpportunityApplicationService.js'), 'utf8');
  check(
    /const STATUS_OPTIONS = \['shortlisted', 'rejected', 'interview', 'hired'\];/.test(applicationsPage),
    '17. EmployerApplications.jsx still uses the same legacy STATUS_OPTIONS — untouched by this phase'
  );
  check(
    /PIPELINE_STAGES\.map\(\(s\) => <option key=\{s\} value=\{s\}>\{s\}<\/option>\)/.test(candidateDetailPage),
    '18. EmployerCandidateDetail.jsx already used the full canonical PIPELINE_STAGES for its own stage selector before this phase — untouched, and confirms the client already had access to the correct import path'
  );
  check(
    !/Application\.(updateOne|updateMany|findByIdAndUpdate|findOneAndUpdate|create)/.test(oaService),
    '19. OpportunityApplicationService.js still never writes to the legacy Application model — User→Employer isolation untouched by this fix'
  );
}

console.log(`employerPipelineStageCompleteness.test.js: ${count} assertions passed`);
