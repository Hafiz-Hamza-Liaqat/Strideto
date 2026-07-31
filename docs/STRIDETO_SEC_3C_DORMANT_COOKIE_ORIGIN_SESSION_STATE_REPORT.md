# STRIDETO-SEC-3C — Dormant Cookie, Origin and Session-State Primitives

**SEC-3C.1 correction applied.** The original SEC-3C-A acceptance audit
found two Medium findings: (1) a forced-preflight marker evaluator was
implemented as if it were an adopted, exact contract, when the
architecture report only offers it as a hedged illustrative example; (2)
cookie-value validation accepted characters outside the RFC 6265
`cookie-octet` set. Both were corrected under SEC-3C.1, scoped to exactly
five of the eight files listed in §3 (the two policy modules, the shared
contracts module, and their two test files) plus this report. See §14 for
the full correction record; §5, §6, and §8 below reflect the corrected,
current state directly rather than being left to describe superseded
behavior.

## 1. Repository baseline

Preflight before this phase: HEAD `1fa16c3c58ec6a54bb954a3957ddfcdb46dac03a`
(`feat: add dormant refresh session and jwt foundation`), branch
`main...origin/main [ahead 24]`, no tracked modification, no staged file,
untracked files exactly `docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md`
and `docs/STRIDETO_AUDIT_01_COMPLETE_PLATFORM_SECURITY_AUDIT.md`. Confirmed
matching before any edit and reconfirmed unchanged at the end (§13).

## 2. Architecture authority

`docs/STRIDETO_AUTHENTICATION_SESSION_SECURITY_ARCHITECTURE_AUDIT.md`,
specifically §18 (cookie contract), §18A (realm isolation), §18B
(local-development cookie contract), §19 (CSRF/origin contract), §24
(access-token invalidation enforcement — the subject-state provider's
"Option A" baseline). SEC-3A checkpoint `e19ad912754d1fde44ad0234f85be38e2c252d9f`;
SEC-3B checkpoint `1fa16c3c58ec6a54bb954a3957ddfcdb46dac03a`.

**One reconciliation note**: the SEC-3C task prompt itself stated the
production user cookie name as `__Secure-strideto_rt`. The authoritative
architecture report (§18, §18A) specifies `__Secure-strideto_user_rt`.
Per the task's own instruction that the architecture report is
authoritative, and per its own general instruction not to assume when
repository/documentation sources differ, the report's exact value —
`__Secure-strideto_user_rt` — was implemented. This is stated here
explicitly rather than silently resolved.

## 3. Exact files created

- `server/src/services/auth/AuthSessionPrimitiveContracts.js`
- `server/src/services/auth/AuthCookiePolicy.js`
- `server/src/services/auth/TrustedRequestOriginPolicy.js`
- `server/src/services/auth/SessionSubjectStateProvider.js`
- `server/src/__tests__/authCookiePolicy.test.js`
- `server/src/__tests__/trustedRequestOriginPolicy.test.js`
- `server/src/__tests__/sessionSubjectStateProvider.test.js`
- `docs/STRIDETO_SEC_3C_DORMANT_COOKIE_ORIGIN_SESSION_STATE_REPORT.md`
  (this file)

**No existing file was modified.** `User.js`/`Employer.js` were not
touched — this phase is read-only against the SEC-3B foundation, reusing
its `REFRESH_SESSION_SUBJECT_TYPES` realm enum by import rather than
redeclaring it (`AuthSessionPrimitiveContracts.js` imports it from
`RefreshSessionContracts.js`).

## 4. Current live auth path — preserved, unchanged, verified

Discovery confirmed the exact live route paths before any edit
(`server/src/routes/auth.js`, `server/src/routes/employer.js`, both
mounted at `/api` in `server/src/index.js`):

|         | User                           | Employer                                |
| ------- | ------------------------------ | --------------------------------------- |
| Login   | `POST /api/auth/login`         | `POST /api/auth/employer/login`         |
| Refresh | `POST /api/auth/refresh-token` | `POST /api/auth/employer/refresh-token` |
| Logout  | `POST /api/auth/logout`        | `POST /api/auth/employer/logout`        |

