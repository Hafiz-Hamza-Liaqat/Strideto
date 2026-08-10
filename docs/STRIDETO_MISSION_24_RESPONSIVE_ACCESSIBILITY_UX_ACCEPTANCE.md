# Strideto Mission 24 — Responsive, Accessibility, and UX Acceptance

## Acceptance statement

Mission 24 acceptance passed for the implemented browser surfaces and synthetic states listed below. The original cross-role suite executed 246 deterministic assertions, and the focused Institution Portal closure added 89/89 assertions, for 335 accepted browser assertions at representative mobile, tablet, and desktop sizes. No internet, live database, real account, provider, payment, email, AI, or Vault storage operation was used.

This is a WCAG-oriented product acceptance exercise, not an external audit and not a claim of WCAG 2.2 AA certification. Axe, a formal contrast analyzer, assistive-technology testing, complete RTL acceptance, and full text-zoom certification were not available in the installed local toolchain.

## Tooling and fixtures

- Browser runners: dependency-free Chrome DevTools Protocol harnesses in `scripts/verify-mission-24-ux.mjs` and `scripts/verify-institution-portal-ux.mjs`.
- Browser: locally installed headless Google Chrome, launched against the local Vite development server.
- Accessibility checks: executable DOM, landmark, heading, accessible-name, label, error-association, dialog-name, keyboard, focus, and status-text assertions. No accessibility package was installed or downloaded.
- Fixtures: request interception returned deterministic, role-specific synthetic JSON. External DNS was blocked. Long Unicode names, long organization/program labels, six currencies, empty queues, unknown costs, and provider-not-configured states were included.
- Evidence: eight compact screenshots in `docs/screenshots/responsive/`, including focused Institution mobile and desktop captures.

## Viewport matrix

| Class | Synthetic sizes |
| --- | --- |
| Mobile | 320 × 800; 375 × 812 |
| Tablet / compact desktop | 768 × 1024; 1024 × 768 |
| Desktop | 1440 × 900 |

Each size is an acceptance sample, not a device-specific guarantee. Page-level overflow was asserted as `document.documentElement.scrollWidth <= clientWidth + 2`; deliberate Admin table overflow remained inside a labeled scroll region.

## Route and role matrix

| Role | Executed representative routes and states |
| --- | --- |
| Public | `/`, `/tests`, `/program-explorer`, responsive mobile menu, `/definitely-not-a-real-route` |
| Student | `/auth/login`, `/dashboard`, `/profile`, `/personalization`, `/journey`, `/journey/tasks`, `/vault`, `/consultations`, `/cases`, `/trust-center`, `/copilot`, `/budget/m24-plan`, unauthorized Admin navigation |
| Employer | `/employer/login`, `/employer`, `/employer/jobs/new`, mobile role navigation |
| Agent / Agency | `/agent/login`, `/agent`, `/agent/services`, `/agent/consultations`, `/agent/cases`, `/agent/commerce` |
| Institution | `/institution/login`, `/institution`, `/institution/onboarding`, `/institution/profile`, `/institution/programs`, `/institution/programs/:programId/edit`, `/institution/data-quality`, `/institution/team`; user/employer/agent denial; loading, empty, error, and forbidden states |
| Admin | `/admin/sc/overview`, `/admin/sc/organizations`, `/admin/sc/trust`, `/admin/sc/data-quality`, `/admin/sc/commerce` on desktop and narrow screens |

## Findings

