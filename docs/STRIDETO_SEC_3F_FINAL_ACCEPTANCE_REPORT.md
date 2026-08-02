# STRIDETO SEC-3F Final Acceptance Report

## 1. Verdict

**SEC-3F PASS FOR ISOLATED LOCAL STAGING**

SEC-3F engineering acceptance is complete for the isolated local production-like staging stack. The runtime evidence totals 111 passed scenarios, 0 failed, and 0 blocked.

The production activation gate is **NOT MET**. This verdict does not authorize production deployment or production secure-auth activation.

## 2. Repository checkpoints

| Scope                         | Commit                                     | Subject                                                       |
| ----------------------------- | ------------------------------------------ | ------------------------------------------------------------- |
| Local infrastructure          | `edbf499a2148bf4307eac1bdaa7fdd85300f4c26` | `chore(staging): complete local sec-3f readiness`             |
| Mailpit                       | `7945fad7861cf6da21d5150af7714bf543ee11ba` | `chore(staging): add local email verification capture`        |
| F1                            | `618b5f079e5971c29936832b127d35e686961bb4` | `test(auth): accept local browser session flows`              |
| F2                            | `047443b90476bf7c6bd9cad0b505d8ca18e77975` | `test(auth): accept cross-instance refresh and restart flows` |
| Redis issuance correction     | `20390db6d49afbab552797d61f8ddaf83fecab63` | `fix(auth): require Redis before issuing sessions`            |
| F3A                           | `f40e5b4d2c9ebd2ebc59f7fefda114c9134d2f37` | `test(auth): accept datastore outage behavior`                |
| Employer password flows       | `74c97a23c3f251138f62ce4b699f79503cf69be3` | `feat(auth): add employer password recovery flows`            |
| Local SuperAdmin provisioning | `e07aa6cbd039ba378c1e649b8fa6bdb5702922bb` | `chore(auth): add guarded local superadmin provisioning`      |
| F3B                           | `609f14c73dde698f4bac5b14a74683497bc4bf66` | `test(auth): accept account-state invalidation flows`         |

The commits form the verified parent chain used by this final sign-off. No unrelated history was used as acceptance authority.

## 3. Environment and topology

- Environment: isolated local production-like staging
- Browser origin: local HTTPS through Caddy
- API instances: two concurrently running processes, `api-a` and `api-b`
- Persistence: one shared isolated-local MongoDB service
- Security state: one shared isolated-local Redis service
- Routing: Caddy dual-upstream API routing
- Email delivery: local Mailpit verification and reset capture
- Browser execution: real headless Chromium through the external Playwright runtime
- Production infrastructure contacted or changed: No

The local stack is not public staging or production evidence. Its internal Caddy certificate is not evidence of a production certificate.

## 4. Acceptance coverage

| Phase                                 | Runtime scenarios passed | Failed | Blocked |
| ------------------------------------- | -----------------------: | -----: | ------: |
| F1 — browser authentication           |                       24 |      0 |       0 |
| F2 — concurrency, replay, and restart |                       19 |      0 |       0 |
| F3A — datastore outage and recovery   |                       25 |      0 |       0 |
| F3B — account-state invalidation      |                       43 |      0 |       0 |
| **Total**                             |                  **111** |  **0** |   **0** |

Focused regression assertions are recorded separately and are not included in the 111 runtime-scenario total:

- Redis session-issuance gate: 9 suites, 479 assertions passed
- Employer password-security flows: 8 suites, 742 assertions passed
- Local SuperAdmin provisioning: 3 suites, 357 assertions passed

## 5. F1 browser authentication results

All 24 required scenarios passed through real Chromium. User and Employer registration/login, User verification through Mailpit, cookie-only refresh, reload bootstrap, logout-current, stale-access denial, realm cookie isolation, logout isolation, and the trusted-origin negative case were proven.

No refresh token appeared in JSON or browser-readable storage. User and Employer refresh cookies remained HttpOnly, Secure, host-only, SameSite Lax, and scoped to distinct route paths.

## 6. F2 concurrency, replay and restart results

All 19 required scenarios passed. For both User and Employer realms, exactly one concurrent same-cookie refresh succeeded across `api-a` and `api-b`; the benign loser returned the expected conflict, stable replay revoked the affected family, and the current family token was rejected by both APIs afterward.

Cross-instance logout and shared Redis access denylisting passed. Restarting each API individually preserved the surviving instance, Caddy availability, and pre-existing session continuity after the restarted instance recovered.

## 7. F3A Redis/MongoDB outage results