These match the architecture report's assumed paths exactly — confirmed,
not assumed. `server/src/config/cors.js` and `server/src/config/validateEnv.js`
were inspected and are unchanged; `server/src/middleware/auth.js` and
`server/src/controllers/authController.js`/`employerAuthController.js`
were inspected for the existing call graph and are unchanged. No new
module in this phase is imported by any of them — verified in §9.

## 5. `AuthCookiePolicy.js`

### Runtime-mode resolution

`resolveRuntimeMode({ nodeEnv, appEnv })` is a pure function, never reads
`process.env` itself. Production requires `nodeEnv === 'production'`; if
`appEnv` is also supplied, it must agree (`APP_ENV` is a real, already-used
repository env var — confirmed in `server/src/routes/health.js` and
`.env.production.example`) — disagreement throws, satisfying §18B's
"NODE_ENV/an equivalent app-env flag resolves ambiguously" hard-fail
condition. Not wired into `validateEnv.js` in this phase.

### Production cookie names and Paths

| Attribute | User                                                                     | Employer                           |
| --------- | ------------------------------------------------------------------------ | ---------------------------------- |
| Name      | `__Secure-strideto_user_rt`                                              | `__Secure-strideto_employer_rt`    |
| Path      | `/api/auth/refresh-token`                                                | `/api/auth/employer/refresh-token` |
| HttpOnly  | `true`                                                                   | `true`                             |
| Secure    | `true`                                                                   | `true`                             |
| SameSite  | `lax`                                                                    | `lax`                              |
| Domain    | omitted                                                                  | omitted                            |
| Max-Age   | `maxAgeMs` (milliseconds), serialized as `Max-Age` (seconds) — see below | same                               |
| Priority  | `high`                                                                   | same                               |

### Max-Age units (SEC-3C.2A)

The injected configuration field is named `maxAgeMs` and its unit is
**milliseconds** — `assertValidConfig` requires it to be a positive finite
integer (`Number.isInteger(maxAgeMs) && maxAgeMs > 0`, constructor-time
`TypeError` otherwise). `cookieOptions()` passes this value unchanged as
`options.maxAge` to `res.cookie()`; Express/the `cookie` package then
serializes the wire HTTP `Max-Age` attribute in **seconds**, dividing by
1000 internally. Example: an injected `maxAgeMs` of `604800000`
(milliseconds) means seven days, and serializes on the wire as
`Max-Age=604800` (seconds) — verified directly against a real Express
`res.cookie()`/HTTP round-trip during SEC-3C.1's cookie-octet work. There
is no seconds-versus-milliseconds ambiguity anywhere in the SEC-3C
contract: every internal reference (`maxAgeMs`, `assertValidConfig`, the
test suite) uses milliseconds consistently; only the final wire
serialization step — performed by the `cookie` package, not by this
module — is in seconds.

### Development cookie names and Paths

| Attribute | User                                                      | Employer                           |
| --------- | --------------------------------------------------------- | ---------------------------------- |
| Name      | `strideto_dev_rt`                                         | `strideto_dev_employer_rt`         |
| Path      | `/api/auth/refresh-token` (identical route to production) | `/api/auth/employer/refresh-token` |
| HttpOnly  | `true`                                                    | `true`                             |
| Secure    | `false`                                                   | `false`                            |
| SameSite  | `lax`                                                     | `lax`                              |
| Domain    | omitted                                                   | omitted                            |

A production `__Secure-`-prefixed name is structurally impossible to
select in development mode and vice versa — the two attribute sets are
looked up by resolved `mode`, not mixed.

**Production configuration hard-fails** (constructor-time `TypeError`)
when: `apiOrigin` is missing or not HTTPS; `trustedOrigins` is empty;
`maxAgeMs` is not a positive finite integer; `mode` is anything other than
exactly `'production'`/`'development'` (an ambiguous/unknown mode, e.g.
`'staging'`, is rejected outright — verified by test).

