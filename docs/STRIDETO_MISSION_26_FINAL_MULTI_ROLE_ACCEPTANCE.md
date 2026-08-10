# Strideto — Mission 26: Final Multi-Role Acceptance

Status: **ACCEPTED (product architecture)** — with real verified launch data still
outstanding as a Mission 27 launch prerequisite.

Baseline at start: `15aedb0` (Mission 25 controlled verified-data launch).

Mission 26 is an acceptance mission. It does not add product scope. It proves
that the accepted realms, engines, privacy boundaries, trust boundaries and
cross-role handoffs behave as **one product**, and it fixes only the concrete
integration defects that acceptance surfaced.

---

## 1. Acceptance methodology

A capability is accepted here only when all of the following hold:

- the route/API is reachable under the correct realm and refused under every other realm;
- truthful states render (loading, empty, forbidden, error, provider-not-configured);
- privacy holds — a surface never renders another domain's private records;
- important actions are server-authorized, not merely confirmed in the UI;
- cross-role handoffs preserve ownership and authority;
- no fake success and no fabricated data;
- no live provider, database, worker, account or network is required.

The existence of a model, service or page file is never treated as acceptance.

Two evidence classes were used, and both actually executed:

1. **Executable suites** — the curated acceptance pack (Section 2), including a
   new cross-role integration suite that exercises the real middleware, real
   route wiring, the real Vault policy, the real grounding validator, the real
   launch gate and the real Money/Budget/Commerce contracts.
2. **Browser acceptance** — three local Chromium/CDP harnesses driving the real
   client against intercepted synthetic fixtures.

Reused rather than rebuilt: Mission 24's responsive/accessibility sweep, the
Mission 18/24 Institution portal closure, and every mission suite that already
proves its own invariant.

---

## 2. Executed suites

One command runs the whole curated pack:

```bash
node scripts/verify-mission-26-final-acceptance.mjs
```

Final run: **42 commands, 42 passed, 0 failed, 0 not run.**

| Group | Commands | Covers |
| --- | --- | --- |
| auth | 7 | cross-realm matrix, realm path rules, secure access authorization, coordinator, session-family revocation, cookie policy, user auth flows |
| student | 7 | Universal Student Profile, education intelligence, scholarship/program intelligence, TestAcceptance explorer, Mission 8 eligibility + matching, Journey planner, Vault |
| employer | 4 | employer realm isolation, portal integration, application authorization, secure auth flows |
| agent | 4 | Agent/Agency portal, marketplace, consultations + contextual messaging, case management |
| institution | 3 | Institution portal, organization verification foundation, source verification + freshness |
| admin | 2 | Super-Control Center, export formula-injection safety |
| trust | 4 | Mission 15 professional trust, opportunity trust remediation, Mission 23 security/abuse audit, access denylist |
| commerce | 2 | Mission 16 commerce foundation, Mission 17 marketplace payments |
| ai / budget | 2 | evidence-grounded Copilot, Budget cost planner |
| international / data | 4 | international foundation, Mission 22 hardening, Mission 25 verified-data pipeline, verified-data dry run |
| browser | 3 | Institution UX closure (89), Mission 24 responsive/accessibility (335), Mission 26 cross-role (286) |

New in Mission 26:

- `server/src/__tests__/mission26FinalMultiRoleAcceptance.test.js` — **255 cross-role checks**
- `scripts/verify-mission-26-cross-role-ux.mjs` — **286 browser assertions**
- `scripts/verify-mission-26-final-acceptance.mjs` — the orchestrator

Total executed for Mission 26 specifically: **541 new checks**, on top of the
424 reused browser assertions and the 39 reused mission suites.

The orchestrator fails fast per command, prints the tail of any failing output,
lists every command it did **not** run with the reason, and exits non-zero on
any failure. Nothing is skipped silently.

---

## 3. Acceptance environment