All 25 required scenarios passed. Redis outage caused protected access, refresh, login issuance, and logout-current to fail closed without issuing credentials. After Redis returned, both APIs reconnected without restart and denylist state persisted.

MongoDB outage caused protected access and refresh to fail closed, login/write attempts to fail safely without credentials or false success, and no raw datastore details to reach clients. MongoDB recovery was automatic without API restart; pre-outage sessions, normal authentication, and index verification recovered successfully.

## 8. F3B account-state invalidation results

All 43 required scenarios passed. User and Employer password change, password reset, and logout-all invalidated pre-mutation access and refresh authority across both APIs. Reset tokens were single-use, old passwords failed, fresh logins succeeded, and browser reload restored no old session.

SuperAdmin suspension/reactivation invalidated only the target account and resurrected no old session. User role change from `User` to `Editor`, and restoration to `User`, invalidated authority at both transitions and remained consistent across `api-a` and `api-b`.

## 9. Security defects found and corrected

1. Redis outage originally allowed login and refresh credential issuance. The correction requires a real Redis availability round trip before initial session issuance or refresh rotation.
2. Employer password-change and password-reset routes were absent. The correction added the supported routes with global refresh revocation and access-authority invalidation.
3. Local SuperAdmin authority was unavailable for role-change acceptance. The correction added guarded local-only operator provisioning through existing application services, with no public route and no direct datastore mutation.

Regression evidence for all three corrections passed as listed in §4.

## 10. Index readiness and verification

The isolated local staging `RefreshSession` collection was verified to contain the implicit `_id` index plus all four required schema-defined indexes:

- `refresh_session_ttl`
- `refresh_session_active_by_subject`
- `refresh_session_current_token_hash_unique`
- `refresh_session_previous_token_hash`

Guarded first-run creation and verification matched the committed schema. No index was dropped or replaced. Production index apply and verification have not occurred.

## 11. Realm isolation

User and Employer cookies, paths, session families, access authority, password mutations, logout-all operations, and unrelated-account behavior remained isolated. Cross-realm refresh attempts created no authority. Mutating one realm did not invalidate the unrelated session in the other realm.

## 12. Trusted-origin enforcement

Protected authentication operations accepted the configured local HTTPS browser origin. A null-origin refresh attempt returned HTTP 403 and created no cookie, session, or account mutation. No trusted Origin header was spoofed during browser acceptance.

Production exact-origin values remain an operator-controlled deployment prerequisite and were not inferred from repository templates.

## 13. Secret and credential handling

- Credentials, access tokens, refresh-cookie values, verification/reset tokens, email bodies, links, and datastore connection values were never printed in acceptance evidence.
- Runtime credentials were retained only in memory by temporary external harnesses.
- No credential was placed inside the repository or `.env.staging`.
- The temporary local operator credential file was securely removed after the evidence audit.
- Operator process variables were cleared where present.
- The external Playwright runtime and browser binaries were retained without credential material.

## 14. Known limitations

- Acceptance applies only to the isolated local stack.
- Production Redis remains unprovisioned/deferred.
- Production Redis persistence remains unverified.
- Production `RefreshSession` indexes remain unapplied and unverified.
- Secure-auth production variables remain inactive.
- No production deployment occurred.
- No production browser acceptance occurred.
- Local internal TLS is not production certificate evidence.
- Public `staging.strideto.com` DNS remains unresolved.
- The 43 pre-sign-off local commits remain unpushed; this documentation checkpoint is also local-only.

## 15. Production blockers

Production activation remains blocked pending all of the following:

- production Redis provisioning and persistence verification;
- exact production trusted-origin configuration;
- production secure-auth environment activation prerequisites;
- production `RefreshSession` index apply and read-only verification;
- an explicitly authorized production deployment;
- final production browser smoke;
- any still-required public staging DNS and hosting verification.

Local acceptance must not be treated as evidence that these production actions occurred.

## 16. SEC-3G authorization

**SEC-3G may begin locally.**

This authorization permits legacy-authentication surface inventory, bounded removal on the local development branch, and focused/full regression verification after removal. It does not authorize production deployment, production secure-auth activation, removal of deployment rollback capability, or any production datastore operation.

Production deployment remains blocked.

## 17. Final preservation statement

- Application source changed during final consolidation: No
- Tests, packages, Docker, Caddy, or environment configuration changed: No
- Manual datastore mutation: No
- Production infrastructure changed: No
- Credentials or tokens exposed: No
- Preserved reports modified: No
- `.env.staging` modified: No
- Push performed: No
- Deployment performed: No

Final engineering decision: **SEC-3F PASS FOR ISOLATED LOCAL STAGING**.

Production activation gate: **NOT MET**.
