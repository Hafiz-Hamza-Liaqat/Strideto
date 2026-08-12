import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/** Mission D — agent marketplace + trust authority contracts */

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

const form = read('pages/Agent/AgentMarketplaceForm.jsx');
const evidence = readRoot('shared/international/evidencePolicy.js');
const onboarding = read('pages/Agent/AgentOnboarding.jsx');

check(/MultiSelect/.test(form), 'marketplace uses MultiSelect for structured lists');
check(/programIntelligenceApi|education\/programs/.test(form), 'marketplace uses program search picker');
check(!/<input[^>]*referenceId/.test(form) && !/placeholder=.*sourceIds/i.test(form), 'marketplace does not expose raw ID text fields as primary UX');
check(/contentKind/.test(form) && /agent_statement/.test(form), 'default agent statement classification present');
check(/MAPS|supporting|accreditation|professional_credential/i.test(evidence), 'evidence policy distinguishes Maps/credential/accreditation');
check(/Finish onboarding|verification/i.test(onboarding), 'onboarding finishes toward verification');
check(
  !/setStatus\(['"]under_review['"]\)/.test(onboarding) && !/status:\s*['"]under_review['"]/.test(onboarding),
  'onboarding does not forge under_review status locally'
);

console.log(`finalPreLaunchAgentTrust.test.js: ${count} assertions passed`);
