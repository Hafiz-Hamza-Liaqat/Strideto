import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/** Mission C — student/employer hiring authority */

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const clientSrc = path.resolve(here, '..');
const repoRoot = path.resolve(clientSrc, '..', '..');
const read = (rel) => readFileSync(path.join(clientSrc, rel), 'utf8');
const readRoot = (rel) => readFileSync(path.join(repoRoot, rel), 'utf8');

const authority = readRoot('shared/career/applicationAuthority.js');
const detail = read('pages/Applications/ApplicationDetail.jsx');
const kanban = read('components/applications/ApplicationKanbanBoard.jsx');
const copilot = readRoot('server/src/services/ai/copilotEvidencePacket.js');

check(/EMPLOYER_AUTHORITATIVE_STAGES/.test(authority), 'employer authoritative stages defined');
check(/STUDENT_WRITABLE_EXTERNAL_STAGES/.test(authority), 'external student write set defined');
check(
  /if \(isEmployerAuthoritativeStage\(to\)\) return false;/.test(authority),
  'student transitions filter out employer stages'
);
check(/screening/.test(authority) && /interview/.test(authority), 'screening/interview listed as employer-owned');
check(/Status not yet provided by Employer/.test(detail), 'external application honesty copy');
check(/personal && onMoveStage/.test(kanban), 'Kanban stage moves only for personal trackers');
check(/stageAuthority === 'personal'/.test(kanban), 'Kanban labels personal vs employer/institution');

check(/formatGapEntry/.test(copilot) && /g\.label \|\| g\.key/.test(copilot), 'copilot formats gaps without undefined labels');
check(/Profile analysis is incomplete|incomplete because|GROUNDING_STATUS/.test(copilot) || /formatGapSummary/.test(copilot), 'copilot has incomplete-profile grounding path');

console.log(`finalPreLaunchHiringAuthority.test.js: ${count} assertions passed`);
