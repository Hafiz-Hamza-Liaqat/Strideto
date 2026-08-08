# Strideto Engineering Guardrails (FROZEN)

> **Status:** Authoritative and permanent. Companion to
> [STRIDETO_MASTER_PRODUCT_SPEC.md](STRIDETO_MASTER_PRODUCT_SPEC.md),
> [STRIDETO_MASTER_EXECUTION_ROADMAP.md](STRIDETO_MASTER_EXECUTION_ROADMAP.md),
> [STRIDETO_TRUST_VERIFICATION_POLICY.md](STRIDETO_TRUST_VERIFICATION_POLICY.md).
> These guardrails bind all future development unless an operator explicitly and
> in writing lifts a specific one for a specific task.

## 1. Safety & operations guardrails

- **No `.env` / `.env.*` reads or secret printing.** Never read, echo, or commit
  environment files or secret values.
- **No `git push`** without explicit operator approval.
- **No production deployment** without explicit operator approval.
- **No destructive database mutation** (mass delete/overwrite/drop) against any
  live or shared datastore.
- **No Docker volume deletion**, `docker compose down -v`, or `volume prune`.
- **Worker stays stopped** unless an operator explicitly authorizes starting it.
- **No real email sending** during source implementation. Email delivery is
  gated behind configuration and controlled acceptance.
- **No real payment or payout** during source implementation.

## 2. Correctness & security guardrails

- **Server-side authorization is mandatory.** Client checks are never the
  authority.
- **Ownership before writes.** Every mutating endpoint verifies the actor owns
  (or is authorized for) the target before mutating.
- **Tenant isolation.** No cross-employer, cross-agent, cross-user, or
  cross-organization data may be reachable through any id supplied by a caller.
- **Idempotency for important writes.** Repeated identical requests (same-status
  transitions, webhook redelivery, retries) must not double-write, double-notify,
  or double-emit events.
- **Audit high-risk actions** (auth changes, verification decisions, payments,
  moderation, data deletion) through the audit service.
- **Private documents by default.** Access is explicit, granular, and revocable.

## 3. Data & compatibility guardrails

- **International data contracts.** New systems use ISO countries, ISO
  currencies, IANA timezones, and international phone/address contracts — never
  Pakistan-only / PKR-only / `+92`-only / `Asia/Karachi`-only / single-grading /
  single-address assumptions. (See the product spec's global principle.)
- **i18n compatibility.** All new user-facing strings route through the existing
  i18n system. Do not hardcode display copy; do not build a new translation
  system.
- **Preserve backwards compatibility.** Existing API fields and contracts are
  kept working; additive change is preferred over breaking change.
- **Migrations are incremental and reversible where practical.** Backfills are
  written as explicit, reviewable, dry-runnable scripts — never executed
  implicitly as a side effect of a request path, and never auto-run against
  production.

## 4. UX truthfulness guardrails

- **Truthful loading / error / success UI.** Every async action shows real
  state; no spinner that never resolves, no success shown before the server
  confirms.
- **No fake production success.** Never render a success state for an action the
  server did not actually complete.
- **Terminology must match the real result.** UI labels describe what actually
  happens (e.g. do not label an action "Hired" when the canonical result is
  "offer accepted"). Do not expose raw enum slugs to users; route stage/status
  labels through the shared i18n label contract.
- **Counts describe the data they sit on.** A count badge must reflect the list
  or dataset actually rendered next to it.
- **Responsive / mobile-safe frontend.** No horizontal body scroll; wide content
  scrolls inside its own container; touch targets meet the established minimum.

## 5. Process guardrails

- **Tests before commits.** Focused tests accompany behavior changes; relevant
  existing regressions are run before committing.
- **Do not commit failing code.** Lint/typecheck/build as applicable must pass
  for the changed surface.
- **Review the final diff** and verify no secret/env exposure before committing.
- **Smallest correct solution.** Reuse existing architecture; do not introduce a
  parallel system where one already exists (e.g. a second payment path).
- **Do not expand scope** into future missions while working a given mission.

## 6. Preserved historical artifacts

The following untracked files are historical records and must **not** be added,
deleted, or edited by routine work:

- `docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md`
- `docs/STRIDETO_AUDIT_01_COMPLETE_PLATFORM_SECURITY_AUDIT.md`

## 7. Stop conditions

Work stops and escalates to the operator (rather than guessing) when:

- a real P0 security problem is discovered;
- frozen product requirements conflict materially;
- an irreversible live-data mutation would be required;
- payment/vendor selection becomes required;
- production credentials would be required;
- a fix would require redesigning already-accepted architecture.