### Set/clear matching behavior

`clearRefreshCookie` uses the exact same name and Path as
`writeRefreshCookie`, and the same `secure`/`sameSite` values; it
deliberately omits `maxAge` (not required for clearing, and the installed
`cookie` package — v0.7.2, confirmed by direct inspection — has no
deprecated-option concern here, but omitting an unnecessary attribute on
the clearing call is the more conservative choice). No `Domain` is set on
either call. A logout call may clear the cookie without the cookie having
been present on the request — verified by test (`clearRefreshCookie` is
called with no prior `extractRefreshToken` call and still succeeds). The
Path was not broadened to make logout "receive" the cookie — logout
remains bearer-authenticated per §18A/§19, consistent with not touching
any live controller in this phase.

### Cookie-header extraction and duplicate handling

`extractRefreshToken` is a dependency-free, exact-name parser — no
`cookie-parser` was added. Before any parsing, a `Cookie` header
containing a raw CR, LF, or NUL is rejected outright
(`INVALID_COOKIE_INPUT`) — these can never legitimately appear in a real
HTTP header value. It then splits on `;`, matches only the exact realm
cookie name, and returns one of: `COOKIE_FOUND` (with the token, the one
result carrying sensitive data by design), `COOKIE_MISSING` (name absent,
or present with an empty value), `COOKIE_DUPLICATE` (name appears more
than once — rejected outright, never resolved by taking the first/last
occurrence), or `INVALID_COOKIE_INPUT` (the selected value fails the
cookie-octet validator below, or exceeds the maximum length). Never
confuses the user and employer names (verified by test with both cookies
present simultaneously). The selected value is never returned, logged, or
included in any result other than the `COOKIE_FOUND` token field itself.

**Maximum token length**: 4096 characters
(`MAX_REFRESH_TOKEN_LENGTH` in `AuthSessionPrimitiveContracts.js`), applied
identically on both the write and extraction paths.

### RFC 6265 cookie-octet validation (SEC-3C.1)

A single shared validator, `isValidToken`, is the primary safeguard on
both `writeRefreshCookie` and `extractRefreshToken` — Express's own
default `encodeURIComponent`-based percent-encoding of `res.cookie()`
values is defense-in-depth on top of this, never relied upon as the sole
protection. A token is accepted only if it is a non-empty string, at most
4096 characters, and every character is an RFC 6265 §4.1.1 `cookie-octet`
(`COOKIE_OCTET_PATTERN` in `AuthSessionPrimitiveContracts.js`: `%x21 /
%x23-2B / %x2D-3A / %x3C-5B / %x5D-7E`). This rejects control characters
(including CR, LF, NUL, horizontal tab), space, DQUOTE, comma, semicolon,
backslash, and any non-ASCII character — verified by test for each
individually on both the write path (no `res.cookie` call is ever made)
and the extraction path (no token is ever returned). Letters, digits,
`.`, `-`, `_`, `=`, and every other in-range character remain accepted
unmodified — a valid token is never trimmed or otherwise transformed, and
`abc=def=ghi` round-trips through write and extraction exactly unchanged
(verified by test), including at the 4096-character boundary (4096
succeeds, 4097 fails, on both paths).

Because the write-path validator already restricts every written value to
the cookie-octet set, `cookieOptions()` passes an identity `encode: (value)
=> value` to `res.cookie()` rather than Express's default encoder — a
cookie-octet-safe value requires no escaping, and the default encoder
would otherwise percent-encode safe characters such as `=`, breaking
round-trip fidelity. Symmetrically, `extractRefreshToken` does not call
`decodeURIComponent` on the selected value — it validates and returns the
exact wire bytes. Decoding before validating would let a percent-encoded
unsafe sequence (e.g. `%0D%0A`, itself composed entirely of cookie-octet-
safe characters) slip past the validator only to reveal a raw CR/LF after
decoding; validating the literal wire value closes that gap. Write and
read are therefore byte-exact symmetric, with no decode/encode layer for
an attacker to exploit a mismatch in.

