# Strideto — Pre-Mission-27 Full Platform QA, DevOps, and Release-Readiness Closure

Date: 2026-08-10

Accepted baseline: `c7fe80b`

Scope: fix-only, local/offline verification; no push, deployment, live database, worker, provider, or external network

## Verdict

**ACCEPTED for Pre-Mission-27 source and local-offline readiness.**

The full multi-role acceptance pack, focused Skill Trust/notification contracts,
browser acceptance, source-level DevOps verifiers, lint, module linking, and the
production client build pass. This verdict does **not** authorize a production
release. Mission 27 must perform controlled environment, data, index, runtime,
backup/restore, observability, and rollout verification against the intended
deployment environment.

## Executed evidence

| Gate | Result |
| --- | ---: |
| Mission 26 non-browser multi-role acceptance | 39/39 commands |
| Applicant Skill Trust | 39/39 checks |
| Skill Trust notification QA | 34/34 checks |
| Notification reliability closure | 15/15 checks |
| Notification operational readiness | 13/13 checks |
| Skill Trust HTTP/inbox contracts | 10/10 checks |
| Mission 24 browser UX | 246/246 assertions |
| Mission 26 cross-role browser UX | 286/286 assertions |
| Skill Trust browser UX | 251/251 assertions |
| Institution browser UX | 89/89 assertions |
| Staging-readiness verifier | 48/48 checks |
| Production-readiness aggregate | 8/8 suites |
| Integration verifier | 32/32 checks |
| Module-link integrity | clean: 1,515 modules, 4,644 relative imports, 6,919 named bindings |
| Lint | pass: 0 errors; 59 existing client warnings within the configured ceiling; server clean |
| Production client build | pass: 1,164 modules transformed |

The module verifier separately reports 57 stale references and one unparseable
file under historical archives. They are outside the runtime graph and remain
non-gating. The build retains non-gating bundle-size, dynamic-import, and stale
Browserslist-data advisories. The verifier runner also emits Node's existing
`DEP0190` warning for child processes created with `shell: true`; this should be
removed in a future tooling-hardening change.

## Reliability and authority closure

- Skill transitions remain compare-and-set operations. Simultaneous decisions
  have one winner; the loser creates no duplicate history or orphan
  `SkillVerification`.
- Notification recipients, type, outcome, and trust state are derived on the
  server from the committed transition and persisted claim. No public arbitrary
  notification-emission endpoint was introduced.
- Canonical `UserNotification` persistence uses the immutable transition/history
  identity and a deterministic `dedupeKey`; retries and concurrent reconciliation
  produce at most one notification.
- Inbox list, unread count, mark-read, mark-all-read, and deletion remain scoped
  to the authenticated recipient. Unsupported Agent and Institution principals
  now receive an explicit 403 instead of reaching a user-only controller shape.
- Trust copy preserves `claimed != evidence_submitted != evidence_backed !=
  verified`. Employer receives no alert for ordinary applicant profile-skill
  activity. Reviewer fan-out remains limited to `skill_verification:review`.
- Internal reviewer reason remains private. `applicantVisibleRequest` is the
  bounded, sanitized, deliberately authored Student instruction for
  `needs_information`.

## Notification recovery trigger

`PENDING_RECONCILIATION` is operationally consumable through the bounded
`trust:notifications:reconcile` command. It:

- requires one explicit immutable history ID;
- requires `STRIDETO_NOTIFICATION_RECONCILE_CONFIRM=1`;
- reconciles exactly once and performs no collection scan;
- reconstructs only the missing notification from immutable history;
- never replays the skill transition, history row, or verification;
- treats an existing deduplicated notification as success/no-op;
- exits non-zero when the notification is still unresolved;
- emits no notification body or recipient data in operator output.

This is a **manual bounded operator trigger**, not an automated worker or job.
No automated recovery claim is made. If Mission 27 requires recurring recovery,
it must add or schedule a bounded controlled-runtime consumer with explicit
batch limits, observability, backoff, and replay-storm protection.

