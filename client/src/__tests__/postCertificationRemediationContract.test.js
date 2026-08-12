import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Post-certification manual remediation — focused contract pack.
 * Source-text assertions (repo has no jsdom runner).
 */

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const clientSrc = path.resolve(here, '..');
const repoRoot = path.resolve(clientSrc, '..', '..');

function readClient(rel) {
  return readFileSync(path.join(clientSrc, rel), 'utf8');
}
function readRoot(rel) {
  return readFileSync(path.join(repoRoot, rel), 'utf8');
}

// Shared navigation / skip / logo
{
  check(existsSync(path.join(clientSrc, 'components/navigation/ScrollManager.jsx')), 'ScrollManager exists');
  const main = readClient('main.jsx');
  check(/ScrollManager/.test(main), 'main.jsx mounts ScrollManager');
  const css = readClient('index.css');
  check(/clip:\s*rect\(0,\s*0,\s*0,\s*0\)|clip-path:\s*inset\(50%\)/.test(css), 'skip-link uses clip hide pattern');
  const logo = readClient('components/brand/Logo.jsx');
  check(/useOptionalTheme|resolvedTheme|logoLight/.test(logo), 'Logo auto tone uses theme');
}

// Forms foundations (FormField.jsx must remain untouched by this pack)
{
  check(existsSync(path.join(clientSrc, 'components/forms/CountrySelect.jsx')), 'CountrySelect exists');
  check(existsSync(path.join(clientSrc, 'components/forms/PhoneInput.jsx')), 'PhoneInput exists');
  check(existsSync(path.join(clientSrc, 'components/forms/PasswordInput.jsx')), 'PasswordInput exists');
  check(existsSync(path.join(repoRoot, 'shared/international/location.js')), 'location foundation exists');
  check(existsSync(path.join(repoRoot, 'shared/career/jobTaxonomy.js')), 'jobTaxonomy exists');
}

// Application authority
{
  const auth = readRoot('shared/career/applicationAuthority.js');
  check(/EMPLOYER_AUTHORITATIVE_STAGES/.test(auth), 'employer authoritative stages defined');
  check(/getStudentAllowedTransitions/.test(auth), 'student transition helper exists');
  const detail = readClient('pages/Applications/ApplicationDetail.jsx');
  check(/withdraw|Withdraw|stageAuthority/.test(detail), 'ApplicationDetail handles authority/withdraw');
}

// Copilot gaps
{
  const packet = readRoot('server/src/services/ai/copilotEvidencePacket.js');
  check(/g\.label\s*\|\|\s*g\.key/.test(packet) || /formatGap/.test(packet), 'copilot gap labels use label/key not field-only');
  check(!/`\$\{g\.field\}:/.test(packet), 'copilot packet does not use undefined g.field template');
}

// Evidence policy
{
  check(existsSync(path.join(repoRoot, 'shared/international/evidencePolicy.js')), 'evidencePolicy exists');
  const vs = readRoot('server/src/services/verificationService.js');
  check(/evidencePolicy|assertEvidenceAccept|describeEvidencePolicy|validateEvidence/.test(vs), 'verificationService enforces evidence policy');
}

// Announcements
{
  check(existsSync(path.join(repoRoot, 'server/src/models/Announcement.js')), 'Announcement model exists');
  check(existsSync(path.join(repoRoot, 'server/src/services/announcementService.js')), 'announcementService exists');
  const routes = readClient('routes/index.jsx');
  check(/AdminAnnouncements/.test(routes), 'Admin announcements route wired');
}

// Jobs international
{
  const jobs = readClient('pages/Jobs/Jobs.jsx');
  check(/countryCode|CountrySelect|geo-facets|geoFacets/.test(jobs), 'Jobs page uses international country filtering');
  check(!/defaultValue:\s*['"]PK['"]/.test(jobs), 'Jobs has no hidden PK defaultValue');
}

// Agent onboarding handoff
{
  const onboarding = readClient('pages/Agent/AgentOnboarding.jsx');
  check(/agent\/verification|AGENT_VERIFICATION|verification/.test(onboarding), 'onboarding hands off to verification');
  check(!/Your application is under review/.test(onboarding) || /under_review/.test(onboarding), 'no false under-review claim without status check');
}

// Institution publishing gate + notification mount
{
  check(existsSync(path.join(clientSrc, 'pages/Institution/InstitutionPublishingGate.jsx')), 'publishing gate component exists');
  const layout = readClient('pages/Institution/InstitutionLayout.jsx');
  check(/NotificationBell|InstitutionNotification/.test(layout), 'Institution layout has notification bell');
}

// Admin sidebar scroll
{
  const sidebar = readClient('components/admin/AdminSidebar.jsx');
  check(/scrollTop|sessionStorage/.test(sidebar), 'AdminSidebar persists scroll');
}

// Password recovery realms
{
  check(existsSync(path.join(clientSrc, 'pages/Agent/AgentForgotPassword.jsx')), 'Agent forgot password page');
  check(existsSync(path.join(clientSrc, 'pages/Institution/InstitutionForgotPassword.jsx')), 'Institution forgot password page');
  check(existsSync(path.join(clientSrc, 'pages/Employer/EmployerForgotPassword.jsx')), 'Employer forgot password page');
}

// Newsletter truth
{
  const news = readClient('components/newsletter/NewsletterSubscribe.jsx');
  check(/not_configured|delivery|subscribed/i.test(news), 'newsletter copy acknowledges delivery configuration');
}

console.log(`postCertificationRemediationContract.test.js: ${count} assertions passed`);