A value containing an embedded semicolon is never presented to the
value-validator whole — the header is split into pairs on `;` before any
value validation occurs, so `name=abc;def=ghi` on the wire is already
`name=abc` by the time `abc` reaches `isValidToken` (semicolon can only
ever act as the pair-delimiter, never survive into the validated value);
this is confirmed by test and no code path ever returns a token
containing `;`.

### Absence of a readable CSRF cookie

No CSRF-cookie-writing capability exists anywhere in this module — every
cookie this policy ever writes is `HttpOnly` (verified by test). This
matches §18's explicit withdrawal of the SEC-3A.1 "companion CSRF cookie."

## 6. `TrustedRequestOriginPolicy.js`

### Trusted-origin normalization

Configured entries are parsed with the platform `URL` parser and rejected
outright (constructor-time `TypeError`) if they carry a path other than
`/`, a query, a fragment, embedded credentials, a wildcard host, or are
the literal strings `'null'`/`'*'`, or fail to parse. Production entries
must additionally be HTTPS. Matching is exact-origin-in-a-`Set`, mirroring
`config/cors.js`'s own established approach — never substring, suffix, or
regex matching. `https://strideto.com.evil.example` and a Referer whose
origin is `https://evil.example` (regardless of its query string) are
both rejected by construction, not by a special-cased rule.

### Origin precedence, exactly as §19 specifies

1. `Origin` present (even if invalid/untrusted) → evaluated and returned
   directly; **never** falls back to `Referer` under any circumstance —
   verified by test for a malformed Origin with a simultaneously-trusted
   Referer, and for `Origin: null` with a simultaneously-trusted Referer.
2. `Origin` genuinely absent → `Referer` is parsed as a full absolute URL,
   its origin derived and checked against the same trusted set.
3. Both absent → `ORIGIN_MISSING`, fails closed.
4. A comma-separated/multiple `Origin` header value is treated as
   malformed, not as "pick the first" — since a single-valued `Origin`
   header containing a comma cannot legitimately occur from a
   spec-compliant browser.

### Forced-preflight marker (corrected under SEC-3C.1)

§19 point 4 of the architecture report introduces the forced-preflight
header only as a hedged, illustrative example — "the client sends a
fixed, non-secret header (e.g. `X-Strideto-Client: web`)" — not as a
finalized, adopted, exact contract. No other passage in the checkpointed
report declares a specific header name or value authoritative. The
original SEC-3C implementation treated the example as if it were adopted
and shipped `evaluateForcedPreflightMarker`, `X-Strideto-Client: web`, and
three dedicated result codes (`REQUEST_MARKER_MISSING`/`_INVALID`/
`_VALID`-equivalent); the SEC-3C-A acceptance audit correctly identified
this as exceeding the architecture report's actual authority.

**SEC-3C.1 removes this evaluator entirely** — no marker evaluator, no
marker-specific configuration, no `X-Strideto-Client` requirement or any
other header name, no marker-specific result codes, and no marker-specific
test remain anywhere in `TrustedRequestOriginPolicy.js`,
`AuthSessionPrimitiveContracts.js`, or their tests. The policy object
returned by `createTrustedRequestOriginPolicy` exposes exactly `{ mode,
trustedOrigins, evaluateRequestOrigin }` — verified by an API-surface test
asserting the exact key set and that `evaluateForcedPreflightMarker` is
`undefined`. No alternative header, CSRF cookie, or synchronizer token was
introduced as a replacement. Strict Origin/Referer validation (above)
remains the sole authoritative dormant primitive this module provides.
Exact forced-preflight marker selection, if a marker is adopted at all, is
deferred to SEC-3E, at which point it can be chosen and specified against
real deployment constraints rather than against a hedged example. No
readable CSRF cookie exists anywhere in this phase (§5).