- **Test runtime**: Node v24 (`node <file>.test.js`; no test framework, no DB driver connection)
- **Browser**: locally installed Chromium/Edge, headless, driven over CDP; no browser tooling was downloaded
- **Client**: local Vite dev server (ports 5173 / 5175 / 5176 per harness)
- **Fixtures**: every `/api/*` request intercepted via `Fetch.requestPaused` and fulfilled from in-script synthetic records; fixture records carry a visible `(fixture)` marker
- **Network**: `--host-resolver-rules=MAP * 0.0.0.0` blackholes external DNS; the harness additionally asserts that zero non-loopback requests were attempted
- **Live services**: none. No database connection, no worker, no email, no Stripe, no AI provider, no real account, no real payment, no real Vault file.

---

## 4. Cross-realm authorization matrix

Executed against the real `middleware/auth.js` and `middleware/rbac.js` guards
using the exact principal shapes `attachSecurePrincipal` produces:

| Guard | User | Employer | Agent | Institution | Anonymous | Moderator/Admin/SuperAdmin |
| --- | --- | --- | --- | --- | --- | --- |
| `requireUserAuth` | allow | **403** | deny | deny | deny | (user realm) |
| `requireEmployerAuth` | deny | allow | deny | deny | deny | **deny** |
| `requireAgentAuth` | deny | deny | allow | deny | deny | **deny** |
| `requireInstitutionAuth` | deny | deny | deny | allow | deny | **deny** |
| `requireAdmin` | 403 | — | — | — | — | Moderator 403 / Admin allow / SuperAdmin allow |
| `requireSuperAdmin` | — | — | — | — | — | Moderator deny / Admin **deny** |

Additionally proven by route wiring (real routers imported, `router.stack`
inspected): every Vault, Budget, Copilot, Journey, personalization,
Institution-portal, Employer and Agent route carries its realm guard; the realm
guard always runs after authentication; Student-realm routers mount no
foreign-realm guard; the Institution portal mounts no Student guard and exposes
no Vault route; public-by-design routes are authentication endpoints or
read-only public projections.

In the browser, each portal was first loaded by its **owning** realm (allowed),
then by every **foreign** realm — 4 portals × 4 foreign realms — and each denial
settled into a realm-coherent sign-in or permission state with no private data
rendered.

---

## 5. Public experience

- Landing renders at 320 / 375 / 768 / 1024 / 1440 with one `main`, an `h1`, no horizontal overflow, and no unnamed control.
- Test discovery, Program discovery and Scholarship discovery were exercised with **zero verified records** (the truthful Mission 25 state) and each rendered a truthful empty state — no fabricated ranking, no "top/best/#1" language, no invented counts.
- The public Agent marketplace renders only the approved fixture post, labels the Agent statement as an Agent statement, and carries no guarantee semantics.
- A 500 from the education directory renders a readable error state — not a blank page and not a stack trace.
- No public surface rendered any Student private value.

---

## 6. Student realm

Accepted through browser and suite evidence: authentication, dashboard, Journey
(next best action, tasks, deadlines, saved opportunities), Vault, consultations,
cases, trust centre, Copilot, Budget, and the Mission 8 eligibility/matching
engines.

Student decision chain (executed deterministically):

```
profile → eligibility criteria → overall eligibility state
        → match score + component breakdown
        → deadline urgency
        → next best action (with a human-readable reason)
```

- An unknown criterion never resolves to "eligible".
- A hard-failed criterion produces `not_eligible`.
- Eligibility results are frozen, server-derived objects.
- A destination mismatch lowers the match score deterministically.
- A passed deadline is reported overdue, never hidden.
- The Journey planner emits no guarantee semantics.

Ownership: Vault, Budget, Copilot and Journey routes are Student-realm only; the
Vault policy denies a second Student outright (`no_grant`).

---

## 7. Vault grant chain

