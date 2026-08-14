import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  canonicalizeStoredPhone,
  countriesForCallingCode,
  formatPhoneE164,
  getCountryCallingCode,
  listPhoneCountries,
  normalizeNationalNumberInput,
  normalizePhone,
  storedPhoneFromInput,
} from '../../../shared/international/phone.js';

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

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '__tests__') walk(full, out);
    else if (/\.(jsx|js)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const phoneInput = read('components/forms/PhoneInput.jsx');
check(/normalizeNationalNumberInput/.test(phoneInput), 'PhoneInput uses the shared national-number normalizer');
check(/type="tel"/.test(phoneInput) && /inputMode="numeric"/.test(phoneInput), 'digits-only keyboard: type=tel + inputMode=numeric');
check(!/type=["']number["']/.test(phoneInput), 'PhoneInput is not type=number');
check(/listPhoneCountries/.test(phoneInput), 'country source is listPhoneCountries');
check(!/DEFAULT_COUNTRY = 'US'|defaultCountry = 'PK'/.test(phoneInput), 'no silent US/PK default');

check(normalizeNationalNumberInput('0331 791 1012') === '03317911012', 'pasted spaces normalize to digits');
check(normalizeNationalNumberInput('(331) 791-1012') === '3317911012', 'pasted punctuation normalizes to digits');
check(normalizeNationalNumberInput('abc331xyz') === '331', 'letters are removed; remaining digits are not pretended valid');
check(formatPhoneE164({ countryCode: 'PK', nationalNumber: 'abc331xyz' }) === null, 'letter-stripped remnant is not silently valid');

check(formatPhoneE164({ countryCode: 'PK', nationalNumber: '3317911012' }) === '+923317911012', 'PK E.164');
check(formatPhoneE164({ countryCode: 'US', nationalNumber: '4155552671' }) === '+14155552671', 'US E.164');
check(formatPhoneE164({ countryCode: 'CA', nationalNumber: '4165551234' }) === '+14165551234', 'CA E.164 keeps CA identity via ISO');
check(formatPhoneE164({ countryCode: 'GB', nationalNumber: '2071234567' }) === '+442071234567', 'GB E.164');
check(formatPhoneE164({ countryCode: 'DE', nationalNumber: '30123456' }) === '+4930123456', 'DE E.164');
check(formatPhoneE164({ countryCode: 'AU', nationalNumber: '412345678' }) === '+61412345678', 'AU E.164');
check(getCountryCallingCode('FIN') === null && getCountryCallingCode('FI') === '358', '+3-digit dial code (FI 358)');
check(formatPhoneE164({ countryCode: 'FI', nationalNumber: '401234567' }) === '+358401234567', 'FI +358 E.164');
check(countriesForCallingCode('1').includes('US') && countriesForCallingCode('1').includes('CA'), 'shared +1 identity');
check(listPhoneCountries('en').length >= 230, 'full ISO calling-code catalog');

check(storedPhoneFromInput({ nationalNumber: '12', e164: null }).incomplete === true, 'too-short local number is incomplete, not valid');
check(canonicalizeStoredPhone('+923317911012').value === '+923317911012', 'stored canonical E.164');
check(canonicalizeStoredPhone('not-a-phone').ok === false, 'backend rejects malformed value');
check(canonicalizeStoredPhone({ e164: '+14155552671', phoneVerified: true }).value === '+14155552671', 'client metadata is ignored; only e164 is stored');
check(canonicalizeStoredPhone({ phoneVerified: true, nationalNumber: '331' }).ok === false, 'phoneVerified cannot mint a valid number');
check(normalizePhone('03001234567') === null, 'no silent country default during normalize');

const agentVerification = read('pages/Agent/AgentVerification.jsx');
check(/PhoneInput/.test(agentVerification) && /agent-verification-phone/.test(agentVerification), 'Agent verification uses canonical PhoneInput');
check(!/<label[^>]*>Phone<input value=\{profile\.phone\}/.test(agentVerification), 'Agent verification no longer has a plain phone text field');

for (const rel of [
  'pages/Employer/EmployerRegister.jsx',
  'pages/Agent/AgentOnboarding.jsx',
  'pages/Institution/InstitutionVerification.jsx',
  'pages/Institution/InstitutionProfile.jsx',
]) {
  check(/PhoneInput/.test(read(rel)), `${rel} still uses PhoneInput`);
}

const canonicalPages = [
  'pages/Agent/AgentVerification.jsx',
  'pages/Agent/AgentOnboarding.jsx',
  'pages/Agent/AgentProfile.jsx',
  'pages/Employer/EmployerRegister.jsx',
  'pages/Employer/EmployerVerification.jsx',
  'pages/Employer/EmployerSettings.jsx',
  'pages/Institution/InstitutionVerification.jsx',
  'pages/Institution/InstitutionProfile.jsx',
  'pages/TalentProfile/TalentProfileForm.jsx',
  'pages/Student/StudentInstitutionApply.jsx',
  'pages/ResumeBuilder/ResumeForm.jsx',
  'components/applications/ContactsPanel.jsx',
];
let canonicalCount = 0;
for (const rel of canonicalPages) {
  const src = read(rel);
  check(/<PhoneInput|PhoneInput /.test(src), `${rel} is canonical PhoneInput`);
  canonicalCount += 1;
}

const editablePhoneRe = /<(input|textarea)[^>]*(name=["']phone|id=["'][^"']*phone|placeholder=\{?t\(['"]phone)/i;
const files = walk(path.join(clientSrc));
const plainEditable = [];
const displayOnly = [];
const exceptions = [];
for (const file of files) {
  const rel = file.replace(/\\/g, '/').split('/src/')[1] || file;
  const src = readFileSync(file, 'utf8');
  if (!/phone|telephone|mobileNumber|contactPhone|officialPhone/i.test(src)) continue;
  if (/PhoneInput/.test(src)) continue;
  if (/__tests__/.test(rel)) continue;
  if (/AdminSiteCms\.jsx/.test(rel) && /footerNav\.contact\?\.phone/.test(src)) {
    exceptions.push(`${rel} (CMS freeform footer contact line)`);
    continue;
  }
  if (/AdminVerificationQueue\.jsx/.test(rel) && /Field label="Phone"/.test(src)) {
    displayOnly.push(rel);
    continue;
  }
  if (/InstitutionDetail\.jsx|AgentPublicProfile|CompanyProfile|UniversityProfile/.test(rel)) {
    displayOnly.push(rel);
    continue;
  }
  if (editablePhoneRe.test(src) && /onChange=/.test(src)) {
    plainEditable.push(rel);
  }
}
check(plainEditable.length === 0, `no remaining user-editable plain phone fields: ${plainEditable.join(', ') || 'none'}`);
check(canonicalCount >= 12, `canonical PhoneInput call sites (${canonicalCount})`);

const serverPhone = readRoot('shared/international/phone.js');
check(/export function canonicalizeStoredPhone/.test(serverPhone), 'shared canonicalizeStoredPhone is the server authority helper');
const employerVal = readRoot('server/src/utils/employerProfileValidation.js');
const agentSvc = readRoot('server/src/services/agentProfileService.js');
const instSvc = readRoot('server/src/services/institutionPortalService.js');
const verCtrl = readRoot('server/src/controllers/organization/organizationVerificationController.js');
check(/canonicalizeStoredPhone/.test(employerVal), 'employer profile phone is server-canonical');
check(/canonicalizeStoredPhone/.test(agentSvc), 'agent profile phone is server-canonical');
check(/canonicalizeStoredPhone/.test(instSvc), 'institution officialPhone is server-canonical');
check(/canonicalizeStoredPhone/.test(verCtrl) && /delete next\.phoneVerified/.test(verCtrl), 'verification dossier phone is canonical and ignores client trust flags');

check(!/OTP|WhatsApp|sms verification/i.test(phoneInput), 'no phone OTP/SMS/WhatsApp in PhoneInput');

console.log(`phase17cvrPhoneContract.test.js: ${count} assertions passed; canonical=${canonicalCount} displayOnly=${displayOnly.length} exceptions=${exceptions.length} plainEditable=${plainEditable.length}`);
console.log(`displayOnly=${JSON.stringify(displayOnly)}`);
console.log(`exceptions=${JSON.stringify(exceptions)}`);