| ID | Severity | Surface | Acceptance evidence | Fix / status |
| --- | --- | --- | --- | --- |
| M24-01 | MAJOR | Global responsive layout | Global `overflow-x: hidden` could mask real layout defects; role shells and long action rows could exceed narrow widths. | Removed masking and fixed the actual shell, header, action, and wrapping constraints. Fixed. |
| M24-02 | MAJOR | Landmarks | Cases, localized layouts, and page-builder content could create nested `main` landmarks. | Kept one page-level `main`; inner content now uses neutral containers. Fixed. |
| M24-03 | MAJOR | Shared forms | Shared field errors were visible but not programmatically associated with inputs. | `FormField` now provides `aria-invalid`, `aria-describedby`, stable error IDs, and alert semantics. Fixed. |
| M24-04 | MAJOR | Menus and overlays | Mobile drawer focus restoration and representative modal naming/focus behavior were incomplete. | Added initial focus, Escape behavior through shared overlay handling, trigger restoration, and stable dialog title IDs. Fixed. |
| M24-05 | MAJOR | Vault | Document cards used nested/synthetic interaction semantics; upload/archive overlays and file controls were incomplete for keyboard and screen-reader use. | Split navigation and archive actions into semantic controls; hardened upload/archive dialogs, labels, focus, scrolling, and touch targets. Fixed. |
| M24-06 | MAJOR | Admin Control Center | Shared Admin filters, row renderers, action columns, and confirm-dialog props were incompatible with Mission 21 consumers, leaving filters/actions/reason content unavailable. | Restored both supported filter schemas, row callback contracts, action columns, dialog children/busy behavior, labeled scroll regions, and reason labels. Fixed. |
| M24-07 | MAJOR | Budget | Budget detail assumed universal two-decimal minor units, producing incorrect JPY/KWD display. | Reused the shared international Money formatter; zero-, two-, and three-decimal currencies remain distinct. Fixed. |
| M24-08 | MAJOR | Routing / 404 | An unconstrained `/:locale` route could consume unknown first-segment URLs and prevent a truthful 404. | Locale routes are generated only for enabled non-default content locales; wildcard 404 remains in the global shell. Fixed. |
| M24-09 | MAJOR | Realm authentication | Employer/Agent login labels, autocomplete semantics, mobile padding, and touch sizing were inconsistent. | Associated labels and IDs, added realm-appropriate autocomplete, and hardened narrow-screen controls. Fixed. |
| M24-10 | MINOR | Agent consultations | Status filtering lacked a robust accessible label and narrow touch sizing. | Added labeling, textual error/status semantics, and practical control sizing. Fixed. |
| M24-11 | MINOR | Copilot | Long evidence/source content and small muted text could wrap poorly or lose clarity on mobile. | Added safe wrapping, responsive context controls, touch sizing, and stronger muted-text contrast. Fixed. |
| M24-12 | MINOR | Newsletter / common forms | Newsletter email/frequency controls lacked complete label and autocomplete/touch behavior. | Added associated labels, translation keys, autocomplete, and mobile control sizing. Fixed. |
| M24-13 | INFO | Institution browser UX | The focused closure exercises the Institution-owned realm, dashboard, verification, profile, Programs, data quality, and team/settings surfaces in real local Chromium. | Closed with 89/89 browser assertions and the Mission 18 50/50 contract regression. |
| M24-14 | INFO | Formal accessibility / localization | No installed axe/contrast suite, assistive-technology lab, or complete RTL language surface was available. | Deferred to a formal audit and verified localization work; no certification claim made. |

Summary: 14 findings — 0 BLOCKER, 9 MAJOR, 3 MINOR, 2 INFO; 13 fixed/closed and 1 documented/deferred. Unresolved BLOCKER: 0. Unresolved MAJOR: 0.

## Shared-component fixes

- Shared form errors now expose field relationships and non-color alert semantics.
- Shared overlay logic retains the opening trigger and restores focus without resetting focus on every render.
- Shared Modal and Admin confirmation dialog expose accessible names and stable keyboard behavior.
- Shared Admin filters and tables support their established consumer contracts, accessible field labels, action reachability, and bounded table scrolling.
- Navigation drawer focus moves inside on open and returns to the trigger on Escape/close.
- Public wildcard and enabled-locale routing no longer confuse 404 behavior.

## Responsive and global shell acceptance

- Public, authenticated Student, Employer, Agent, Institution, and Admin shells remained within tested viewport bounds.
- Public and Employer mobile navigation opened and closed with keyboard operation; role navigation remained reachable.
- Agent layout gained a skip link, named navigation, a focusable main target, and practical mobile targets.
- Employer, Journey, Vault, Budget, Admin, and Case action groups wrap instead of forcing page-level overflow.
- Headers, content, footer, dialogs, and primary actions remained available at 320 px.

## Forms, keyboard, focus, and dialogs

- Student, Employer, and Agent login fields have accessible names and password/autocomplete semantics at 320 px.
- Empty Student login submission produced visible alerts, `aria-invalid`, and an associated error description without reporting success.
- Representative profile, search/filter, Copilot, Budget, Agent service/consultation, Institution profile/Program/data-quality/team, and Admin filter/reason fields were checked for accessible names.
- Tab-reachable controls, Enter/Space-native button semantics, Escape dismissal, dialog naming, focus movement, and focus restoration were exercised on representative navigation and overlays.
- Vault file input remains a native labeled input; no real upload was attempted.
- Busy/disabled props remain available on mutation/confirmation controls; no live mutation or double-submit was executed.

## Tables and dense Admin UI

- Admin tables remain semantic tables inside focusable, labeled horizontal-scroll regions.
- Search, select, and date filters render through both established Admin filter interfaces.
- Action buttons remain inside the table region at narrow widths.
- Commerce manual-review confirmation exposes an action-specific title and labeled reason field; Escape cancels it without mutation.
- Overview cards, organization names, correlation IDs, and commerce statuses wrap or scroll locally without overflowing the page shell.

## Role acceptance

### Student

- Dashboard/profile: mobile shells, primary headings, controls, labels, and overflow passed.
- Explorers and personalization: public Test/Program explorers and authenticated personalization route passed on mobile synthetic data.
- Journey: dashboard and tasks routes passed; action headers wrap.
- Vault: empty state, add action, upload dialog naming/focus/labels, close behavior, and mobile screenshot passed.
- Consultations/cases/trust: representative empty states and status text passed; no fake rows were added.
- Copilot: long Unicode evidence, source warnings, mobile containment, and truthful provider-not-configured response passed.
- Budget: JPY 123,456 and KWD 123.456 were asserted alongside unresolved multi-currency and unknown-cost warnings.

### Employer