## Notification dedupe index readiness

`UserNotification.dedupeKey` retains an exact unique partial index that includes
only string keys. Existing rows with a missing or null key remain outside the
index. Model-level `autoIndex` and `autoCreate` are disabled so an application
startup cannot perform an uncontrolled production index build.

The `notifications:indexes:verify` command is read-only by default. The apply
mode requires `STRIDETO_INDEX_PROVISION_CONFIRM=1`, creates only the missing
exact index, refuses to replace a mismatched index, and re-verifies after
creation. It never drops an index or edits notification documents.

No live database or index was inspected or mutated during this closure.
Mission 27 must run verify mode against the controlled target, inspect legacy
data and index state, plan the operational build window, run the explicitly
confirmed apply only when approved, and verify the resulting index before
notification traffic is enabled.

## Notification preferences

Preference schema and vocabulary exist, but the canonical in-app
`UserNotification` persistence path does not currently enforce them:

- Student/staff User records contain notification-related preference fields,
  but producers and inbox persistence do not consult them.
- Employer has a canonical scoped inbox but no enforced preference mapping in
  that persistence path.
- Agent and Institution are not canonical `UserNotification` recipient types;
  realm-agnostic inbox access is explicitly denied.
- Quiet hours and email/SMS/push/WhatsApp channel vocabulary are declarative,
  not active delivery behavior.

Mission 27 must define the role/category matrix, distinguish transactional
trust/security alerts from optional notifications, resolve migration/default
semantics, and integrate enforcement centrally. This closure deliberately does
not fabricate preference behavior.

## Browser and deep-link acceptance

The local browser suites used installed Chromium over local Vite servers. Every
API response came from deterministic intercepted fixtures; external DNS was
blackholed. Correct-realm Skill Trust and notification deep links resolve to
Student Profile/Skills/Evidence and Admin Trust Center review surfaces. Wrong
realms are denied, private review text is absent, missing records fail safely,
and Employer is never linked into a private reviewer surface.

The cross-role harness was hardened so repeated hard-navigation probes wait for
the new document rather than accepting the previous ready document. Synthetic
realm storage is cleared between independent fixture sessions, and bounded CDP
browser closure prevents local harness processes from lingering.

## Fixes surfaced by full QA

- Notification inbox controllers now fail closed for unsupported Agent and
  Institution principal shapes.
- The consultation lookup now scopes `studentUserId` to its actual `userId`
  argument instead of referencing an undefined variable.
- Copilot grounding now reports a mixed fresh/stale evidence packet as
  `PARTIALLY_GROUNDED` rather than falling through the duplicate unreachable
  condition.
- Staging, security, forms, page-builder, and integration verifiers were aligned
  with the current accepted architecture and current documentation paths.
- Browser harness teardown and hard-navigation reliability were bounded.
- Historical lint errors in affected source/tests were removed without adding
  product scope.

## Mission 27 operational prerequisites

1. Verify and, when approved, provision the unique partial notification dedupe
   index in the controlled production datastore.
2. Validate production secrets, URLs, TLS, CORS/cookie policy, storage, Redis,
   queues, provider credentials, monitoring, alerts, and log redaction in the
   real runtime. Source verifiers are not substitutes for environment proof.
3. Exercise backup creation and a restore drill, plus rollback and forward-fix
   procedures, against controlled infrastructure.
4. Decide and implement the canonical notification preference/transactional
   policy across roles before claiming preference or quiet-hours enforcement.
5. Decide whether the manual reconciliation trigger is sufficient for launch;
   otherwise schedule a bounded observable consumer in the controlled worker
   environment.
6. Complete controlled verified-data launch checks and release authorization.

## Explicit non-actions

- External email: **NOT_CONFIGURED / not sent**
- External SMS: **NOT_CONFIGURED / not sent**
- External push: **NOT_CONFIGURED / not sent**
- Worker: **not started**
- External network: **not used**
- Live database/index mutation: **none**
- Docker/runtime deployment: **not started**
- Push: **none**
- Deployment: **none**