Executed against the real `vaultAccessPolicy.canAccessDocument` with an
in-process stubbed grant lookup and synthetic documents (no file was uploaded or
read):

| Actor / grant | Outcome |
| --- | --- |
| owner | allowed (`owner`) |
| another Student | denied (`no_grant`) |
| Agent, relationship only, no grant | **denied (`no_grant`)** |
| Agent with exact active grant | allowed (`grant`) |
| revoked grant | denied |
| expired grant | denied (`grant_expired`) |
| grant for a different document | denied (`grant_document_mismatch`) |
| another organization's grant | denied (`grantee_mismatch`) |
| view grant used for download | denied (`insufficient_permission`) |
| Institution actor | denied |
| normal Admin/system context | denied |
| deleted document, even for the owner | denied (`document_deleted`) |
| non-owner write | 403 by strict ownership assertion |

A case transfer carries `vaultGrantsTransferred: false` and
`privateNotesTransferred: false` — a new Agent inherits neither.

---

## 8. Employer realm

Employer Release Baseline preserved; no Employer redesign. Accepted:
authentication, tenant scope, dashboard, job list/workflow, billing state,
settings, international content.

Isolation proven: Student, Agent and Institution tokens are refused by the
Employer guard; the Employer token is refused by the Student, Agent,
Institution and staff guards; the Employer browser surface renders no Student
Vault/Budget/Copilot value and no Agent case management.

---

## 9. Agent / Agency realm

Accepted: auth isolation, organization membership, dashboard, services,
marketplace, consultations, cases, trust, commerce readiness.

- The Agent consultation view shows the scoped interaction and does **not** expose arbitrary Student identity.
- Agent commerce reports Stripe Connect readiness truthfully: provider KYC `not_started`, charges/transfers `inactive`, payment ready **No**, payouts not enabled, with the required action listed. No payment secret is projected.
- An approved organization gains no Vault access, no Student browsing, and no payment capability.

Student → Agent handoff (same synthetic interaction seen from both sides):
approved marketplace item → Student interest → consultation (confirmed, with an
explicit timezone) → case with an open Student approval request → Vault access
only where an exact grant exists → review eligibility derived server-side.

---

## 10. Consultation and case chain

- Consultation states, timezone identity and the separation of payment lifecycle from consultation lifecycle are proven by the Mission 13 suite; the browser confirms the state and timezone are rendered textually on both the Student and Agent sides.
- External submission requires a recorded Student approval (`Student approval is required before recording external submission`).
- Case closure and transfer require Student approval; a transfer must match the exact membership the Student approved.
- Only the Student can decide a Student approval request — the Agent cannot self-approve.
- A Student reading a case sees shared notes only; private Agent notes stay private, and the Student browser view renders none.

---

## 11. Trust, reviews, reports and disputes

- Public reviews are projected as verified interactions with a pseudonymous Student identity.
- Reporter identity is a `select:false` field, readable only through an explicit privileged projection — never in the public or Student projection.
- Moderation resolution requires Admin authority; a Moderator cannot resolve.
- Neither party can unilaterally resolve a professional dispute.
- Opening a professional dispute triggers no refund: operational dispute and financial dispute stay distinct.
- Guarantee language and visa/admission certainty claims are blocked server-side.

---

## 12. Institution realm

The accepted Institution frontend (89/89) was reused, not rebuilt, and passes at
the Mission 26 source state.

Authority ladder proven:

```
profile completeness  ≠  verification
verification          ≠  canonical claim ownership
canonical claim       ≠  unrestricted global education authority
```

- Only an approved claim grants canonical authority; every other claim state grants none, and a draft claim cannot jump to approved.
- A viewer team role can neither submit official changes nor manage the team.
- High-impact fields are enumerated so changes route through review; a conflict state exists so an Institution change never silently overwrites canonical truth.
- Institution submissions are attributed `institution_official`, distinct from canonical fact.
- Country-level TestAcceptance is separately scoped and remains protected from an institution-scope claim; the public acceptance projection leaks no Institution account identity.
- The Institution portal grants **zero** automatic Student or Vault access — proven by route wiring and in the browser.

