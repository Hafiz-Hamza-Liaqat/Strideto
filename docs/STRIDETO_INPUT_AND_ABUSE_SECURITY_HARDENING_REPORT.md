# STRIDETO-SEC-2 / SEC-2A — Input and Abuse Security Hardening Report

## 0. SEC-2A live integration addendum (read first)

SEC-2 left the CAPTCHA verification logic complete, correct, and fully
adversarially tested, but explicitly **not live**: `checkFormSpam()` had
become asynchronous (a real network round trip is unavoidable), and its one
call site, `server/src/controllers/formPublicController.js:35`
(`const spam = checkFormSpam(form, body);`, not `await`ed), was outside
SEC-2's authorized files. SEC-2A's sole job was to close that gap. It does:

- **`formPublicController.js:39`** now reads
  `const spam = await checkFormSpam(form, body);`. Verified, not assumed: the
  fix was temporarily reverted and the new integration suite (§19) was
  re-run against the un-awaited version — it failed immediately (a rejected
  verification incorrectly persisted a submission), then passed again once
  `await` was restored. This is direct, executed proof the regression
  protection has teeth, not just a plausible-looking assertion.
- **A second, real, pre-existing privacy gap was found and fixed in the same
  file while inspecting the persistence path** (§4/§10 of SEC-2 already
  flagged token privacy as a requirement to verify): `const values = {
...body}` copied the _entire_ request body — including `captchaToken`,
  `g-recaptcha-response`, and `cfTurnstileResponse` — into the object later
  stored verbatim in `FormSubmission.data` (a Mongoose `Mixed` field with no
  schema stripping). Nothing in the pre-SEC-2 or SEC-2 code ever removed
  these keys before persistence. Three `delete` statements were added
  immediately after `const values = { ...body };` to remove them before any
  validation, persistence, or notification step touches `values`. This is a
  minimal, directly-scoped correction within the one file SEC-2A authorized
  for controller changes, not new/unrelated work.
- The dynamic public-form submission path (`POST
/api/forms/:slug/submit` → `submitForm()`) is now the only place CAPTCHA
  enforcement is live. No other route uses `checkFormSpam`/CAPTCHA — see the
  accurate scope statement in §22.

## 1. Executive verdict

**READY TO COMMIT** the complete SEC-2 change set. Both halves are now
complete, correct, fully tested, and live: the spreadsheet formula-injection
fix (§11–§20) protects every export format branch, and the CAPTCHA
verification fix (§3–§10, activated per §0 above) is genuinely awaited on the
live public form submission endpoint, verified by both adversarial
service-level tests (zero network calls) and a real-controller integration
suite that proves persistence cannot occur while verification is pending and
fails if `await` is ever removed. See §2 for the exact repository preflight.

## 2. Repository state

Preflight (before any edit) matched the expected state exactly: HEAD
`7dd4253fbb95da4d823fe4c1e8ab8da13e9df5bb`, branch `main...origin/main [ahead
21]`, no tracked modification, no staged file, only the two expected
unrelated untracked reports present, no active Git operation. Confirmed via
`git status --short`, `git status -sb`, `git diff --check`, `git diff
--cached --name-status`, `git ls-files --others --exclude-standard`, and
`git log -22 --oneline` before any file was touched. Final state (post-work,
pre-commit) is reported in §24; nothing was staged or committed at any point.

## 3. Original CAPTCHA weakness

`server/src/services/formSpamService.js`'s `verifyCaptchaToken()` never
contacted a provider. For `recaptcha`/`turnstile` it only checked that the
corresponding secret env var was set and that the submitted token was a
non-empty string: `return Boolean(secret && token);`. Any attacker submitting
`captchaToken: "x"` bypassed the check entirely once an admin had configured
a secret for a form. This matches finding F3 in
`docs/STRIDETO_AUDIT_01_COMPLETE_PLATFORM_SECURITY_AUDIT.md`.

## 4. CAPTCHA caller graph

Reconstructed by repository-wide search for `captchaToken`, `captchaProvider`,
`recaptcha`, `turnstile`, `verifyCaptchaToken`, `checkFormSpam`:

- **Provider enum, the sole source of truth for supported providers**:
  `server/src/models/FormDefinition.js:53` —
  `captchaProvider: { type: String, enum: ['none', 'recaptcha', 'turnstile'], default: 'none' }`.
  No other provider name appears anywhere in the codebase.
- **Config surface**: `FormDefinition.js`'s `spamSettings` sub-schema —
  `honeypot`, `honeypotField`, `rateLimitPerHour`, `captchaProvider`,
  `captchaSiteKey` (client-facing site key only), `throttleSeconds`. **No
  hostname, action, or minimum-score field exists in this schema.**
- **Verification logic**: `server/src/services/formSpamService.js` —
  `verifyCaptchaToken(provider, token)`, called from `checkFormSpam(form,
body)`.
- **The only caller of `checkFormSpam`, anywhere in the repository**:
  `server/src/controllers/formPublicController.js`, inside `submitForm()`.
  At the time of this original SEC-2 analysis it was called synchronously
  (`const spam = checkFormSpam(form, body);`, no `await`) — this has since
  been corrected under SEC-2A; see §0 and §6.
- No other route, controller, or service references `captchaToken`,
  `captchaProvider`, or `verifyCaptchaToken`.
- No existing test file covered `formSpamService.js` before this task
  (`ls server/src/__tests__ | grep -i captcha` returned nothing).
- No production-environment validation (`server/src/config/validateEnv.js`)
  references CAPTCHA at all — a missing secret was already a silent,
  unenforced condition before this change, and remains one (fails closed by
  returning `false`/`NOT_CONFIGURED`, never fatal at startup).

## 5. Supported provider contract

Reconstructed strictly from `FormDefinition.js`'s enum — no provider was
added or invented:

| Provider    | Secret env var         | Verification endpoint (fixed, trusted, not caller-controlled) |
| ----------- | ---------------------- | ------------------------------------------------------------- |
| `recaptcha` | `RECAPTCHA_SECRET_KEY` | `https://www.google.com/recaptcha/api/siteverify`             |
| `turnstile` | `TURNSTILE_SECRET_KEY` | `https://challenges.cloudflare.com/turnstile/v0/siteverify`   |
| `none`      | —                      | No request; existing disabled behavior preserved exactly      |

Both endpoints are hardcoded in a `Object.freeze()`d map
(`CAPTCHA_PROVIDER_ENDPOINTS`) keyed only by the provider name; the provider
name itself is validated against `Object.prototype.hasOwnProperty.call(...)`
on that same fixed map before any request is built, so no request/config
value — including the provider string itself — can ever select an arbitrary
host. Request encoding: `application/x-www-form-urlencoded` via
`URLSearchParams`, fields `secret`, `response` (the token), and optionally
`remoteip` (bounded to 64 chars) — the standard siteverify contract for both
providers. Required response fields: `success` (strict boolean). Optional
fields honored when supplied: `hostname`, `action`, `score`. Timeout: 5000ms
via `AbortController`. Safe failure: every failure path returns `{ ok:
false, code: <bounded internal code> }` and never throws.

## 6. Server-side verification flow

`verifyCaptchaTokenDetailed(provider, token, options)`:

1. `provider` falsy or `'none'` → pass, no request (existing disabled
   behavior preserved exactly).
2. `provider` not a key of the fixed endpoint map → `PROVIDER_UNSUPPORTED`,
   no request.
3. `token` not a non-empty string, or longer than 4096 chars →
   `TOKEN_REQUIRED`, no request.
4. Server secret for that provider not configured → `NOT_CONFIGURED`, no
   request (fail closed, matching the pre-existing behavior for this case).
5. POST to the fixed endpoint with a 5s bounded timeout, `redirect: 'error'`
   (never follow a redirect to an untrusted host).
6. Network/abort error → `VERIFICATION_UNAVAILABLE` or
   `VERIFICATION_TIMEOUT`.
7. HTTP response not `ok` (2xx) → `VERIFICATION_UNAVAILABLE`.
8. Response body read with a bounded reader (§7) and JSON-parsed; parse
   failure, or a body that is not a strict plain object (not an array, not
   `null`, not a primitive) → `RESPONSE_INVALID`.
9. `data.success !== true` (strict boolean equality — a truthy non-boolean
   like the string `"true"` is rejected) → `VERIFICATION_REJECTED`.
