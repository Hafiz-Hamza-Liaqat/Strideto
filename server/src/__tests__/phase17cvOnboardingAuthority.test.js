import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateAgentOnboardingStep } from '../../../shared/agent/onboardingPolicy.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const service = readFileSync(path.resolve(here, '../services/agentProfileService.js'), 'utf8');
const controller = readFileSync(path.resolve(here, '../controllers/agentController.js'), 'utf8');
const model = readFileSync(path.resolve(here, '../models/agent/AgentProfile.js'), 'utf8');

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

check(/validateAgentOnboardingStep/.test(service), 'advanceOnboardingStep uses shared policy');
check(/skip: Boolean\(skip\)/.test(service) && /onboardingSkippedSteps/.test(service), 'server persists skip vs complete');
check(/const \{ step, skip \}/.test(controller), 'controller accepts skip without inventing completion');
check(/onboardingSkippedSteps/.test(model), 'profile model stores skipped steps');

check(!validateAgentOnboardingStep('identity', {}).ok, 'server policy rejects empty identity');
check(!validateAgentOnboardingStep('services', { officialEmail: 'not-an-email' }).ok, 'invalid email rejected');
check(validateAgentOnboardingStep('services', { officialEmail: 'ada@example.com' }).ok, 'valid email accepted');
check(!validateAgentOnboardingStep('identity', {}, { skip: true }).ok, 'required step cannot skip on the server');

console.log(`phase17cvOnboardingAuthority.test.js: ${count} assertions passed`);
