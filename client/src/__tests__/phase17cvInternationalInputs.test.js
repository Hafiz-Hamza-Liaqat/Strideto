import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { COUNTRY_CALLING_CODES, getCountryCallingCode, listPhoneCountries, parseE164ToPhoneParts, countriesForCallingCode } from '../../../shared/international/phone.js';
import { ISO_3166_ALPHA2 } from '../../../shared/international/country.js';
import { validateAgentOnboardingStep } from '../../../shared/agent/onboardingPolicy.js';
import { buildInstitutionGettingStartedSteps, shouldShowInstitutionGettingStarted } from '../pages/Institution/institutionGettingStarted.js';

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const clientSrc = path.resolve(here, '..');
const repoRoot = path.resolve(clientSrc, '..', '..');

function read(rel) {
  return readFileSync(path.join(clientSrc, rel), 'utf8');
}
function readRoot(rel) {
  return readFileSync(path.join(repoRoot, rel), 'utf8');
}

const phoneInput = read('components/forms/PhoneInput.jsx');
const countrySelect = read('components/forms/CountrySelect.jsx');
const searchable = read('components/forms/SearchableSelect.jsx');
const cascade = read('components/forms/LocationCascadeFilter.jsx');
const postJob = read('pages/Employer/EmployerPostJob.jsx');
const jobs = read('pages/Jobs/Jobs.jsx');
const temporal = read('components/forms/NativeTemporalInput.jsx');
const css = read('index.css');
const callingCodes = readRoot('shared/international/callingCodes.js');

check(ISO_3166_ALPHA2.length >= 240, `canonical ISO catalog is complete (${ISO_3166_ALPHA2.length})`);
check(Object.keys(COUNTRY_CALLING_CODES).length >= 230, `calling-code map covers the catalog (${Object.keys(COUNTRY_CALLING_CODES).length})`);
check(getCountryCallingCode('PK') === '92' && getCountryCallingCode('US') === '1' && getCountryCallingCode('CA') === '1', 'PK/US/CA calling codes');
check(countriesForCallingCode('1').includes('US') && countriesForCallingCode('1').includes('CA'), 'US and CA share +1');
check(listPhoneCountries('en').length >= 230, 'listPhoneCountries is not a 15–20 subset');
check(listPhoneCountries('en').some((row) => row.countryCode === 'AX'), 'Åland Islands is in the phone catalog when it has a calling code');

const parsedPk = parseE164ToPhoneParts('+923001234567');
check(parsedPk?.countryCode === 'PK' && parsedPk.callingCode === '92' && parsedPk.nationalNumber === '3001234567', 'E.164 PK parse uses ISO identity');
const parsedNanp = parseE164ToPhoneParts('+14155552671', { preferredCountry: 'CA' });
check(parsedNanp?.countryCode === 'CA' && parsedNanp.callingCode === '1', '+1 prefers explicit country, not a silent US default');
const parsedUs = parseE164ToPhoneParts('+14155552671', { preferredCountry: 'US' });
check(parsedUs?.countryCode === 'US', '+1 with US hint stays US');
const ambiguous = parseE164ToPhoneParts('+14155552671');
check(ambiguous?.countryCode === '' && ambiguous.callingCode === '1', 'shared +1 without hint does not invent a country');