### Public error shape

Not implemented in this phase (no live route/middleware exists yet to
return an HTTP response) — §19 point 8's exact `origin_validation_failed`
body is documented here for the future wiring phase (SEC-3E) to use
verbatim; this module returns only internal safe result codes.

## 7. `SessionSubjectStateProvider.js`

### Inputs and authoritative projection

`getSubjectState({ realm, subjectId, expectedTokenVersion })` validates
`realm` (exactly `user`/`employer`), `subjectId` (a 24-character hex
ObjectId-shaped string), and `expectedTokenVersion` (when supplied, a
non-negative integer) **before** any model call — verified by test
(zero model calls recorded for every rejected-input case). The query is
the exact §24 shape: `model.findById(subjectId, { tokenVersion: 1,
accountStatus: 1 })` — confirmed by test inspecting the injected model's
recorded call arguments. No password, email, verification/reset secrets,
profile data, or refresh-token state is ever requested or returned.

### Exact User/Employer active/inactive status mapping

Repository truth, confirmed by direct inspection of
`server/src/models/User.js`/`Employer.js`: `accountStatus: { type: String,
enum: ['active', 'suspended'], default: 'active' }` — identical for both
models. **There is no `deleted` status in the current schema** — this is
stated honestly rather than fabricating a deleted-state test case; any
value outside the exact two-value enum (including a hypothetical future
`deleted`) falls through the same "unknown status" path, verified by test
across `'deleted'`, `'pending'`, `''`, `null`, `undefined`, and `42` — all
correctly resolve to `SUBJECT_STATE_INVALID`, never to active.

### Fail-closed result codes

- Missing subject → `SUBJECT_MISSING`.
- `accountStatus === 'suspended'` → `SUBJECT_INACTIVE`.
- Any other non-`'active'` value → `SUBJECT_STATE_INVALID` (fail closed).
- A malformed `tokenVersion` (fractional, negative, non-number, `NaN`,
  `Infinity`, missing) on an otherwise-active subject → `SUBJECT_STATE_INVALID`
  — verified by test across all of these values.
- Storage error → `STORAGE_FAILURE`, the raw error is discarded, never
  included in the result.
