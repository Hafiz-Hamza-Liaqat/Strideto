import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * SEC-3E — client-side contract verification. The repository has no
 * browser/DOM test runner (no jsdom, no existing `client/src/__tests__`
 * convention) and this phase must not install a large new framework
 * solely to prove a handful of static properties. These checks instead
 * prove the required properties directly against the actual, shipped
 * source text — no browser is required, no property is claimed that a
 * static read cannot actually verify. Real browser-cookie-wire behavior,
 * concurrent-refresh coordination, and actual `withCredentials` network
 * behavior are explicitly NOT claimed here — that is SEC-3F's job.
 */

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const clientSrc = path.resolve(here, '..');

function read(relPath) {
  return readFileSync(path.join(clientSrc, relPath), 'utf8');
}

const axiosBase = read('services/axiosBase.js');
const employerService = read('services/employerService.js');
const authContext = read('context/AuthContext.jsx');
const employerAuthContext = read('context/EmployerAuthContext.jsx');
const authService = read('services/authService.js');
const mediaLibraryParts = read('components/media/MediaLibraryParts.jsx');

// --- No token ever written to localStorage/sessionStorage/IndexedDB -----------
{
  for (const [name, src] of [
    ['axiosBase.js', axiosBase],
    ['employerService.js', employerService],
    ['AuthContext.jsx', authContext],
    ['EmployerAuthContext.jsx', employerAuthContext],
  ]) {
    check(
      !/localStorage\.(set|get|remove)Item\(\s*['"`](edurozgaar-token|edurozgaar-refresh-token|edurozgaar-employer-token|edurozgaar-employer-refresh-token)/.test(
        src
      ),
      `${name}: no localStorage access-or-refresh-token key access`
    );
    check(
      !/sessionStorage\./.test(src),
      `${name}: no sessionStorage usage at all`
    );
    check(
      !/\bindexedDB\.(open|deleteDatabase)\(/.test(src),
      `${name}: no IndexedDB API usage at all`
    );
  }
}

// --- Access token lives only in the module-level in-memory variable -----------
{
  check(
    /let inMemoryAccessToken = null/.test(axiosBase),
    'axiosBase.js: in-memory access-token variable present'
  );
  check(
    /export function getAccessToken/.test(axiosBase),
    'axiosBase.js: exposes getAccessToken()'
  );
  check(
    /export function setAccessToken/.test(axiosBase),
    'axiosBase.js: exposes setAccessToken()'
  );
  check(
    /export function clearAccessToken/.test(axiosBase),
    'axiosBase.js: exposes clearAccessToken()'
  );

  check(
    /let inMemoryEmployerAccessToken = null/.test(employerService),
    'employerService.js: in-memory access-token variable present'
  );
  check(
    /export function getEmployerAccessToken/.test(employerService),
    'employerService.js: exposes getEmployerAccessToken()'
  );
}

// --- withCredentials enabled on both realm's axios instances -------------------
{
  check(
    /axios\.create\(\{[^}]*withCredentials:\s*true/s.test(axiosBase),
    'axiosBase.js: withCredentials true on the instance'
  );
  check(
    /axios\.create\(\{[^}]*withCredentials:\s*true/s.test(employerService),
    'employerService.js: withCredentials true on the instance'
  );
}

// --- Refresh requests never carry a refresh token in the body or a header -----
{
  // The refresh POST call bodies are empty objects; no `refreshToken` field
  // is ever sent, and no `x-refresh-token` header is ever set anywhere in
  // either file.
  const refreshCallPattern = /\/auth\/(employer\/)?refresh-token`?,\s*\{\}/;
  check(
    refreshCallPattern.test(axiosBase),
    'axiosBase.js: refresh call body is empty (no refreshToken field)'
  );
  check(
    refreshCallPattern.test(employerService),
    'employerService.js: refresh call body is empty (no refreshToken field)'
  );
  check(
    !/refreshToken\s*:/.test(axiosBase),
    'axiosBase.js: no refreshToken field constructed anywhere'
  );
  check(
    !/x-refresh-token/i.test(axiosBase) &&
      !/x-refresh-token/i.test(employerService),
    'no x-refresh-token header used by either realm'
  );
  check(
    /refreshUserAccessToken/.test(authService) && /refreshToken:\s*async \(\) => \{/.test(authService),
    'authService.js: refreshToken() shares the cookie refresh flight and posts an empty body'
  );
}

// --- Secure bootstrap: attempts a refresh before trusting any stored state -----
{
  check(
    /refreshToken\(\)\s*\n?\s*\.then/.test(authContext) ||
      /refreshToken\(\)/.test(authContext),
    'AuthContext.jsx: bootstrap calls refreshToken()'
  );
  check(
    /employerAuthApi\s*\n?\s*\.refresh\(\)/.test(employerAuthContext) ||
      /\.refresh\(\)/.test(employerAuthContext),
    'EmployerAuthContext.jsx: bootstrap calls employerAuthApi.refresh()'
  );
}

// --- Realm isolation: Employer bootstrap never runs on a non-employer route ----
{
  check(
    /isEmployerRoutePrefix/.test(employerAuthContext),
    'EmployerAuthContext.jsx: bootstrap gated by isEmployerRoutePrefix, never runs unconditionally'
  );
  check(
    /shouldSkipUserAuthBootstrap/.test(authContext),
    'AuthContext.jsx: bootstrap gated by shouldSkipUserAuthBootstrap on employer routes'
  );
}

// --- Single-flight refresh + bounded retry preserved from the pre-cutover design ---
{
  check(
    /refreshPromise/.test(axiosBase),
    'axiosBase.js: single-flight refreshPromise pattern retained'
  );
  check(
    /original\._retry\s*=\s*true/.test(axiosBase),
    'axiosBase.js: at most one retry per failed request (original._retry guard)'
  );
  check(
    /employerRefreshPromise/.test(employerService),
    'employerService.js: single-flight refreshPromise pattern retained'
  );
  check(
    /original\._retry\s*=\s*true/.test(employerService),
    'employerService.js: at most one retry per failed request'
  );
}

// --- Terminal refresh failure clears only the matching realm's memory state -----
{
  check(
    /clearAccessToken\(\)/.test(axiosBase),
    'axiosBase.js: terminal failure clears the in-memory User token'
  );
  check(
    /clearEmployerAccessToken\(\)/.test(employerService),
    'employerService.js: terminal failure clears the in-memory Employer token'
  );
  check(
    !/clearEmployerAccessToken/.test(axiosBase),
    "axiosBase.js never touches the Employer realm's token store"
  );
  check(
    !/\bclearAccessToken\(\)/.test(employerService),
    "employerService.js never touches the User realm's token store"
  );
}

// --- logout/logoutAll wired on both realms --------------------------------------
{
  check(/logoutAll:/.test(authService), 'authService.js: exposes logoutAll()');
  check(
    /logoutAll:/.test(employerService),
    'employerService.js: exposes logoutAll()'
  );
}

// --- Admin media upload uses only current User-realm in-memory authority --------
{
  check(
    /import\s*\{\s*getAccessToken\s*\}\s*from\s*['"]\.\.\/\.\.\/services\/axiosBase['"]/.test(
      mediaLibraryParts
    ),
    'MediaLibraryParts.jsx: imports the canonical User-realm in-memory authority'
  );
  check(
    /const token = getAccessToken\(\)/.test(mediaLibraryParts),
    'MediaLibraryParts.jsx: reads current in-memory User/Admin access authority'
  );
  check(
    !/localStorage\./.test(mediaLibraryParts),
    'MediaLibraryParts.jsx: does not read or write localStorage'
  );
  check(
    !/sessionStorage\./.test(mediaLibraryParts),
    'MediaLibraryParts.jsx: does not read or write sessionStorage'
  );
  check(
    !/\bindexedDB\./.test(mediaLibraryParts),
    'MediaLibraryParts.jsx: does not use IndexedDB for authentication authority'
  );
  check(
    /if \(!token\)\s*\{\s*reject\(new Error\('Authentication required'\)\);\s*return;/s.test(
      mediaLibraryParts
    ),
    'MediaLibraryParts.jsx: missing in-memory authority fails before upload'
  );
  check(
    /xhr\.open\('POST', `\$\{base\}\/admin\/media\/upload`\)/.test(
      mediaLibraryParts
    ),
    'MediaLibraryParts.jsx: preserves the Admin media upload method and URL'
  );
  check(
    /xhr\.setRequestHeader\('Authorization', `Bearer \$\{token\}`\)/.test(
      mediaLibraryParts
    ),
    'MediaLibraryParts.jsx: Authorization uses only the current in-memory token'
  );
  check(
    /import \{ refreshUserAccessToken \} from '\.\.\/\.\.\/services\/axiosBase';/.test(
      mediaLibraryParts
    ),
    'MediaLibraryParts.jsx: imports the canonical User-realm refresh helper'
  );
  check(
    /if \(xhr\.status === 401 && !retried\)/.test(mediaLibraryParts),
    'MediaLibraryParts.jsx: retries authentication only after a 401'
  );
  check(
    /const newToken = await refreshUserAccessToken\(\)/.test(mediaLibraryParts),
    'MediaLibraryParts.jsx: refreshes through the canonical HttpOnly-cookie flow'
  );
  check(
    /attemptUpload\(newToken, true\)/.test(mediaLibraryParts),
    'MediaLibraryParts.jsx: retries the upload exactly once with the refreshed token'
  );
  check(
    /form\.append\('files', file\)/.test(mediaLibraryParts) &&
      /if \(folder\) form\.append\('folder', folder\)/.test(mediaLibraryParts),
    'MediaLibraryParts.jsx: preserves upload payload fields'
  );
  check(
    /xhr\.upload\.onprogress/.test(mediaLibraryParts) &&
      /onProgress\(Math\.round\(\(e\.loaded \/ e\.total\) \* 100\)\)/.test(
        mediaLibraryParts
      ),
    'MediaLibraryParts.jsx: preserves XHR upload progress behavior'
  );
  check(
    /signal\.addEventListener\(\s*'abort',\s*\(\) => \{\s*xhr\.abort\(\)/s.test(
      mediaLibraryParts
    ),
    'MediaLibraryParts.jsx: preserves upload cancellation behavior'
  );
  check(
    /xhr\.status === 409 && data\.duplicate/.test(mediaLibraryParts),
    'MediaLibraryParts.jsx: preserves duplicate-upload handling'
  );
  check(
    !/refreshToken|x-refresh-token/i.test(mediaLibraryParts),
    'MediaLibraryParts.jsx: has no JavaScript-visible refresh credential compatibility'
  );
  check(
    !/(adminToken|admin-token|admin_token)/i.test(mediaLibraryParts),
    'MediaLibraryParts.jsx: creates no separate Admin token authority'
  );
}

// --- Agent + Institution realm client contract (Phase 1) ----------------------
{
  const agentService = read('services/agentService.js');
  const agentAuthContext = read('context/AgentAuthContext.jsx');
  const institutionService = read('services/institutionPortalService.js');
  const institutionAuthContext = read('context/InstitutionAuthContext.jsx');

  for (const [name, src] of [
    ['agentService.js', agentService],
    ['institutionPortalService.js', institutionService],
  ]) {
    check(
      !/localStorage\.(set|get|remove)Item\([^)]*refresh/i.test(src),
      `${name}: no browser-readable refresh token storage`
    );
    check(!/sessionStorage\./.test(src), `${name}: no sessionStorage usage`);
  }

  check(/let inMemoryAgentAccessToken/.test(agentService), 'agentService: in-memory access token');
  check(/let institutionAccessToken/.test(institutionService), 'institutionService: in-memory access token');
  check(/isAuthenticated/.test(agentAuthContext), 'AgentAuthContext: isAuthenticated contract');
  check(/isAuthenticated/.test(institutionAuthContext), 'InstitutionAuthContext: isAuthenticated contract');
  check(/refreshToken\(\)/.test(agentAuthContext), 'AgentAuthContext: cookie refresh bootstrap');
  check(/\.refresh\(\)/.test(institutionAuthContext), 'InstitutionAuthContext: cookie refresh bootstrap');
}

console.log(`secureAuthClientContract.test.js: ${count} assertions passed`);