10. Optional hostname/action/score checks (§8) → `VERIFICATION_REJECTED` on
    mismatch.
11. Otherwise → `{ ok: true, code: null }`.

`verifyCaptchaToken(provider, token, options)` is a boolean convenience
wrapper over the above. `checkFormSpam(form, body)` is unchanged in its
honeypot logic and public result shape; it now `await`s
`verifyCaptchaToken()` instead of calling it synchronously.

## 7. Timeout and network safety

- **Timeout**: `AbortController` + `setTimeout(5000ms)`, cleared in a
  `finally` block regardless of outcome.
- **Bounded response size**: `readBoundedJson()` reads at most 65536 bytes
  from the response body via the streaming reader (`response.body.getReader()`)
  when available, aborting and cancelling the stream if the running total
  exceeds the cap; falls back to a single bounded `.text()` read (also
  length-checked) when a streamable body isn't present. Never buffers an
  unbounded response.
- **No redirect following**: `redirect: 'error'` — a 3xx response causes
  `fetch` itself to reject (real Node behavior; verified by test), never
  silently followed to a different host.
- **No caller-controlled endpoint**: the endpoint is selected exclusively
  from the fixed, frozen provider map; `verifyCaptchaTokenDetailed`'s
  parameters are `(provider, token, options)` — there is no URL parameter
  anywhere in the function's signature (verified in the test suite via
  `Function.length`), and `options` never contributes to endpoint selection.
