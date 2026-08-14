import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, '..');
function read(rel) {
  return readFileSync(path.join(src, rel), 'utf8');
}

const register = read('pages/Agent/AgentRegister.jsx');
check(register.includes('ProviderDomainCards'), 'register uses domain cards');
check(register.includes('disabled={submitting || !canContinue}'), 'continue disabled until selection');
check(register.includes('role="alert"'), 'registration errors announced');
check(!/Both radio|value="both"/.test(register), 'no both radio');

const cards = read('components/provider/ProviderDomainCards.jsx');
check(cards.includes('type="checkbox"'), 'multi-select checkboxes');
check(cards.includes('Selected'), 'selected state not color-only');
check(cards.includes('Coming soon'), 'coming soon state');
check(cards.includes('md:grid-cols-2'), 'cards stack then two columns');
check(cards.includes('break-words'), 'long labels wrap');

const home = read('pages/Agent/ProviderHome.jsx');
check(home.includes('Provider Home'), 'provider home heading');
check(home.includes('Add another provider category'), 'add category');
check(home.includes('kind === \'independent\'') || home.includes('group.label'), 'groups by subject');

const layout = read('pages/Agent/AgentLayout.jsx');
check(layout.includes('WorkspaceSwitcher'), 'workspace switcher');
check(layout.includes('break-words'), 'long agency/domain names wrap');
check(layout.includes('aria-haspopup="listbox"'), 'switcher keyboard/a11y');

const team = read('pages/Agent/AgentTeam.jsx');
check(team.includes('What should this team member work on'), 'invite domain question');
check(team.includes('selectedDomains.length === 0'), 'send disabled without domain');

const accept = read('pages/Agent/AgentAcceptInvitation.jsx');
check(accept.includes('acceptedDomainIds') || accept.includes('accepted'), 'invitee confirms domains');

const services = read('pages/Agent/AgentServices.jsx');
check(services.includes('Education & Mobility Services'), 'education services labeled');
check(/<option value="study_abroad_guidance">/.test(services), 'education categories remain education');
check(!/<option value="registered_agent">|<option value="business_formation">|<option value="ein_assistance">/.test(services), 'education form has no GBS category options');

const gbsEditor = read('pages/Agent/business-services/GbsListingEditor.jsx');
check(!/study_abroad_guidance|scholarship_guidance/.test(gbsEditor), 'GBS editor has no education categories');

const guard = read('components/agent/ProtectedAgentRoute.jsx');
check(guard.includes('AGENT_DOMAIN_ONBOARDING'), 'direct URL cannot skip required onboarding');

console.log(`phase17d3rProviderUi.test.js: ${count} assertions passed`);
