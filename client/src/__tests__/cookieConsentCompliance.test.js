import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  CONSENT_VERSION,
  createConsentRecord,
  normalizeConsent,
  isConsentCurrent,
  allowsAnalytics,
  allowsMarketing,
  allowsFunctional,
  writeConsent,
  acceptAllConsent,
  rejectNonEssentialConsent,
  hasStoredConsent,
  readStoredConsent,
} from '../consent/cookieConsentStorage.js';

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

// --- In-memory localStorage shim for persistence assertions ---
const mem = new Map();
globalThis.window = globalThis.window || {};
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => { mem.set(k, String(v)); },
  removeItem: (k) => { mem.delete(k); },
  clear: () => mem.clear(),
};
globalThis.window.localStorage = globalThis.localStorage;
globalThis.window.dispatchEvent = () => true;

mem.clear();

// COOKIE-12 / COOKIE-09 / COOKIE-11 — consent versioning & persistence
const all = acceptAllConsent({ adsConfigured: true });
check(all.version === CONSENT_VERSION, 'COOKIE-12: consent version is current');
check(all.necessary === true, 'COOKIE-11: necessary always true on accept all');
check(all.analytics === true && all.marketing === true && all.functional === true, 'COOKIE-08: accept enables permitted categories');
check(hasStoredConsent({ adsConfigured: true }), 'COOKIE-09: preferences persist (hasStoredConsent)');
check(readStoredConsent({ adsConfigured: true }).analytics === true, 'COOKIE-09: stored analytics true');

const rejected = rejectNonEssentialConsent({ adsConfigured: true });
check(rejected.analytics === false && rejected.marketing === false, 'COOKIE-07: reject clears optional');
check(rejected.necessary === true && rejected.functional === true, 'COOKIE-07: reject keeps necessary + functional');
check(allowsAnalytics(rejected) === false, 'COOKIE-05: analytics not allowed after reject');
check(allowsMarketing(rejected) === false, 'COOKIE-06: marketing not allowed after reject');

const forced = writeConsent({ necessary: false, functional: false, analytics: true, marketing: true }, { adsConfigured: true });
check(forced.necessary === true, 'COOKIE-11: essential cannot be disabled via writeConsent');

const legacyAll = normalizeConsent('all', { adsConfigured: true });
check(legacyAll?.analytics === true && isConsentCurrent(legacyAll), 'legacy "all" maps to versioned consent');
const legacyEssential = normalizeConsent('essential', { adsConfigured: false });
check(legacyEssential?.analytics === false && legacyEssential?.marketing === false, 'legacy "essential" maps without analytics');

const noAdsMarketing = createConsentRecord({ marketing: true, adsConfigured: false });
check(noAdsMarketing.marketing === false, 'COOKIE-14: marketing forced false when ads not configured');

check(allowsFunctional(null) === true, 'functional allowed before explicit opt-out');
check(allowsFunctional(createConsentRecord({ functional: false })) === false, 'functional respects opt-out');

// COOKIE-01 / COOKIE-02 — routes & footer
const constants = read('constants/index.js');
const routes = read('routes/index.jsx');
const footer = read('components/layout/Footer.jsx');
const cookiesPage = read('pages/Static/Cookies.jsx');
const privacyPage = read('pages/Static/PrivacyPolicy.jsx');
const staticEn = read('i18n/locales/en/static.json');
const seoEn = read('i18n/locales/en/seo.json');
const footerEn = read('i18n/locales/en/footer.json');
const consentUi = read('components/consent/CookieConsent.jsx');
const platformAnalytics = read('utils/platformAnalytics.js');
const adBanner = read('components/ads/AdBanner.jsx');
const adTracking = read('utils/adTracking.js');
const authCookiePolicy = readRoot('server/src/services/auth/AuthCookiePolicy.js');
const indexHtml = readRoot('client/index.html');

check(/COOKIES:\s*'\/cookie-policy'/.test(constants), 'COOKIE-01: Cookie Policy route is /cookie-policy');
check(/COOKIES_LEGACY:\s*'\/cookies'/.test(constants), 'COOKIE-01: legacy /cookies retained');
check(/path: ROUTES\.COOKIES/.test(routes) && /path: ROUTES\.COOKIES_LEGACY/.test(routes), 'COOKIE-01: both cookie routes mounted');
check(/footer:cookiePolicy/.test(footer) && /ROUTES\.COOKIES/.test(footer), 'COOKIE-02: Footer links Cookie Policy');
check(/footer:cookieSettings/.test(footer) && /openCookieSettings/.test(footer), 'COOKIE-10: Footer Cookie Settings reopens preferences');
check(footerEn.includes('"cookieSettings"'), 'COOKIE-10: cookieSettings label exists');