- **No new dependency**: implemented entirely with Node's built-in global
  `fetch`, `AbortController`, `URLSearchParams`, and `Buffer` (all available
  without import in the project's Node 24 runtime). No package.json or
  lockfile change.

## 8. Hostname/action/score handling

`FormDefinition.js`'s `spamSettings` schema does not currently define
hostname, action, or minimum-score fields — no caller in the repository
populates `options.expectedHostname`/`expectedAction`/`minScore` today. Per
this task's explicit instruction not to invent an unowned public API, these
checks are **implemented and fully tested** (§9) but **dormant**: when
`options` is omitted (as every current call is), hostname/action/score
validation is simply skipped, exactly as the disabled-provider path is
skipped when `provider === 'none'`. This makes the capability available,
correct, and ready the moment a future config surface adds those fields to
`spamSettings`, without requiring another change to the verification logic
itself.

## 9. CAPTCHA safe-error contract

```text
CAPTCHA_TOKEN_REQUIRED
CAPTCHA_PROVIDER_UNSUPPORTED
CAPTCHA_NOT_CONFIGURED
CAPTCHA_VERIFICATION_REJECTED
CAPTCHA_VERIFICATION_TIMEOUT
CAPTCHA_VERIFICATION_UNAVAILABLE
CAPTCHA_RESPONSE_INVALID
```

Exposed as `CAPTCHA_ERROR_CODES` (frozen) from `formSpamService.js` for
internal use and testing only. `checkFormSpam()`'s **public** result shape is
unchanged from before this correction — `{ blocked, silent?, reason?, score
}`, with `reason: 'captcha_failed'` on any CAPTCHA rejection regardless of
which internal code produced it. No internal code, provider endpoint,
provider error-codes array, secret name, secret value, raw response body, or
stack trace is ever placed on the object `submitForm()` (or any other
caller) receives.

## 10. CAPTCHA privacy

Verified by dedicated tests (§19): the token and the secret are never passed
to any `console.*` call anywhere in `formSpamService.js` (confirmed by a
static grep returning zero `console.` occurrences in the file, and by tests
that capture all three console methods during a rejected-verification and a
network-failure run and assert the captured output never contains the token,
the secret, or the provider's raw `error-codes` array). The function's
returned result object exposes only `{ ok, code }` — no `response`, `error`,
or `raw` field exists on it at all (asserted via `Object.keys(...)`
equality in the tests).

**Extended under SEC-2A to the live persistence path** (§0):
`formPublicController.js` now deletes `captchaToken`,
`g-recaptcha-response`, and `cfTurnstileResponse` from the submitted values
before they reach validation, `FormSubmission.create()`, notifications, or
analytics — verified end to end by the integration suite (§19), which
submits a real, uniquely-identifiable token, lets the submission persist
successfully, and then asserts the token is absent from the persisted
document's `data`, absent from the HTTP response, and absent from every
captured console call across the whole request. `console.log`/`warn`/`error`
are all captured and asserted clean for the entire `submitForm()` call, not
just the isolated verification function. These three names are the complete,
executable transport-field contract — they are exactly the fields
`checkFormSpam()` itself reads (`body.captchaToken ||
body['g-recaptcha-response'] || body.cfTurnstileResponse`); no additional or
unsupported alias was invented, and no client-side form-submission UI in
this codebase currently sends any of them yet (only the admin form-builder
configures which provider a form uses).

**Request-payload safety, verified under SEC-2B**: `formPublicController.js`
already followed the safe pattern (option A in the SEC-2B task's terms), not
the unsafe one — `const values = { ...body };` creates a fresh top-level
copy before the `delete` statements run, and the `delete`s only ever
operate on `values`, never on `body`/`req.body` directly. `req.body` is
therefore never mutated. This was not just inspected but proven: the
integration suite (§19) now snapshots `req.body` before the call and asserts
deep equality after, across five scenarios — CAPTCHA disabled, required and
successful, required and rejected, missing secret, and network failure — not
just the one general case the original SEC-2A suite covered. A dedicated
test also confirms nested caller-owned values (e.g. a `multi-checkbox`
field's array) are never aliased-then-mutated in place: the field-sanitization
loop always computes a new value (e.g. via `Array.prototype.map`, which
itself never mutates its source) and reassigns it onto `values`'s own key,
so the original array on the caller's `req.body` retains both its exact
object identity and its original contents after the request completes,
while the persisted submission still receives the correctly sanitized copy.
No source correction was required for this section — SEC-2B strengthened
test coverage to prove an already-correct property, rather than fixing a
defect.

## 11. Original spreadsheet weakness

`server/src/controllers/admin/exportController.js`'s `toCsv()` and the XLSX
path (`XLSX.utils.json_to_sheet`) serialized every field of every exported
row — including admin-visible but attacker-influenced content such as job
titles, contact-message bodies, and application fields — with no escaping of
leading `=`/`+`/`-`/`@` characters. An attacker-controlled value like
`=HYPERLINK("http://evil","x")` would execute as a formula the moment an
admin opened the exported file in Excel/Sheets/LibreOffice. This matches
finding F5 in `docs/STRIDETO_AUDIT_01_COMPLETE_PLATFORM_SECURITY_AUDIT.md`.

## 12. Export caller graph

`EXPORTERS` in `exportController.js` covers 19 resources
(`users`, `employers`, `jobs`, `scholarships`, `admissions`, `blogs`,
`companies`, `career-articles`, `internships`, `intl-scholarships`,
`universities`, `foreign-studies`, `contact-messages`, `institutions`,
`newsletter-subscribers`, `applications`, `payments`, `analytics`,
`content-insights`), all reached through the single `exportData` handler,
which branches on `req.query.format` into `xlsx`/`excel`, `pdf` (an
HTML-wrapped CSV, separately HTML-escaped), and the default CSV path. All
three branches were changed to consume one shared, neutralized row set
(§16–§17) rather than three independent (and previously unprotected) copies
of the raw data.

## 13. Formula-prefix threat model

Dangerous when they occur at the effective beginning of a string value:
`=`, `+`, `-`, `@`, and the raw control characters tab (`\t`), carriage
return (`\r`), and line feed (`\n`) — matching this task's explicit list.
"Effective beginning" accounts for leading ASCII space characters (`' '`),
which spreadsheet software ignores before formula-sniffing a cell — leading
spaces are stripped (repeatedly) before checking the first character; tab/CR/LF
are treated as dangerous in their own right if they are the literal first
character (not stripped/skipped), since a raw control character at the very
start of a text value is itself an edge case some spreadsheet/CSV parsers
handle unpredictably.

## 14. Neutralization policy

`neutralizeSpreadsheetValue()` (internal) / `neutralizeExportRows()`
(exported, used by the controller and directly by the test suite):

- Non-string primitives (`number`, `boolean`, `null`, `undefined`) and `Date`
  instances pass through completely unchanged, at any nesting depth.
- A string that already starts with a literal apostrophe (`'`) is treated as
  already forced to text and returned unchanged — this is what makes the
  function **idempotent**: neutralizing prepends exactly one apostrophe, and
  a string starting with one is recognized as already-safe on any subsequent
  pass.
- Otherwise, leading spaces are stripped for classification purposes only
  (the original string, spaces included, is what gets the prefix); if the
  resulting first character is one of the dangerous set, the value is
  neutralized by prepending a single `'` to the **original, unmodified**
  string — the industry-standard (OWASP-documented) "force text" convention
  spreadsheet applications recognize, chosen over stripping/deleting the
  leading character so the original content is fully preserved, just
  rendered inert.
- Plain arrays and plain objects (prototype exactly `Object.prototype` or
  `null` — not class instances) are walked recursively (own-enumerable keys
  only, `__proto__`/`constructor`/`prototype`-named keys skipped entirely,
  never assigned), bounded to 8 levels of depth to guarantee termination on
  any input including a hypothetical circular structure, without ever
  invoking a getter, method, or `toString()` on the source value. Any other
  object type (e.g. a Mongo `ObjectId` that wasn't already stringified) is
  returned as-is, not traversed.
- The function never mutates its input at any level — every plain
  object/array it touches is rebuilt fresh.

## 15. Numeric-string policy

A string starting with `+` or `-` is exempted from neutralization **only**
when the entire (space-trimmed) string matches
`/^[+-]?(\d+\.?\d*|\.\d+)$/` — a pure signed decimal numeric literal with
nothing else attached (e.g. `"-5"`, `"+5"`, `"-5.25"`). Anything else
starting with `+`/`-`, including `"-1+2"`, `"+1+2"`, `"+CMD"`, is
neutralized, because it is not distinguishable from a formula fragment.
`=` and `@` have no numeric exception — a leading `=` or `@` is never treated
as legitimate data. This matches the task's explicit requirement to avoid
corrupting genuine negative numeric strings while still blocking
`-1+2`/`+1+2`/`=SUM(...)`/`@SUM(...)`.

## 16. CSV integration

`toCsv()` itself is unchanged — its existing quote-doubling escaping
(`"${s.replace(/"/g, '""')}"`) is preserved exactly. What changed is that
`exportData()` now calls `toCsv(safeRows)` (neutralized) instead of
`toCsv(flatRows)` (raw) on every branch that reaches it — the CSV path, and
the PDF/HTML path, which reuses `toCsv()` internally. CSV quoting was never
relied upon as the control: quoting protects against comma/quote-character
misparsing, not against a spreadsheet application's formula-detection logic,
which looks at a cell's leading character regardless of whether the cell is
quoted. The neutralizing apostrophe is a plain, harmless character with no
CSV-syntax meaning, so it does not interact with or weaken the existing
quoting/escaping in any way (verified by test — see §19).

## 17. XLSX integration

`XLSX.utils.json_to_sheet(safeRows)` replaces
`XLSX.utils.json_to_sheet(flatRows)`. Verified directly against the real
`xlsx` package (§19): a neutralized cell is stored with type `t: 's'`
(string) and no `f` (formula) property, carrying the literal apostrophe
prefix as part of its stored value — never as an executable formula cell.
Genuine numeric columns in the same row remain type `t: 'n'` with their
exact numeric value, unaffected.

## 18. Source-mutation safety

`neutralizeExportRows()`/`neutralizeSpreadsheetValue()` build entirely new
row/array/object structures and never write to a property of an input value.
Verified by test: a snapshot of the input taken before calling the function
is deep-equal to the input after the call, including for a row containing a
nested object with a dangerous string field.

## 19. Adversarial tests

**CAPTCHA** (`server/src/__tests__/formSpamCaptchaVerificationSecurity.test.js`,
74 assertions, zero real network calls — `global.fetch` is fully mocked and
restored in a `finally` block): disabled provider (no request), falsy
provider, missing/blank/oversized token (no request in any case), missing
secret (no request), unsupported provider (no request), success for both
`recaptcha` and `turnstile` against the correct fixed endpoint, no
URL/endpoint parameter exists on the verification function at all,
`success: false`/missing `success` field/non-boolean truthy `success`
all rejected, malformed JSON, array body, string body, `null` body all
rejected as non-plain-object, HTTP 400 and HTTP 503 both rejected even with a
claimed-successful body, network failure, `AbortError` timeout, a simulated
redirect rejected via `redirect: 'error'` with the option verified as
actually sent, an oversized response body rejected via the bounded
streaming reader, hostname match/mismatch, action match/mismatch, score at
threshold/below threshold, token/secret/raw-response/raw-network-error never
logged, exactly-one-request-per-invocation, no request when disabled,
`checkFormSpam()` integration (honeypot short-circuit, disabled provider, a
genuinely rejected verification blocking the submission, a genuinely
successful verification allowing it through, no body mutation), and the
core regression check — a merely non-empty token (`'x'`) is no longer
sufficient on its own.

**Live controller integration** (SEC-2A, strengthened under SEC-2B,
`server/src/__tests__/formPublicCaptchaIntegrationSecurity.test.js`, 53
assertions, zero real network calls, no MongoDB connection): invokes the
real, exported `submitForm()` handler — `FormDefinition`/`FormSubmission`
are patched at the shared Mongoose-model-singleton boundary, `global.fetch`
at the network boundary. Covers: CAPTCHA disabled (no request, normal
persistence); required and successful (exactly one provider call,
persistence occurs, response shape unchanged); required and rejected (zero
persistence, safe 400 response, no raw provider detail in the response);
missing secret, network failure, timeout, and malformed response all fail
closed with zero persistence; unsupported provider fails closed with zero
network call; full privacy sweep across the _entire request_ (a
uniquely-identifiable token is absent from the persisted document, the HTTP
response, and every captured console call, while ordinary form content still
persists correctly); exactly-one-verification-per-attempt. **Request-body
non-mutation is checked independently in five separate scenarios** (disabled,
successful, rejected, missing secret, network failure) rather than only the
one general case SEC-2A originally covered, and a sixth dedicated test
confirms a nested caller-owned array (a `multi-checkbox` field) is never
aliased-then-mutated — object identity and contents are both asserted
unchanged on `req.body` after the request completes (§10). **Two dedicated
await-regression tests** use a manually-controlled deferred `fetch` Promise:
the handler is invoked and left pending, microtasks are flushed twice, and
persistence/response are asserted to be completely absent while verification
is still unresolved — only after the deferred Promise is explicitly resolved
(success or rejection) does the assertion allow the corresponding outcome.
This suite was directly executed against a temporarily un-awaited version of
the controller **twice** — once during SEC-2A and again, independently,
during SEC-2B after the additional assertions were added — and confirmed to
fail both times (a rejected verification incorrectly persisted a submission);
each time it was re-run and confirmed passing once `await` was restored, and
the source was left unmodified afterward.

**Spreadsheet formula injection**
(`server/src/__tests__/adminExportFormulaInjectionSecurity.test.js`, 77
assertions, no database, no file written inside the repository, no network):
every listed dangerous payload (`=SUM(...)`, `=HYPERLINK(...)`, `+CMD`,
`-1+2`, `@SUM(...)`, leading tab/CR/LF formulas, single and multiple leading
spaces before a formula) neutralized; every listed harmless value (ordinary
text, ordinary email, ordinary URL, negative/positive numeric strings,
zero, an already-neutralized value, Arabic/Chinese/emoji Unicode) left
unchanged; the `-1+2`/`+1+2`/`-1-2`/`+SUM(1,2)` family confirmed neutralized
despite starting with a sign character; real JS numbers (positive, negative,
zero), booleans, `null`, `undefined`, and `Date` instances confirmed
untouched; idempotency confirmed (no double-prefixing on a second pass); a
200,000-character malicious value neutralized in well under a second (no
ReDoS/pathological slowdown); source rows confirmed never mutated; every
column of a multi-field row confirmed independently neutralized while an
unrelated safe column and numeric column pass through untouched; a
`JSON.parse`-constructed `__proto__`-bearing object confirmed not to pollute
`Object.prototype` and confirmed the dangerous key is dropped rather than
copied, with a nested dangerous string still neutralized; nested array
elements independently neutralized; real CSV output verified
line-structurally balanced (quote-pair parity) with the neutralized value
present as quoted literal text and existing quote-escaping still intact,
including a payload containing embedded quotes; a real XLSX worksheet built
via the actual `xlsx` package verified to store the neutralized cell as
string-typed data with no `f` (formula) property, alongside a genuine
numeric cell in the same row kept as numeric-typed data; confirmed the
neutralization boundary itself performs zero console logging of exported
values.

## 20. Regression results

Exact, separately-verified counts (re-inventoried under SEC-2B directly from
`ls server/src/__tests__/*.test.js`, not assumed from an earlier baseline):

```text
Pre-existing suites discovered:  39  (everything already present at HEAD
                                       7dd4253 before SEC-2 began, including
                                       the SEC-1 checkpoint's own
                                       adminJobDuplicateBoundaryRegression.test.js)
Pre-existing suites executed:    38
Pre-existing suites passed:      38
Pre-existing suites skipped:      1  (employerPortalIntegration.test.js —
                                       requires a live MongoDB connection,
                                       correctly not run)
New SEC-2 / SEC-2A suites:        3  (formSpamCaptchaVerificationSecurity,
                                       adminExportFormulaInjectionSecurity,
                                       formPublicCaptchaIntegrationSecurity)
New SEC-2 / SEC-2A suites passed: 3
Total suites executed:           41  (38 + 3)
Total suites passed:             41
Total suites skipped:             1
Total failures:                   0
```

39 pre-existing and 38 executed-and-passed are not in tension: 39 is the
count of pre-existing files on disk, 38 is the subset of those that were
actually run (excluding the one that requires infrastructure this task must
not connect to). Every C1–C6 publishing suite, `auth.test.js`,
`canonicalJobWriteBoundary.test.js`, and all employer/security scripts are
included in the 38. No prior-passing assertion count changed. The three new
suites carry 74 (CAPTCHA service) + 77 (formula injection) + 53 (controller
integration, expanded under SEC-2B — see §10) = 204 assertions.

## 21. Lint/build/static verification

| Gate                                                     | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Server lint (`eslint src --ext js`)                      | 0 errors, 0 warnings                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Client lint (`eslint . --ext js,jsx --max-warnings 100`) | 0 errors, 52 warnings — unchanged baseline; no client file touched                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Client production build (`vite build`)                   | Succeeded, 0 errors                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Prettier — `formSpamService.js`                          | Pass (full-file — entirely new content)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Prettier — all three new test files                      | Pass (full-file) — re-checked under SEC-2B after `formPublicCaptchaIntegrationSecurity.test.js`'s new assertions were added and formatted; all three still pass                                                                                                                                                                                                                                                                                                                                                                            |
| Prettier — `exportController.js`                         | **Fails full-file check** — pre-existing condition, same pattern as `adminJobsController.js` in SEC-1/SEC-1A: a full `--write` was tested and found to reformat untouched pre-existing lines (the `EXPORTERS` map, unrelated `res.setHeader` calls, etc.), so it was reverted; only the new/changed lines were verified compliant in isolation, and the file was intentionally left with its pre-existing full-file formatting differences to avoid unrelated churn; unchanged and re-confirmed under SEC-2B (diff still exactly 96 lines) |
| Prettier — `formPublicController.js`                     | **Fails full-file check** — same accepted pre-existing pattern, independently re-verified under SEC-2A: a full `--write` was tested (64 insertions/16 deletions, reformatting `getPublicForm`/`uploadFormFieldFile`/unrelated lines) and reverted; the final diff is 10 insertions/1 deletion, limited to the `await` addition and the three `delete` statements, both confirmed Prettier-compliant in isolation; unchanged and re-confirmed under SEC-2B                                                                                  |
| `git diff --check`                                       | Clean (exit 0; only informational LF→CRLF notices)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Sensitive-value scan                                     | No hardcoded secret values in any changed file — only environment-variable _names_ (`RECAPTCHA_SECRET_KEY`, `TURNSTILE_SECRET_KEY`) appear as string literals                                                                                                                                                                                                                                                                                                                                                                              |
| Network-call scan                                        | Exactly one `fetch(` call site across the entire changeset, targeting only the fixed `endpoint` value drawn from the frozen provider map                                                                                                                                                                                                                                                                                                                                                                                                   |
| Logging scan                                             | Zero `console.*` calls in any changed source file                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Database-connection scan                                 | Zero `mongoose.connect()` calls anywhere in the three test suites; `mongoose.connection.readyState === 0` asserted at the top of each                                                                                                                                                                                                                                                                                                                                                                                                      |

## 22. Remaining limitations

The placeholder CAPTCHA weakness in the dynamic public-form submission path
is fixed. Other abuse-sensitive routes that do not currently use CAPTCHA
remain separate future security work. Specifically:

- **CAPTCHA is now live on exactly one route**: `POST
/api/forms/:slug/submit` (`submitForm()` in `formPublicController.js`),
  because that is the only caller of `checkFormSpam`/CAPTCHA anywhere in the
  repository (confirmed by the SEC-2 caller graph, §4, and unchanged by
  SEC-2A). Registration, login, password reset, contact, and other
  abuse-prone endpoints identified in `docs/STRIDETO_AUDIT_01_COMPLETE_PLATFORM_SECURITY_AUDIT.md`
  do not use this CAPTCHA path at all today and are unaffected by this
  correction — they remain their own, separate future security work with
  their own integration if CAPTCHA is ever added to them.
- Hostname/action/score CAPTCHA validation is implemented and tested but
  dormant, pending a future `spamSettings` schema addition (§8) — not
  claimed as active for any current form.
- CAPTCHA rate-limiting/lockout beyond the existing generic request-rate
  limiters was not in scope and was not touched.
- The spreadsheet fix protects `exportController.js` exclusively; no other
  CSV/XLSX/spreadsheet-producing code path was found in scope for this task
  and none was searched for beyond confirming `exportController.js` is the
  only file using `json_to_sheet`/`XLSX.write` for admin data export
  (`grep -rn "json_to_sheet\|XLSX.write" server/src` returns only this
  file).
- `xlsx@^0.18.5`'s own unresolved CVE (STRIDETO-AUDIT-01 finding, no npm fix
  exists) is unrelated to and unaffected by this correction — this task
  neutralizes attacker-controlled _content_, not the parsing library's own
  vulnerabilities, and no dependency change was made or attempted.

## 23. Security impact

```text
CAPTCHA placeholder behavior:
Removed.

Real server-side provider verification:
Live on the public form submission path.

Verification awaited before persistence:
Yes.

Required CAPTCHA failure behavior:
Fails closed.

Real external calls during tests:
None.
```

- **CAPTCHA**: the presence-only-token vulnerability is fully closed both at
  the code level and at the live endpoint (§0, §19) — a rejected, timed-out,
  malformed, network-failed, unsupported-provider, or missing-secret
  verification now provably blocks persistence and every downstream side
  effect on the one route that uses this path, proven by directly executing
  the regression test against a temporarily un-awaited version of the
  controller and confirming it fails.
- **Spreadsheet formula injection**: fully closed — `exportController.js`'s
  `exportData()` neutralizes every exported field on every format branch
  (CSV, XLSX, PDF/HTML) before serialization, with no code path bypassing
  the boundary.
- Neither change touched authentication, session/token handling, rate
  limiting, Redis, storage, SMTP, dependencies, or the dormant publishing
  subsystem.

## 24. Preservation statement

No real provider request was sent at any point — every CAPTCHA test mocks
`global.fetch` and restores it afterward; no test or implementation code
calls a real Google/Cloudflare/other host. No production data was read or
written — no MongoDB connection occurred in any test or in this work (server
lint/tests run standalone; no `npm run dev`/`start`/`seed*` was invoked). No
package.json or lockfile changed. No environment file (`.env`/`.env.*`) was
read, written, or had its schema changed — `validateEnv.js` was inspected
read-only and not modified. No authentication, refresh-token, or session
code was touched. No Redis, storage, or SMTP code was touched. No commit,
stage, push, or deployment occurred. B3-E remains paused; no publishing
adapter/transaction/runtime-activation work began.

## 25. Next safe phase

Both halves of SEC-2 are complete, live, tested, and ready to checkpoint as
one change set (§1). Per the accepted verdict: review and checkpoint the
complete SEC-2 change set, then proceed to STRIDETO-SEC-3 authentication and
session security work per the original P0 list.