- Dashboard, mobile navigation, and new-job workflow passed at 375 × 812 with labels and reachable actions.
- No Employer contract or service boundary was changed; the Employer Release Baseline remains preserved.

### Agent / Agency

- Dashboard passed at 768 × 1024; services, consultations, cases, and commerce passed at 320 × 800.
- Professional service/filter controls remain labeled and usable at narrow width.
- Payment readiness remains textual and truthful (`Payment ready: No` / provider not enabled); no Stripe action ran.
- No implicit Student Vault control appeared in the tested Agent portal.

### Institution

- User, Employer, and Agent realms were denied the Institution portal and received coherent Institution-specific sign-in UX.
- Dashboard, verification/onboarding, profile, Programs, Program editing, data quality, and team/settings passed at 320 px; dashboard containment also passed at 375, 768, 1024, and 1440 px widths.
- Long Unicode Institution and Program names wrapped safely; JPY retained its zero-decimal value and explicit ISO currency code.
- Completeness, organization verification, canonical claim, freshness, conflicts, and review states remained distinct and textual.
- Profile validation exposed a visible alert and `aria-invalid`; Program requirement and TestAcceptance controls were labeled, with protected country scope stated truthfully.
- Page load performed no freshness mutation. Empty, API error, forbidden-membership, and loading states remained understandable, and unsupported scholarships/invitations/commerce were not fabricated.
- No Student/Vault, Agent, Employer, payment, or Stripe controls appeared. Mission 18's isolated realm, authority, privacy, audit, and no-worker contracts also passed 50/50.

### Admin

- Super Control overview passed at 1440 × 900; organizations, trust, data quality, and commerce remained usable at 320 × 800.
- Tables, filters, high-impact reason dialog, textual commerce states, and page containment passed.
- Synthetic Admin fixtures contained only safe metadata. Private Vault content controls were neither exercised nor exposed.

## International-content resilience

- Unicode names, diacritics, apostrophes, non-Latin organization/program text, long emails, long country names, long evidence titles, and long correlation IDs were injected.
- USD, PKR, EUR, GBP, JPY, and KWD were represented without assuming `$` or universal two decimals.
- Mission 22 regressions revalidated date-only, UTC instant, IANA timezone, DST, and locale-aware display contracts at 60/60.
- Directly touched alignment uses architecture-consistent responsive/logical behavior where practical. Full RTL language acceptance remains deferred.

## Loading, empty, error, unauthorized, and not-configured states

- The harnesses waited for committed lazy-route/loading transitions and rejected blank, missing-heading, or permanently loading tested surfaces.
- Student cases, consultations, Vault, Budget plans, Agent cases/services/consultations, and Admin queues used truthful empty fixtures; no fake rows were inserted.
- Login validation error association, safe 404 navigation, and unauthorized Admin-to-login behavior were asserted.
- Copilot and Agent payment readiness stayed explicitly not configured/unavailable.
- Browser runtime exceptions, unintended writes-on-load, and uncontrolled request loops were tracked; final acceptance observed none.

## Executed verification

- Mission 24 browser/UX: **246/246 assertions passed** in real local Chromium.
- Focused Institution Portal browser/UX closure: **89/89 assertions passed** in real local Chromium.
- Combined accepted browser evidence: **335 assertions**.
- Focused Institution frontend lint: **0 errors, 5 Fast Refresh warnings**.
- Mission-touched frontend lint: **0 errors, 1 established Fast Refresh warning**.
- Repository-wide frontend lint: not green due to **22 errors and 57 warnings outside the Mission 24 change set**; no unrelated lint cleanup was undertaken.
- Mission 22 international hardening: **60/60 passed**.
- Mission 20 Budget Planner contracts: **56/56 passed**.
- Mission 18 Institution Portal contracts: **50/50 passed**.
- Frontend production build: **passed**, Vite 5.4.21, 1,157 modules transformed. Existing Browserslist age, mixed static/dynamic import, and chunk-size warnings were non-blocking.

## Screenshot evidence

- `mission-24-public-mobile-320.png`
- `mission-24-student-vault-mobile-320.png`
- `mission-24-copilot-mobile-320.png`
- `mission-24-agent-tablet-768.png`
- `mission-24-admin-desktop-1440.png`
- `mission-24-admin-mobile-320.png`
- `mission-18-institution-mobile-320.png`
- `mission-18-institution-desktop-1440.png`

## Residual and deferred items

- Run a formal accessibility audit with automated rules, manual contrast/zoom checks, screen readers, and switch/voice input across supported browsers before making a conformance claim.
- Complete verified Arabic/Urdu RTL language acceptance separately; Mission 24 checked only obvious directly touched blockers.
- Resolve repository-wide pre-existing lint debt and existing build optimization warnings in their appropriate maintenance/performance scope.

## Safety and preservation

No real account was created. No live service, database, provider, payment/refund/payout, email/SMS/push, AI provider, or Vault data/storage call was made. No worker, seed, backfill, migration, push, deployment, or canonical publication occurred. Employer Release Baseline, Missions 1–23, the worker, and protected historical audit documents were preserved.
