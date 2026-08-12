/**
 * Copilot gap summary regression — gap objects use label/key/severity, never "undefined".
 *
 * Run: node src/__tests__/copilotGapSummary.test.js
 */
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const { assembleEvidencePacket, formatGapEntry, formatGapSummary } = await import(
  pathToFileURL(path.join(root, 'server/src/services/ai/copilotEvidencePacket.js')).href
);
const { applyOutputPolicy } = await import(
  pathToFileURL(path.join(root, 'server/src/services/ai/copilotGroundingValidator.js')).href
);

function assertNoUndefined(text, label) {
  assert.ok(typeof text === 'string', `${label} should be a string`);
  assert.ok(!text.includes('undefined'), `${label} must not contain "undefined": ${text}`);
}

assertNoUndefined(formatGapEntry({ severity: 'major' }), 'formatGapEntry missing label');
assertNoUndefined(formatGapEntry({ label: 'Education History', severity: 'critical' }), 'formatGapEntry with label');
assert.equal(formatGapEntry({ label: 'Education History', severity: 'critical' }), 'Education History: critical');

const summary = formatGapSummary([
  { key: 'missing_education', severity: 'critical' },
  { label: 'Test Scores', severity: 'major' },
]);
assertNoUndefined(summary, 'formatGapSummary');

const packet = assembleEvidencePacket({
  tests: [],
  testAcceptances: [],
  programs: [],
  scholarships: [],
  institutions: [],
  eligibility: {},
  gapAnalysis: {
    gaps: [
      { key: 'missing_goals', severity: 'major' },
      { label: 'Nationality / Residence', severity: 'minor' },
    ],
  },
  journeyContext: null,
  studentContext: { profileCompleteness: 42 },
});

const gapItem = packet.items.find((i) => i.entityType === 'gap_analysis');
assert.ok(gapItem, 'gap analysis evidence item present');
assertNoUndefined(gapItem.value, 'assembled gap evidence value');

const validated = applyOutputPolicy(
  { answer: 'Based on your profile…', answerType: 'synthesis', citedEvidenceIds: [] },
  packet,
  { intent: 'general' }
);
assertNoUndefined(validated.deterministicResults.gapSummary, 'deterministicResults.gapSummary');
assert.equal(validated.groundingStatus, 'partially_grounded', 'gaps downgrade well_grounded');

console.log('copilotGapSummary: all checks passed');
