# STRIDETO PHASE 17C-VR FINAL RESIDUAL CLOSURE COMPLETE

Mode: implementation + focused engineering verification only.  
Phase 18: **NOT STARTED**. Certification: **NOT RUN**. Push: **NO**. Deployment: **NO**.

The next mandatory step is **USER MANUAL ACCEPTANCE**.

---

## Baseline

- Starting HEAD: `c6370d4238edc5acfa30278268ead3b491cacbab`
- Branch: `main`
- WIP isolation: path-scoped stash only (`git stash push` of the three known tracked WIP files). `git stash -u` was not used.
  - Isolated: `client/src/components/admin/AdminDataTable.jsx`, `AdminTableFilters.jsx`, `FormField.jsx`
  - Restored after commits (see Working tree)
  - Older stash left untouched: `wip: AdminTableFilters values wiring (pre-phase-10)`
- Protected untracked files left untracked and untouched:
  - `docker-compose.appenv-align.yml`
  - `docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md`
  - `docs/STRIDETO_AUDIT_01_COMPLETE_PLATFORM_SECURITY_AUDIT.md`
- Worker state: **STOPPED** (`edurozgaar-staging-worker-1` Exited (0), not started)

Permanent runtime safety observed: no `docker compose down`, no `-v`, no volume/system prune, no live payments/payouts/scraping/OAuth/AI/SMS, no real external email provider (Mailpit local SMTP only).

---

## Verify Email

**Root cause:** `/auth/verify-email` captured the token, then `useSecretQueryToken` immediately replaced the URL. That `searchParams` change re-ran the verify `useEffect`. Cleanup set `cancelled = true`, while `consumedRef` blocked a second request. The in-flight response was discarded, so the screen stayed on generic **Loading…** until a manual refresh. StrictMode double-invoke made the same hang deterministic in development.

**First-navigation behavior:** Token is captured once from the initial URL (router search, with `window.location.search` fallback). The verify request is not cancelled when the address bar is cleaned. The route is eagerly imported so Mailpit cold-load is not stuck on the lazy `Loading...` fallback. Bounded UI state is **Verifying…**, then a terminal success/error state. **Refresh requirement: NO.**

**Four-realm behavior:** One shared consume path (`consumeRealmVerificationToken`) for student, employer, agent, and institution. Realm is taken from the query/body and validated server-side. No cross-realm consume.

**Token lifecycle:** Hashed at rest, 30-minute TTL, single-use. Raw token is held in React state only, stripped with `history.replace`, never written to web storage, never logged. Success URL is `/auth/verify-email?verified=1` (plus `realm` for B2B). Replay returns `ALREADY_USED` without account enumeration.

**Resend:** Generic accepted payload, cooldown/rate-limit, four-realm, Mailpit in-process delivery when SMTP is configured. Resend form is available on first navigation (no-token, pending, invalid, used, or error). It does not require refresh.

Engineering proof (disposable identities, Mailpit):

| Realm | Register | Mailpit | First consume | Replay |
| --- | --- | --- | --- | --- |
| Student | 201 accepted | received | 200 success | 400 `ALREADY_USED` |
| Employer | 201 accepted | received, link includes `realm=employer` | 200 success | 400 `ALREADY_USED` |
| Agent | 201 accepted | received | 200 success | 400 `ALREADY_USED` |
| Institution | 201 accepted | received | 200 success | 400 `ALREADY_USED` |

---

## Phone

- Canonical component: `client/src/components/forms/PhoneInput.jsx`
- Country source: `shared/international/country.js` via `listPhoneCountries()`
- Dial-code source: `shared/international/callingCodes.js`
- E.164 behavior: local digits + selected ISO country → `formatPhoneE164` / `canonicalizeStoredPhone`
- Digits-only behavior: shared `normalizeNationalNumberInput`; `type="tel"` + `inputMode="numeric"`; letters cannot remain in the local control; leftover digits from `abc331xyz` are not treated as a valid number (national length floor + letter rejection)

Repository sweep counts:

| Class | Count | Notes |
| --- | ---: | --- |
| Canonical PhoneInput | 12 | Agent verification/onboarding/profile; Employer register/verification/settings; Institution verification/profile; Talent Profile; student institution apply; Resume builder; application contacts |
| Display-only | 2 | Admin verification queue; public institution detail |
| Server-only | n/a | Models + `canonicalizeStoredPhone` on employer register/profile, agent profile, institution official phone, verification dossier, admin institution catalog, resume personalInfo, application contacts |
| Plain editable fields fixed | 6 pages | Agent verification (primary USER defect), Employer verification, Employer settings, Talent Profile, ContactsPanel, ResumeForm |
| Explicit exceptions | 1 | Admin CMS footer `contact.phone` is a freeform site contact line, not a user telephone identity field |

Ignored non-phone uses: interview mode `phone`, copy that mentions “phone support”, etc.

Phone OTP/SMS/WhatsApp: **not built**. `phoneVerified` is not client-assignable. Verification dossier phone is contact evidence only.

---

## Theme

No additional shared CSS/theme commit was required. Phase 17C-V primitives remain in force:

- Representative pages: `/agent/availability`, `/institution/verification`, `/employer/interviews`, `/jobs`, `/scholarships`, `/admissions`, Talent Profile DOB
- Dark: calendar/time icon uses light/neutral `currentColor` (`--icon` on `.dark`)
- Light: calendar/time icon uses dark/neutral `currentColor`
- Duplicate indicator: native picker indicator is hidden on `.temporal-input`; one custom trigger remains
- `FormField.jsx` WIP was not edited

---

## Runtime

| Container | State |
| --- | --- |
| edurozgaar-staging-frontend-1 | healthy |
| edurozgaar-staging-api-a | healthy |
| edurozgaar-staging-api-b | healthy |
| edurozgaar-staging-mongodb-1 | healthy |
| edurozgaar-staging-redis-1 | healthy |
| edurozgaar-staging-mailpit-1 | healthy |
| edurozgaar-sec3f-local-caddy | running |
| edurozgaar-staging-worker-1 | **STOPPED** (Exited 0) |

- `GET /api/health` → **200** (SMTP configured; worker stopped; verification mail is in-process/Mailpit, not worker-queued)
- `GET /api/health/ready` → **200**
- Unexpected 5xx in focused smoke: **none**
- Volumes preserved (no `down`, no `-v`)

---

## Tests

| Suite | Result |
| --- | --- |
| phase17cvrVerifyEmail.test.js | 36 passed |
| phase17cvrPhoneContract.test.js | 51 passed |
| phase17crAuthUi.test.js | 57 passed |
| phase17cvInternationalInputs.test.js | 60 passed |
| phase17cvThemeNavPortals.test.js | 20 passed |
| phase17cIdentityClient.test.js | 18 passed |
| secureAuthClientContract.test.js | 63 passed |
| finalPreLaunchSharedFoundation.test.js | 21 passed |
| phase17cvrResidualAuthority.test.js | 15 passed |
| phase17crIdentity.test.js | 39 passed |
| phase17cIdentity.test.js | 58 passed |
| internationalFoundation.test.js | 13 passed |
| userSecureAuthFlows.test.js | 58 passed |
| employerSecureAuthFlows.test.js | 39 passed |
| agentSecureAuthFlows.test.js | 3 passed |
| institutionSecureAuthFlows.test.js | 2 passed |
| module graph (`scripts/verify-module-link-integrity.mjs`) | ok (1753 modules) |
| touched-file lint | 0 errors; 1 pre-existing `react-refresh/only-export-components` warning in `routes/index.jsx` |
| frontend production build | success |

---

## Browser Engineering Evidence

Cursor browser against `https://localhost:8443` returned `chrome-error://chromewebdata/` (local TLS certificate not trusted by the automation browser). Application TLS was **not** weakened.

| Viewport | Result |
| --- | --- |
| 320 | NOT PROVEN |
| 375 | NOT PROVEN |
| 768 | NOT PROVEN |
| 1024 | NOT PROVEN |
| 200% zoom | NOT PROVEN |
| 1440 | NOT PROVEN |

Source/contract tests for PhoneInput, SearchableSelect portal/flip, temporal icons, and verify-email first-navigation are **PROVEN**. Visual layout at those breakpoints remains **USER MANUAL ACCEPTANCE**.

---

## Actual Findings

**BLOCKER:** none remaining in this residual scope (pending USER visual confirmation of first-navigation and phone digits-only).

**P0:** none.

**P1:** none.

**P2:** none.

**MAJOR:** none.

**MINOR:**
- Cursor browser cannot trust the local Caddy certificate; responsive visual matrix is NOT PROVEN here.
- Health truthfully reports worker stopped / queued non-verification jobs. Verification email remains in-process Mailpit delivery.

**INFO:**
- Generic `/api/health` email note describes worker-queued mail. Sensitive verification/reset send in-process when SMTP/Mailpit is configured.
- Admin CMS footer phone remains a freeform contact string by exception.
- Interview mode value `phone` is not a telephone input.

---

## Unresolved

- USER must manually confirm: Mailpit link resolves without refresh; resend works; Agent verification phone rejects letters; full international country list; Employer/Agent/Institution phone inputs; calendar/time icons in Dark and Light; representative responsive layouts; no new blank/loading regression.
- Visual 320–1440 / 200% zoom matrix: NOT PROVEN in this environment.

---

## Commits

1. `46129901ac966c9b1ba12334230d03b1c71a421a` — `fix(identity): resolve first-navigation email verification lifecycle`
2. `29711fb4e3206c6a9d430656ab97c26fc738bd4c` — `fix(forms): enforce canonical international phone inputs`
3. `docs(release): record phase 17c-vr residual closure` — this document (HEAD after this commit)

No theme/UI third code commit: Phase 17C-V shared date/time and portal primitives already covered VR-3/VR-4.

## Current HEAD

See `git log -1` after this docs commit. The working tree must show only known WIP and protected locals.

---

## Push / Deployment / Phase 18

- Push: **NO**
- Deployment: **NO**
- Phase 18: **NOT STARTED**
- Certification: **NOT RUN**
