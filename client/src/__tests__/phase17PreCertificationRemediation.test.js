import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { regionsForCountry, hasRegionCatalog } from '../../../shared/international/regions.js';
import {
  isPubliclyLaunchVisible,
  isFixtureRecord,
} from '../../../shared/publicDiscovery/fixtureExclusion.js';
import {
  AGENT_ONBOARDING_STEPS,
  AGENT_ONBOARDING_PROFESSIONAL_WIZARD,
  AGENT_ONBOARDING_AGENCY_WIZARD,
} from '../../../shared/agent/constants.js';

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

check(isFixtureRecord({ title: '[B5B ACCEPTANCE] Pipeline' }) === false, 'no title-regex hiding');
check(isPubliclyLaunchVisible({}) === false, 'unknown records are not public');

const flags = read('config/careerFeatureFlags.js');
check(/VITE_ASSESSMENTS_ENABLED === '1'/.test(flags), 'client assessments require explicit 1');

const nav = read('components/layout/navConfig.js');
check(!/assessments/i.test(nav), 'primary nav does not advertise Assessments');

const career = read('pages/CareerGuidance/CareerGuidance.jsx');
check(!/ROUTES\.ASSESSMENTS/.test(career), 'Career Guidance does not CTA into Assessments');
check(career.includes('ROUTES.TEST_HUB'), 'Career Guidance keeps Tests & Prep');

const catalog = read('pages/Assessments/AssessmentsCatalog.jsx');
check(catalog.includes('featureDisabled') && catalog.includes('isAssessmentsEnabled'), 'direct assessments route follows disabled contract');

const testsNav = read('components/layout/navConfig.js');
check(testsNav.includes('/tests') && !testsNav.includes('/exam-prep'), 'Tests remains the canonical launch scope');

const intakes = read('pages/Institution/InstitutionIntakes.jsx');
check(intakes.includes('Fall 2027'), 'intake name placeholder');
check(intakes.includes('e.g. 250'), 'capacity placeholder');
check(intakes.includes('Describe academic, language, document or eligibility requirements'), 'requirements help');
check(/type="number"[\s\S]*step="1"/.test(intakes) || /step="1"/.test(intakes), 'capacity is integer');
check(intakes.includes('placeholder="USD"'), 'fee currency placeholder');

const ui = read('pages/Institution/InstitutionUi.jsx');
check(ui.includes('[color-scheme:light]') && ui.includes('dark:[color-scheme:dark]'), 'institution native controls honor color-scheme');

const controls = read('components/forms/controlClasses.js');
check(controls.includes('[color-scheme:light]') && controls.includes('dark:[color-scheme:dark]'), 'shared controls honor color-scheme');

const register = read('pages/Institution/InstitutionRegister.jsx');
check(register.includes('CountrySelect'), 'register uses CountrySelect');
check(!/ISO 3166-1 two-letter code/.test(register), 'register does not ask users to memorize ISO codes');

const verification = read('pages/Institution/InstitutionVerification.jsx');
check(verification.includes('PhoneInput') || /type="tel"/.test(verification), 'verification phone uses tel semantics');
check(verification.includes('Enter the number issued by the listed authority'), 'registration number help');

const claim = read('pages/Institution/InstitutionClaim.jsx');
check(claim.includes('CountrySelect'), 'claim uses CountrySelect');

check(regionsForCountry('US').length > 0 && !regionsForCountry('US').includes('Punjab'), 'US has US states');
check(!regionsForCountry('US').includes('Punjab') && !regionsForCountry('US').includes('Sindh'), 'US cannot show Pakistan provinces');
check(!regionsForCountry('DE').includes('California'), 'Germany cannot show US states');
check(hasRegionCatalog('FR') === false, 'unsupported country has no fake catalog');

const cascade = read('components/forms/LocationCascadeFilter.jsx');
check(cascade.includes("region: '', city: ''") || cascade.includes('region: \'\', city: \'\''), 'country change clears region/city');
check(cascade.includes('No region catalog') || cascade.includes('type a region'), 'unsupported country has truthful fallback');
check(!/defaultCountry\s*=\s*['"]PK['"]/.test(cascade), 'no Pakistan default on cascade');

const pkg = readRoot('package.json');
check(!/Pakistan Job & Education E-Portal/.test(pkg), 'root package description is international');
const clientPkg = readRoot('client/package.json');
check(!/Pakistan Job & Education E-Portal/.test(clientPkg), 'client package description is international');

const sitemap = read('pages/Static/HumanSitemap.jsx');
check(sitemap.includes('Find opportunities') || sitemap.includes('sitemapOpportunities'), 'human sitemap has opportunities group');
check(sitemap.includes('Plan your studies') || sitemap.includes('sitemapEducation'), 'human sitemap has studies group');
check(sitemap.includes('Get professional help') || sitemap.includes('sitemapProfessional'), 'human sitemap has professional help');
check(sitemap.includes('Help & safety') || sitemap.includes('sitemapHelp'), 'human sitemap has help/safety');
check(!/\/admin/.test(sitemap) && !/ROUTES\.ADMIN/.test(sitemap), 'human sitemap excludes Admin');
check(!/\/vault/i.test(sitemap), 'human sitemap excludes Vault');
check(!/github\.com|localhost|MIT License/i.test(sitemap), 'human sitemap excludes license/github/localhost');

check(AGENT_ONBOARDING_PROFESSIONAL_WIZARD.length === 5, 'professional wizard is 5 steps');
check(AGENT_ONBOARDING_AGENCY_WIZARD.length === 6, 'agency wizard is 6 steps');
check(!AGENT_ONBOARDING_PROFESSIONAL_WIZARD.includes(AGENT_ONBOARDING_STEPS.ACCOUNT), 'ACCOUNT is registration, not wizard');

const onboarding = read('pages/Agent/AgentOnboarding.jsx');
check(onboarding.includes('AGENT_ONBOARDING_STEPS'), 'onboarding uses shared step constants');
check(/visibleSteps\.length/.test(onboarding) || /visibleSteps\[currentStep\]/.test(onboarding), 'progress uses actual visible flow');

const routes = read('routes/index.jsx');
check(routes.includes('AdminRouteGuard') && routes.includes('WORKFLOW_REVIEW'), 'agent marketplace page uses permission guard');
check(!/animate-pulse/.test(routes.match(/function PageFallback[\s\S]*?^}/m)?.[0] || routes.slice(routes.indexOf('function PageFallback'), routes.indexOf('function PageFallback') + 400)), 'lazy fallback is not a large pulse');
check(/min-h-\[12rem\]/.test(routes) || /outlet/i.test(routes), 'fallback is outlet-sized');

const auth = read('context/AuthContext.jsx');
check(/if \(!alreadyHydrated\) setLoading\(true\)/.test(auth), 'same-realm pathname does not set loading true when hydrated');

const forms = read('i18n/locales/en/forms.json');
check(/worker is running|sending is enabled/.test(forms), 'password recovery does not claim email was delivered');

const envStaging = readRoot('docker/.env.staging.example');
check(/VITE_ASSESSMENTS_ENABLED=0/.test(envStaging), 'staging example disables assessments');

console.log(`phase17PreCertificationRemediation.test.js: ${count} assertions passed`);
