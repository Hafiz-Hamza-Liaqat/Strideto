import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Mission A — shared platform foundation contracts for final pre-launch remediation.
 * Source-text contracts (no jsdom runner in this repo).
 */

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

const scroll = read('components/navigation/ScrollManager.jsx');
const skip = read('components/a11y/SkipLink.jsx');
const phone = read('components/forms/PhoneInput.jsx');
const country = read('components/forms/CountrySelect.jsx');
const location = read('components/forms/LocationFields.jsx');
const password = read('components/forms/PasswordInput.jsx');
const welcome = read('components/welcome/PortalWelcomeBanner.jsx');
const portalWelcome = read('welcome/portalWelcome.js');
const phoneShared = readRoot('shared/international/phone.js');

// A1 scroll
check(/navigationType === 'POP'/.test(scroll), 'POP restores browser scroll (no forced top)');
check(/pathname !== prevPathname/.test(scroll) && /scrollToTop\(/.test(scroll), 'PUSH/REPLACE pathname change scrolls top');
check(/scrollToHashTarget\(hash\)/.test(scroll), 'hash navigations target anchors');
check(!/setTimeout\(/.test(scroll), 'ScrollManager has no delay hack');

// A2 skip link
check(/className="skip-link"/.test(skip), 'SkipLink uses skip-link class');
check(/href = '#main-content'/.test(skip), 'SkipLink defaults to #main-content');

const css = read('index.css');
check(/\.skip-link/.test(css) && /:focus/.test(css), 'skip-link focus styles exist in CSS');

// A3–A5 forms / location / phone
check(/type="tel"/.test(phone) || /inputMode="tel"/.test(phone), 'PhoneInput uses tel semantics');
check(!/type=["']number["']/.test(phone), 'PhoneInput is not type=number');
check(/CountrySelect|countryCode/.test(country) || /ISO_3166/.test(country), 'CountrySelect is ISO-backed');
check(/region|State \/ Province \/ Region|city/.test(location), 'LocationFields exposes region/city hierarchy');
check(/type=\{visible \? 'text' : 'password'\}/.test(password), 'PasswordInput toggles password visibility');
check(/Show password/.test(password) && /EyeIcon/.test(password), 'PasswordInput has eye toggle');

check(/normalizePhone|toE164|dialCode/.test(phoneShared) || /nationalNumber/.test(phoneShared), 'shared phone normalization exists');

// A6 password recovery routes exist (student/employer/agent/institution)
const authRoutes = readRoot('server/src/routes/auth.js');
check(/forgot-password/.test(authRoutes) && /reset-password/.test(authRoutes), 'student auth forgot/reset routes exist');
check(
  readRoot('server/src/routes/employer.js').includes('forgot') || readRoot('server/src/routes/employer.js').includes('forgot-password'),
  'employer forgot-password surface exists'
);
check(
  /forgot-password/.test(readRoot('server/src/routes/agent.js')),
  'agent password recovery route exists'
);
check(
  /forgotPassword|forgot-password|resetPassword/.test(readRoot('server/src/controllers/institutionAuthController.js')),
  'institution password recovery controller exists'
);

// A7 welcome once/session
check(/consumeWelcomeBack/.test(welcome), 'welcome-back is consumed once per auth session');
check(/Welcome back/.test(welcome), 'welcome-back copy uses display name pattern');
check(/sessionStorage|markWelcome|consumeWelcomeBack/.test(portalWelcome), 'portal welcome session helpers exist');

console.log(`finalPreLaunchSharedFoundation.test.js: ${count} assertions passed`);