Institution → public data flow remains: official draft → provenance → review /
conflict state → canonical publication state → public projection. No live
publication was performed and no real Institution data was used.

---

## 13. Admin realm

- Overview, trust centre, commerce centre and data-quality centre were exercised in the browser at 1440 and 1024 widths.
- Moderator / Admin / SuperAdmin separation is enforced by the real guards: a Moderator cannot execute SuperAdmin authority, and staff without a specific permission are refused a permission-gated action.
- No Admin surface renders Vault content, Copilot conversation content, Student Budget detail, private Agent notes or reporter identity. No Vault, Copilot or Budget router mounts an Admin/staff guard at all — Admin is not a universal privacy bypass.
- Admin commerce surfaces a reconciliation mismatch and projects no raw payment/KYC secret.
- Frontend confirmation never replaces server authorization; high-risk actions require actor + permission + target + reason + audit.
- No impersonation exists or was exercised.

---

## 14. Commerce and payments

- Money is an integer minor-unit + currency pair; a floating-point amount is rejected; adding across currencies throws rather than silently converting.
- Zero-decimal (JPY), two-decimal (USD) and three-decimal (KWD) currencies round-trip exactly.
- Order, transaction and ledger keep distinct vocabularies. A transaction is never "paid" by fiat — paid is an order-level truth derived from provider events.
- The ledger corrects by compensating reversal; there is no escrow category.
- Refunds and payouts are modelled as provider-authoritative states.
- Pricing is derived server-side from the product record; a client-supplied amount never reaches the pricing snapshot.

Stripe Connect, in synthetic provider mode only (no Stripe network):

| Environment | Reported state |
| --- | --- |
| nothing configured | `not_configured` |
| test mode, both secrets | `test_ready` |
| live mode without the explicit live-enable flag | `not_configured` (fails closed) |
| missing secret key | `not_configured` |
| missing webhook secret | `not_configured` — no unverifiable events |

Raw-body signature boundary, invalid-signature rejection, event idempotency,
duplicate-success ledger safety and reconciliation on amount/currency mismatch
are proven by the Mission 17 focused regression, which is part of the pack.

---

## 15. AI (Copilot)

- Citations are validated against the evidence packet: a fabricated citation id is dropped and raises a citation violation; an uncited answer is not falsely flagged.
- Guarantee language and visa/admission certainty claims are blocked regardless of prompt wording.
- Injection patterns inside retrieved evidence are flagged; injected content cannot override system policy.
- Freshness warnings propagate from evidence to the answer.
- The Copilot router exposes no route that mutates Vault, applications, payments or eligibility — AI explains deterministic results, it does not produce them.
- In the browser, with no provider configured, the Copilot renders a truthful not-configured state **and still presents the server-derived evidence packet** rather than inventing an answer.

---

## 16. Budget

- Known / estimated / unknown are distinct: an unknown cost is counted as unknown and contributes nothing to any currency total — never coerced to zero.
- Multi-currency plans resolve to `MULTI_CURRENCY_UNRESOLVED`; there is no implicit FX.
- An outstanding unknown cost blocks an affordability verdict, and the explanation names the unknown costs.
- No stated Student budget yields "insufficient information", not a false verdict.
- The Budget service imports no Commerce order/transaction/ledger model and invokes no payment service: **a CostPlan causes zero Commerce mutation.**
- The Budget browser surface is Student-private; no Admin router reads it.

---

## 17. Verified-data readiness

**Real verified launch pack records = 0.** This is the accepted, truthful
Mission 25 state and Mission 26 does not convert it into a launch claim.

Proven in this mission:

- the shipped manifest contains zero records and states its data-acquisition blocker truthfully;
- the manifest is not pre-approved for application, and declares no production environment intent;
- `assertApplyAllowed` refuses every path tried: no explicit flag, no declared environment, a production environment, an unapproved batch, and a non-Admin actor even with every other safeguard satisfied;
- an undeclared launch environment fails closed;
- provenance origins `synthetic`, `demo`, `fixture`, `seed` and `generated` are **not launchable** — synthetic data cannot become verified;
- a demo authority type cannot back a verified record, and placeholder authority tokens are rejected;
- the dry run executes and mutates nothing;
- the public UX handles zero verified records with truthful empty states.

---

## 18. Privacy matrix

| Domain | Rule | Verified by |
| --- | --- | --- |
| Student profile | private to the Student | realm guards, route wiring |
| Vault | exact grant only | policy chain (Section 7) |
| Messages | context participants only | Mission 13 suite, browser scope check |
| Cases | scoped participants | Mission 14 suite, browser |
| Agent private notes | Agent-side only (`visibility: 'shared'` filter for the Student) | source contract + browser |
| Reporter identity | protected (`select:false`) | trust service contract |
| Copilot conversations | Student private, no Admin guard | route source |
| Budget | Student private, no Admin guard | route source |
| Payment secrets | never projected | Agent + Admin browser surfaces |
| Admin | not a universal privacy bypass | Vault/Copilot/Budget routers carry no staff guard |

A page may truthfully *mention* the Vault (the Institution sign-in page states it
grants no Vault access); the acceptance asserts that no surface renders another
domain's private **values**.

---

## 19. International behaviour

Currencies exercised: PKR, USD, GBP, EUR, JPY, KWD — each formats and
round-trips through decimal without float drift, with correct exponents
(JPY zero-decimal, KWD three-decimal).

Countries/zones exercised: PK, US, GB, CA, DE, AE, JP — a late-evening UTC
instant renders on different calendar days in Tokyo and New York, and an
unparseable date renders a truthful placeholder rather than `Invalid Date`.

Unicode institution and programme names (Latin-accented, CJK, Arabic) render
and wrap without corruption or overflow. Mission 22 was reused, not rerun in
full; no shared international contract changed.

---

## 20. Responsive / accessibility sampling

Mission 24 is accepted and was **reused**. Because Mission 26 changed a shared
client file (`src/routes/index.jsx`), the full Mission 24 browser group
(335 assertions) and the Institution closure (89 assertions) were rerun at the
final source state — both pass.

Mission 26 additionally sampled cross-role routes at 320×800, 375×812,
768×1024, 1024×768 and 1440×900: public landing at all five, Student surfaces at
320, Employer at 375, Agent at 768 and 320, Institution at 375, Admin at 1440
and 1024. Each sampled route was checked for a single `main` landmark, a
primary heading, no horizontal overflow, no unnamed interactive control, no
blank render and no rendered stack trace.

Screenshots (3, deliberately minimal):
`docs/screenshots/responsive/mission-26-student-mobile-320.png`,
`mission-26-agent-mobile-320.png`, `mission-26-admin-desktop-1440.png`.

---

## 21. Error, empty, loading and not-configured states

Exercised across roles: a slow response renders a visible loading state and then
resolves to real content; empty Vault and empty education discovery render
truthful empty states; a foreign realm renders a coherent denial; a 500 renders a
readable error; an unconfigured AI provider and an unconfigured payment provider
both report themselves truthfully. No blank page, no fake success, no raw stack
trace, no uncaught runtime error, no uncontrolled request loop, and zero
non-loopback requests across the whole browser matrix.

---

## 22. Findings and fixes

| # | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| 1 | MAJOR | `client/src/auth/authRealm.js` imported `./agentAuthRealm` and `./institutionAuthRealm` without a file extension. Vite resolves this; Node ESM does not — so the accepted `authRealm.test.js` realm regression could not run at all. | **Fixed**: explicit `.js` extensions. The suite runs and passes. |
| 2 | MAJOR | No route-level error boundary. `useRoutes` is not a data router, so React Router's `errorElement` never runs; one render exception unmounted the whole tree and every subsequent route rendered a blank page until a full reload. | **Fixed**: `RouteErrorBoundary` wraps every page through the shared `lazyLoad` helper, rendering a truthful "this page could not be displayed" state that states nothing was changed or submitted, and never prints a stack trace. One shared fix for the shared cause. |
| 3 | MAJOR | `JourneyDashboard` called `.replace` directly on `app.status` and `s.entityType`; a record missing either field threw during render (and, before fix #2, blanked the app). | **Fixed**: both reads fall back to a truthful label. |
| 4 | MAJOR | The prompt-injection heuristic did not match the canonical `"ignore all previous instructions"` — the qualifier order defeated the pattern. | **Fixed**: a single pattern that tolerates stacked qualifiers for ignore/disregard/forget + instructions. |
| 5 | MINOR | The guarantee policy matched adjective forms (`guaranteed admission`) but not the verb form (`we guarantee your admission`). | **Fixed**: an additional verb-form pattern covering admission, visa, scholarship, job, employment and acceptance. |
| 6 | INFO | Two browser harnesses running back-to-back failed on a stale Vite optimized-dependency cache, not on a product defect. | **Handled in the orchestrator**: the cache is cleared once before the browser group and the harnesses run in a stable order. No product change. |
| 7 | INFO | The Vault list loading state is a visual skeleton with no `role="status"` / `aria-busy`. | **Deferred to Mission 27** (accessibility polish; the loading state is visible and truthful, and Mission 24 remains accepted). |

Unresolved BLOCKER: **0**. Unresolved security/privacy P0/P1: **0**.

Every source change maps to a finding above. No engine was redesigned, no
product category added, no provider created, no data seeded.

---

## 23. Build

`npm run build` (client production build) was run **once** at the final source
state after the last client change: **built successfully in 6.70s**. The
pre-existing chunk-size advisory for `vendor-pdf` / `BlockConfigFields` is
unchanged by Mission 26 and is not a regression.

---

## 24. Explicit no-live-operation statement

Mission 26 performed **no** live operation of any kind:

- no external network request (blackholed DNS, asserted zero non-loopback requests)
- no database connection or mutation, canonical, staging or production
- no worker, no queue, no scheduled job
- no email, SMS or push
- no Stripe or any payment provider call; no payment, refund or payout
- no AI provider call
- no real account creation, verification decision or canonical publication
- no real Vault document read or write
- no Docker operation, no migration, no deployment, no push

---

## 25. Mission 27 boundary and launch prerequisites

Mission 26 accepts the **product architecture**. It does **not** authorize a
production push, a deployment, provider activation, verified-data acquisition,
real Stripe, real AI, a worker, real email, or real Institution publication.

Carried into Mission 27 — Launch Certification:

1. **Real verified data acquisition** — real verified launch records remain **0**. The pipeline, manifest validation, provenance/freshness gates, Admin readiness visibility and truthful zero-record states are all accepted; the data itself requires a separately approved research/acquisition operation with first-party evidence and retrieval timestamps. This is an operational prerequisite to public launch, not a product-architecture failure.
2. **Production provider validation** — Stripe Connect live-mode configuration, webhook signing secrets and a controlled provider test.
3. **Infrastructure, TLS and secret management**.
4. **Email and worker operation** in a real environment.
5. **Deployment configuration** and rollback rehearsal.
6. **Final operational acceptance** against a real environment.
7. Deferred INFO item #7 (Vault loading-state ARIA semantics).

Preserved untouched: the Employer Release Baseline, Missions 1–25, the
Institution UX closure, the historical audit documents
(`POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md`,
`STRIDETO_AUDIT_01_COMPLETE_PLATFORM_SECURITY_AUDIT.md`), and the worker.