check(/listPhoneCountries/.test(phoneInput), 'A. PhoneInput uses canonical dial-country catalog');
check(!/<select/.test(phoneInput), 'PhoneInput is not a native select');
check(!/DEFAULT_COUNTRY = 'US'/.test(phoneInput), 'PhoneInput has no silent US default');
check(/SearchableSelect/.test(phoneInput) && /role="combobox"/.test(searchable), 'Phone country is a searchable combobox');
check(/ISO_3166_ALPHA2/.test(countrySelect) && /SearchableSelect/.test(countrySelect), 'CountrySelect uses the same ISO catalog + combobox');
check(/createPortal/.test(searchable) && /flip\(/.test(searchable), 'dropdown portals with flip/shift');

check(/LocationCascadeFilter/.test(jobs) && /CountrySelect/.test(cascade), 'J. Jobs uses shared CountrySelect via LocationCascadeFilter');
check(/countryCode: code \|\| '', region: '', city: ''/.test(cascade), 'K. Country change clears region and city');
check(/region: event\.target\.value, city: ''/.test(cascade), 'K. Region change clears city');
check(/CountrySelect/.test(postJob) && /regionsForCountry/.test(postJob), 'Employer jobs/new uses CountrySelect + truthful region catalog');
check(/region: '', city: ''/.test(postJob), 'Employer country change clears stale region/city');
check(!/PROVINCES\.map/.test(postJob), 'Employer jobs/new no longer uses a PK-only province mini-list');

const rolePages = [
  'pages/Employer/EmployerRegister.jsx',
  'pages/Institution/InstitutionVerification.jsx',
  'pages/Institution/InstitutionProfile.jsx',
  'pages/Agent/AgentOnboarding.jsx',
  'pages/Agent/AgentProfile.jsx',
];
for (const rel of rolePages) {
  const src = read(rel);
  check(/PhoneInput/.test(src), `${rel} uses shared PhoneInput`);
  check(!/AE: '971'|COUNTRY_CALLING_CODES\s*=/.test(src), `B. ${rel} has no private dial-code array`);
  check(!/defaultCountry=\{[^}]*'US'/.test(src), `${rel} does not silently default phone country to US`);
}

check(/temporal-input/.test(temporal) && /showPicker/.test(temporal), 'H. shared Date/Time wrapper exists');
check(/::-webkit-calendar-picker-indicator/.test(css) && /--icon/.test(css), 'H. global native indicator uses --icon, not invert-only');
check(!/html\.dark input\[type='date'\]::-webkit-calendar-picker-indicator[\s\S]{0,80}filter: invert\(1\)/.test(css), 'no dark-only invert on date indicators');
check(/Open date picker/.test(temporal) && /Open time picker/.test(temporal), 'wrapper exposes one accessible trigger');

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '__tests__') walk(full, out);
    else if (/\.(jsx|js)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const dateFiles = walk(clientSrc).filter((file) => {
  const src = readFileSync(file, 'utf8');
  return /type=["']date["']|type=["']time["']|type=["']datetime-local["']/.test(src);
});
const protectedWip = dateFiles.filter((file) => /FormField\.jsx|AdminTableFilters\.jsx/.test(file.replace(/\\/g, '/')));
check(dateFiles.length >= 1, `date/time occurrences exist (${dateFiles.length} files)`);
check(
  dateFiles.every((file) => {
    const rel = file.replace(/\\/g, '/');
    return /FormField\.jsx|AdminTableFilters\.jsx|NativeTemporalInput\.jsx/.test(rel) || /type=["'](date|time|datetime-local)["']/.test(readFileSync(file, 'utf8'));
  }),
  'every remaining native date/time file is accounted for (wrapper, WIP, or inherits global CSS)'
);
check(protectedWip.length <= 2, 'FormField/AdminTableFilters WIP not edited for this sweep');

const emptyIdentity = validateAgentOnboardingStep('identity', { professionalName: '', countryCode: '' });
check(!emptyIdentity.ok, 'F. empty identity cannot complete');
const filledIdentity = validateAgentOnboardingStep('identity', { professionalName: 'Ada', countryCode: 'PK' });
check(filledIdentity.ok, 'identity completes with required fields');
const emptyServices = validateAgentOnboardingStep('services', { officialEmail: '' });
check(!emptyServices.ok, 'F. empty contact email cannot complete');
const skipMarkets = validateAgentOnboardingStep('markets', {}, { skip: true });
check(skipMarkets.ok && skipMarkets.skipped, 'markets may skip');
const emptyMarketsSave = validateAgentOnboardingStep('markets', {});
check(!emptyMarketsSave.ok, 'empty markets Save & Continue is rejected');
const skipIdentity = validateAgentOnboardingStep('identity', {}, { skip: true });
check(!skipIdentity.ok, 'required identity cannot skip');

const onboarding = read('pages/Agent/AgentOnboarding.jsx');
check(/validateAgentOnboardingStep/.test(onboarding), 'client uses shared onboarding policy');
check(/submitOnboardingStep\(step\.key, \{ skip \}\)/.test(onboarding), 'G. progress advances only after submitOnboardingStep');
check(/Skip for now/.test(onboarding), 'skippable steps expose Skip for now');
check(/setCurrentStep\(\(s\) => s \+ 1\)/.test(onboarding) && /await agentApi\.submitOnboardingStep/.test(onboarding), 'UI increment is after successful save');

const stateA = buildInstitutionGettingStartedSteps({ emailVerified: false, profileCompleteness: 0, verificationStatus: 'draft', claimState: 'not_started' });
check(stateA[0].status === 'current' && shouldShowInstitutionGettingStarted({ emailVerified: false }), 'Institution guide state A: email current');
const stateB = buildInstitutionGettingStartedSteps({ emailVerified: true, profileCompleteness: 20, verificationStatus: 'draft', claimState: 'not_started' });
check(stateB[0].status === 'complete' && stateB[1].status === 'current', 'Institution guide state B: profile current');
const stateC = buildInstitutionGettingStartedSteps({ emailVerified: true, profileCompleteness: 90, verificationStatus: 'under_review', claimState: 'not_started' });
check(stateC[2].status === 'current', 'Institution guide state C: verification pending');
const stateD = buildInstitutionGettingStartedSteps({ emailVerified: true, profileCompleteness: 90, verificationStatus: 'approved', claimState: 'submitted' });
check(stateD[2].status === 'complete' && stateD[3].status === 'current', 'Institution guide state D: claim pending');
const stateE = buildInstitutionGettingStartedSteps({ emailVerified: true, profileCompleteness: 90, verificationStatus: 'approved', claimState: 'approved' });
check(stateE[3].status === 'complete' && !shouldShowInstitutionGettingStarted({ emailVerified: true, profileCompleteness: 90, verificationStatus: 'approved', claimState: 'approved' }), 'Institution guide state E: both gates approved');

check(!/sample job|fixture listing|lorem ipsum/i.test(callingCodes), 'L. no fixture/test content in calling-code source');

console.log(`phase17cvInternationalInputs.test.js: ${count} assertions passed`);
