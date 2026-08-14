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
check(!/readOnly|aria-readonly/.test(cards), 'domain checkboxes are not marked readonly');
check(cards.includes('aria-required'), 'required domain group is announced');
check(cards.includes('aria-describedby'), 'hint is associated with the required group');
check(cards.includes('Selected'), 'selected state not color-only');
check(cards.includes('Coming soon'), 'coming soon state');
check(cards.includes('md:grid-cols-2'), 'cards stack then two columns');
check(cards.includes('break-words'), 'long labels wrap');

const home = read('pages/Agent/ProviderHome.jsx');
check(home.includes('Provider Home'), 'provider home heading');
check(home.includes('Add another provider category'), 'add category');
check(home.includes('kind === \'independent\'') || home.includes('group.label'), 'groups by subject');
check(home.includes('addableDomainsForGroup'), 'addable domains are computed per subject group');
check(home.includes('subjectType: group.subjectType'), 'Add Domain sends the group subjectType');
check(home.includes('subjectId: group.subjectId'), 'Add Domain sends the group subjectId');
check(!/addDomain\(domain\.domainId, independent\)/.test(home), 'Add Domain does not default every CTA to Independent');
check(home.includes('This changes {group.label} only'), 'Add CTA names the subject being modified');

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

const nav = read('config/agentNavConfig.js');
check(nav.includes('hasBusiness ? BUSINESS : []'), 'education-only URL to business does not render business operational sidebar');

const gbsLayout = read('pages/Agent/business-services/GbsWorkspaceLayout.jsx');
check(gbsLayout.includes('{authorized ?'), 'nested GBS routes do not mount operational outlet unless authorized');
check(gbsLayout.includes('Add Business Formation & Corporate Services'), 'unauthorized root is add/setup');
check(gbsLayout.includes('Coming soon'), 'disabled flag uses unavailable state');
check(!/useEffect\([\s\S]{0,500}addProviderDomain/.test(gbsLayout), 'opening the URL does not create enrollment');
check(gbsLayout.includes('requestedProviderSubject'), 'GBS add uses the requested provider subject');
check(gbsLayout.includes("params.get('subjectType')") && gbsLayout.includes("params.get('subjectId')"), 'GBS add reads exact URL subjectType and subjectId');
check(gbsLayout.includes('urlSpecifiesSubject') && gbsLayout.includes('requestedMatch'), 'Independent Business URL stays setup when only Agency Business is enrolled');
check(!gbsLayout.includes('addIndependentBusiness'), 'GBS add is not Independent-hardcoded');
check(layout.includes('subjectType: params.get(\'subjectType\')'), 'sidebar scopes operational chrome to the URL subject');
check(nav.includes('scopedWorkspaces'), 'business nav does not inherit another subject\'s enrollment');

const trust = read('pages/Agent/AgentTrust.jsx');
check(trust.includes('hasBusinessWorkspace'), 'trust uses authorized workspaces');
check(/hasBusinessWorkspace \?[\s\S]*Manage Business Verification/.test(trust), 'manage business verification only if authorized');
check(trust.includes('+ Add Business Formation & Corporate Services'), 'education-only trust add-domain CTA');

console.log(`phase17d3rProviderUi.test.js: ${count} assertions passed`);