// COOKIE-03 — policy does not claim absent third-party analytics brands as active
check(!/we use Google Analytics/i.test(staticEn), 'COOKIE-03: does not claim Google Analytics in use');
check(/No Google Analytics/.test(staticEn) || /do not use Google Analytics/i.test(staticEn), 'COOKIE-03: explicitly denies unused analytics SDKs');
check(/HttpOnly refresh-session cookies/.test(staticEn), 'COOKIE-03: discloses auth cookies');
check(/er_analytics_session/.test(staticEn), 'COOKIE-03: discloses analytics session key');
check(/edurozgaar-theme/.test(staticEn) && /edurozgaar-lang/.test(staticEn), 'COOKIE-03: discloses preference storage');

// COOKIE-14 — no fake marketing UI when ads absent
check(/adsConfigured \?/.test(consentUi) && /cookieCatMarketing/.test(consentUi), 'COOKIE-14: marketing toggle only when adsConfigured');
check(/cookiesMarketingAbsentBody/.test(cookiesPage), 'COOKIE-14: policy explains absent marketing');

// COOKIE-04 — auth not gated by optional consent
check(!/allowsAnalytics|allowsMarketing|hasAdConsent|cookieConsent/.test(read('context/AuthContext.jsx')), 'COOKIE-04: AuthContext not gated by consent');
check(!/allowsAnalytics|allowsMarketing|cookieConsent/.test(read('services/axiosBase.js')), 'COOKIE-04: axiosBase not gated by consent');
check(/httpOnly:\s*true/.test(authCookiePolicy) && /sameSite:\s*'lax'/.test(authCookiePolicy), 'COOKIE-15: auth cookie HttpOnly + SameSite=Lax');
check(/name:\s*'__Secure-strideto_user_rt'/.test(authCookiePolicy), 'COOKIE-15: production __Secure- refresh cookie name');
check(/secure,\s*\n\s*sameSite/.test(authCookiePolicy) || /const secure = mode === 'production'/.test(authCookiePolicy), 'COOKIE-15: Secure in production');

// COOKIE-05 / 06 / 07 — gating in source
check(/allowsAnalytics\(\)/.test(platformAnalytics), 'COOKIE-05: platform analytics gated on consent');
check(/hasAdConsent\(\)|allowsMarketing/.test(adBanner), 'COOKIE-06: AdSense gated on marketing consent');
check(/allowsAnalytics\(\)/.test(adTracking), 'COOKIE-05: house-ad tracking gated on analytics consent');

// COOKIE-13 — Privacy Policy references Cookie Policy
check(/ROUTES\.COOKIES/.test(privacyPage) && /privacyCookieRef/.test(privacyPage), 'COOKIE-13: Privacy Policy links Cookie Policy');
check(/Cookie Policy/.test(staticEn) || /privacyCookieRef/.test(staticEn), 'COOKIE-13: privacy copy references cookies');

// Preference center actions
check(/cookieRejectNonEssential/.test(consentUi) && /cookieManagePreferences/.test(consentUi) && /acceptAll/.test(consentUi), 'banner has Reject / Manage / Accept');
check(/disabled/.test(consentUi) && /cookie-necessary/.test(consentUi), 'COOKIE-11: necessary toggle disabled in UI');
check(/OPEN_COOKIE_SETTINGS_EVENT/.test(consentUi), 'COOKIE-10: settings event reopens UI');
check(/hasStoredConsent\(\)/.test(consentUi), 'banner shows when consent missing');
check(!/getAdSenseClientId\(\)\s*\)\s*return/.test(consentUi), 'banner no longer ads-only gated');

// No new third-party trackers introduced
check(!/googletagmanager|gtag\(|fbq\(|hotjar|clarity\.ms|posthog|mixpanel/i.test(indexHtml), 'COOKIE-16-ish: index.html has no tracker scripts');
check(!existsSync(path.join(clientSrc, 'services/googleAnalytics.js')), 'no GA service module added');

// seo strings present
check(seoEn.includes('cookieRejectNonEssential') && seoEn.includes('cookieCatAnalytics'), 'seo consent strings present');

console.log(`cookieConsentCompliance.test.js: ${count} assertions passed`);