- Active, no `expectedTokenVersion` supplied → `SUBJECT_ACTIVE`, current
  `tokenVersion` included internally on the result (needed by later
  dormant services — not a leak, the equivalent of SEC-3B's `sid` return).
- Active, matching `expectedTokenVersion` → `SUBJECT_ACTIVE`.
- Active, mismatched `expectedTokenVersion` → `TOKEN_VERSION_MISMATCH`.

### No cache, no writes, zero staleness

Exactly one `findById` call per `getSubjectState` invocation — verified by
test. No cache, no Redis, no TTL, no process-local state of any kind: two
consecutive calls each perform their own fresh read (verified by call-count
assertion), and a status mutated directly in the underlying store between
two calls is observed immediately on the very next call with no stale
positive result (verified by test). The injected model doubles' `create`/
`findOneAndUpdate` methods were made to throw in one test specifically to
prove the provider never calls them — no write path exists in this module
at all.

## 8. Tests and assertion counts

| File                                  | Assertions | Focus                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `authCookiePolicy.test.js`            | 115        | Runtime-mode resolution/ambiguity, production/development config validation, exact cookie names/Paths/attributes, realm-isolation (no name or Path overlap), write/clear/extract input validation, duplicate-cookie rejection, max-length enforcement (4096/4097 boundary), full RFC 6265 cookie-octet rejection matrix (CR/LF/CRLF/NUL/tab/space/DQUOTE/comma/semicolon/backslash/non-ASCII) on both write and extraction, header-level CR/LF/NUL rejection, `abc=def=ghi` exact round-trip, no readable CSRF cookie |
| `trustedRequestOriginPolicy.test.js`  | 30         | Configured-origin normalization/rejection rules, exact-match trust, Origin/Referer precedence (no fallback on invalid/null Origin), evil-suffix and open-redirect-style rejection, comma-separated Origin rejection, API-surface assertion that no forced-preflight marker evaluator (or equivalent) is exposed, no raw values in safe results                                                                                                                                                                        |
| `sessionSubjectStateProvider.test.js` | 61         | Input validation before any model call, active/missing/suspended for both realms, unknown-status and malformed-tokenVersion fail-closed matrices, storage-failure normalization, exact minimal projection, one-read-per-call, no writes, no cache/zero staleness, explicit `expectedTokenVersion: 0` matching and mismatching coverage for both realms (SEC-3C.2A)                                                                                                                                                    |

**Total: 206 assertions, all passing** (up from 145 pre-SEC-3C.1: +47 net
in `authCookiePolicy.test.js` from the cookie-octet matrix, -2 net in
`trustedRequestOriginPolicy.test.js` from removing 4 marker assertions and
adding 2 API-surface assertions; +16 net in `sessionSubjectStateProvider.test.js`
under SEC-3C.2A — 8 assertions per realm × 2 realms proving
`expectedTokenVersion: 0` is enforced as a genuine value, never treated as
"no version supplied").

SEC-3B regression (unaffected, re-run to confirm): `refreshSessionSchema.test.js`
(63), `refreshTokenHash.test.js` (15), `jwtSessionProvider.test.js` (66),
`refreshSessionRotation.test.js` (59) — all pass unchanged, 203 assertions.

Existing, unrelated tests re-run: `auth.test.js`, `authRealm.test.js`,
`employerAuthRealmIsolation.test.js`, `emailVerification.test.js`,
`duplicateEmailUserIdIndexes.test.js` — all pass unchanged.

## 9. Complete safe test-sweep breakdown

`server/src/__tests__/*.test.js` now contains 49 files (46 existing +
3 new SEC-3C files). All 49 were executed individually via `node <file>`
and all 49 exited successfully. Of those 49: **48 execute and pass their
normal assertions**; **1** (`employerPortalIntegration.test.js`) is the
same pre-existing, genuinely live-MongoDB integration test from SEC-3B,
gated behind `EMPLOYER_INTEGRATION_TEST=1` (unset throughout this phase) —
it self-skips and is not presented as database-backed proof of anything
in this report.

## 10. Lint / Prettier / whitespace results

```text
npx eslint <every new file>                → clean, zero errors/warnings
npm run lint (full server/src scope)       → clean, zero errors/warnings
npx prettier --check <every new file>      → 8/8 pass (all newly authored
                                               this session — safe to format
                                               directly, no pre-existing-
                                               content risk, unlike
                                               User.js/Employer.js which
                                               were not touched at all in
                                               this phase)
git diff --check                           → clean; git status confirms
                                               zero tracked modifications
                                               (User.js/Employer.js
                                               untouched)
```

No client build was run — no file under `client/` or `mobile/` changed.

## 11. Dormancy proof and search results

```text
grep -rln "AuthCookiePolicy|TrustedRequestOriginPolicy|SessionSubjectStateProvider|AuthSessionPrimitiveContracts" \
  server/src/controllers server/src/routes server/src/middleware \
  server/src/index.js server/src/worker.js server/src/config \
  client/src mobile
→ (no matches)
```

No new module is imported by any authentication route, controller, or
middleware; not by the existing JWT helper or token store; not by server
or worker startup; not by `validateEnv.js` or `config/cors.js`; not by any
browser code (`AuthContext.jsx`, `EmployerAuthContext.jsx`, axios
interceptors, employer browser services), mobile code, OAuth code, or
publishing/B3-E code. The only references anywhere are the three new
focused test files and internal module-to-module imports within
`services/auth/` (`AuthCookiePolicy.js`/`TrustedRequestOriginPolicy.js`/
`SessionSubjectStateProvider.js` importing shared constants from
`AuthSessionPrimitiveContracts.js`, and that file importing the realm enum
from SEC-3B's `RefreshSessionContracts.js`).

**Confirmed unchanged**: no live cookie is written or read by any request;
no live Origin/Referer check runs on any route; no live subject-state
validation occurs; no `tokenVersion` reader or enforcement path exists;
current login/refresh/logout JSON response shapes are unchanged; current
browser `localStorage` behavior is unchanged; current environment
requirements are unchanged; `cookie-parser` was not added to
`server/package.json`. These current behaviors remain exactly as insecure
as documented in the accepted architecture report until the later atomic
cutover (SEC-3E) — this phase does not claim otherwise.

## 12. Remaining work for SEC-3D

Per §33 of the accepted architecture: SEC-3D builds the revocation and
account-state foundation (ensuring every admin suspend/delete/password-
change/reset/role-change path correctly bumps `tokenVersion`, and building
the logout-current/logout-all services) using SEC-3B's rotation
service and this phase's subject-state provider as building blocks — still
without any live route wiring. SEC-3E (the atomic cutover), SEC-3F (real
infrastructure acceptance), and SEC-3G (legacy removal) remain entirely
unstarted. The exact public HTTP error shapes named in §19 (`origin_validation_failed`)
are documented here for SEC-3E to consume verbatim, not implemented as
live middleware in this phase.

## 13. Explicit non-claims

**This phase makes no production-readiness claim.** Every module built
here is inert — unreferenced by any live path — and demonstrated only
against injected doubles, never a live Express response object, a live
cookie jar, or a live MongoDB connection. **This phase makes no 10/10
claim.** The current, live authentication system remains exactly as
insecure as documented in the accepted architecture report's findings
until SEC-3E activates the replacement. No live cookie, Origin check, or
subject-state validation was activated by this phase. This remains true
after the SEC-3C.1 correction below — the corrected modules are still
entirely dormant.

## 14. SEC-3C.1 correction record

### What the SEC-3C-A acceptance audit found

Read-only re-audit against this report and the checkpointed architecture
report found two genuine Medium findings, both accepted without dispute:

1. **Marker authority overreach.** §19 point 4 of the architecture report
   introduces the forced-preflight header only as a hedged, illustrative
   example ("e.g. `X-Strideto-Client: web`"), never as an adopted, exact
   contract — confirmed directly against the checkpointed document text,
   not inferred from this report's own prior (incorrect) characterization
   of it as authoritative. SEC-3C had implemented `evaluateForcedPreflightMarker`,
   the exact header/value, and three dedicated result codes as if the
   example were final.
2. **Cookie-value safety gap.** `isValidToken` accepted any non-empty,
   length-bounded string, including characters RFC 6265 forbids in a
   `cookie-octet` (CR, LF, semicolon, and others). A real Express
   `res.cookie()`/HTTP round-trip test confirmed Express's own default
   encoding neutralizes the practical injection risk today, but the
   audit's required behavior — explicit rejection at this module's own
   validation layer, not reliance on a downstream library default — was
   missing.

### What SEC-3C.1 changed

Exactly five files: `AuthSessionPrimitiveContracts.js`,
`AuthCookiePolicy.js`, `TrustedRequestOriginPolicy.js`,
`authCookiePolicy.test.js`, `trustedRequestOriginPolicy.test.js`, plus
this report. `SessionSubjectStateProvider.js` and its test were not
touched — the audit raised no finding against them. No new file was
created; no existing SEC-3C code was wired into any live route,
controller, middleware, startup path, CORS config, `validateEnv.js`,
browser code, or mobile code — the same dormancy guarantee as the
original SEC-3C phase, re-verified below (§9 note, §11).

- Marker evaluator, its dedicated result codes
  (`REQUEST_MARKER_MISSING`/`_INVALID`/`_VALID`-equivalent), its
  configuration, and its tests were removed entirely — not replaced with
  another header, a CSRF cookie, or a synchronizer token. §6 above and the
  in-code comments in `TrustedRequestOriginPolicy.js` document the
  deferral to SEC-3E explicitly.
- A shared RFC 6265 `cookie-octet` validator (`COOKIE_OCTET_PATTERN` in
  `AuthSessionPrimitiveContracts.js`) now gates both `writeRefreshCookie`
  and `extractRefreshToken`, detailed in §5 above. Express's default
  encoding is no longer relied upon as the safeguard — the write path uses
  an identity `encode` (round-trip fidelity for cookie-octet-safe
  characters like `=`), and the extraction path no longer calls
  `decodeURIComponent` (validates the literal wire bytes, closing a
  percent-encoded-bypass gap that decoding-before-validating would have
  left open).
- Assertion counts updated: §8's table and total reflected 190 passing
  assertions at the SEC-3C.1 checkpoint (up from 145), and the affected
  sections of §5/§6 were rewritten in place rather than left describing
  superseded behavior, per the correction task's explicit instruction not
  to leave a stale narrative alongside corrected code. §8's total was
  further updated to 206 by the SEC-3C.2A correction below (§15) — this
  figure (190) is the historical SEC-3C.1 checkpoint value, not the
  report's current total.

### What did not change

Cookie names, Paths, and all other cookie attributes (§5); the exact
Origin/Referer precedence and every existing Origin/Referer test (§6);
`SessionSubjectStateProvider.js` and its 45 tests (§7) — this file was
later given additional test-only coverage under SEC-3C.2A (§15), still
without any production-code change; the dormancy guarantee; the "no
production-readiness, no 10/10" stance (§13).

## 15. SEC-3C.2A correction record

The SEC-3C final acceptance re-audit found the implementation functionally
correct but identified two precision gaps, both non-blocking and both
outside SEC-3C.1's corrective scope:

1. `sessionSubjectStateProvider.test.js` had no explicit case proving
   `expectedTokenVersion: 0` is treated as a genuine, enforced value
   rather than as "no version supplied" (a risk specific to a truthy-check
   implementation mistake, which the production code does not actually
   make — `SessionSubjectStateProvider.js` already used `!== undefined`
   throughout, verified unchanged).
2. This report's cookie-attribute table did not state the `maxAgeMs`
   configuration field's unit (milliseconds) or that Express serializes
   the wire `Max-Age` attribute in seconds.

**What changed**: exactly `server/src/__tests__/sessionSubjectStateProvider.test.js`
and this report. No production module was modified — `SessionSubjectStateProvider.js`,
`AuthCookiePolicy.js`, `TrustedRequestOriginPolicy.js`, and
`AuthSessionPrimitiveContracts.js` are byte-identical to the SEC-3C.1
checkpoint state. No cookie, Origin, or subject-state behavior changed;
no dormant primitive was activated.

- Added 16 assertions (8 per realm × 2 realms) to
  `sessionSubjectStateProvider.test.js`: `expectedTokenVersion: 0` matching
  a stored `tokenVersion: 0` resolves `SUBJECT_ACTIVE` with the internal
  `tokenVersion` returned as exactly `0`, exactly one authoritative read,
  the exact minimal projection, no write (`create`/`findOneAndUpdate`
  rigged to throw), and no identifier leak; `expectedTokenVersion: 0`
  against a stored `tokenVersion: 1` resolves `TOKEN_VERSION_MISMATCH`
  with no `tokenVersion` field exposed and no write. File total: 45 → 61.
- Added the "Max-Age units" subsection under §5 (above), and clarified the
  cookie-attribute table's `Max-Age` row to point to it, documenting the
  `maxAgeMs`-milliseconds-in /`Max-Age`-seconds-out contract explicitly
  with the seven-day (`604800000` ms → `Max-Age=604800`) example.
- §8's table and total updated to 206 (115 + 30 + 61).

**What did not change**: every other assertion in
`sessionSubjectStateProvider.test.js` (the pre-existing 45); all cookie,
Origin, and subject-state production behavior; the dormancy guarantee;
the "no production-readiness, no 10/10" stance (§13); the marker
correction (§6, §14).
