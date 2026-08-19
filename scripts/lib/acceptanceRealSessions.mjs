// Real-browser session helper. Credentials are supplied by the disposable QA
// environment; the helper never invents auth state or writes tokens to storage.
const SESSION_ENV = Object.freeze({
  student: 'STRIDETO_QA_STUDENT',
  'education-independent': 'STRIDETO_QA_EDUCATION_INDEPENDENT',
  'education-agency': 'STRIDETO_QA_EDUCATION_AGENCY',
  'business-independent': 'STRIDETO_QA_BUSINESS_INDEPENDENT',
  'business-agency': 'STRIDETO_QA_BUSINESS_AGENCY',
  'business-client': 'STRIDETO_QA_BUSINESS_CLIENT',
  employer: 'STRIDETO_QA_EMPLOYER',
  institution: 'STRIDETO_QA_INSTITUTION',
  admin: 'STRIDETO_QA_ADMIN',
});

function credentialsFor(persona) {
  const raw = process.env[SESSION_ENV[persona]];
  if (!raw) throw new Error(`REAL_API_SESSION_CREDENTIALS_MISSING persona=${persona}`);
  let credentials;
  try { credentials = JSON.parse(raw); } catch { throw new Error(`REAL_API_SESSION_CREDENTIALS_INVALID persona=${persona}`); }
  if (!credentials.email || !credentials.password) throw new Error(`REAL_API_SESSION_CREDENTIALS_INVALID persona=${persona}`);
  return credentials;
}

export async function authenticateRealBrowserPage(page, persona, baseUrl) {
  const credentials = credentialsFor(persona);
  const loginPath = ['education-independent', 'education-agency', 'business-independent', 'business-agency'].includes(persona)
    ? '/agent/login'
    : persona === 'employer' ? '/employer/login' : persona === 'institution' ? '/institution/login' : '/auth/login';
  await page.goto(`${baseUrl}${loginPath}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const emailSelector = persona === 'institution' ? '#institution-email' : 'input[type="email"]';
  const passwordSelector = persona === 'institution' ? '#institution-password' : 'input[type="password"]';
  await page.waitForSelector(emailSelector, { timeout: 15000 });
  await page.type(emailSelector, credentials.email);
  await page.type(passwordSelector, credentials.password);
  // Wait for post-login navigation so auth cookies are set before the caller navigates away.
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }),
    page.click('button[type="submit"]'),
  ]);
  return { persona, loginPath };
}

/**
 * Create a fresh browser context and perform the genuine UI login. The access
 * token intentionally remains in the application runtime; this helper never
 * serializes or injects it into a new context.
 */
export async function createAuthenticatedContext(browser, persona, baseUrl) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await authenticateRealBrowserPage(page, persona, baseUrl);
  return { context, page, persona, persistence: 'IN_MEMORY_TOKEN_STORAGESTATE_NOT_APPLICABLE' };
}

export function disposableNamespace(runMarker) {
  if (!runMarker || !/^[A-Za-z0-9_-]+$/.test(runMarker)) throw new Error('Invalid disposable acceptance namespace');
  return `acceptance_${runMarker}`;
}
