# STRIDETO SEC-3F-F3B Account-State Invalidation Acceptance

## Repository checkpoint

- Authority before acceptance: `e07aa6cbd039ba378c1e649b8fa6bdb5702922bb`
- Parent: `74c97a23c3f251138f62ce4b699f79503cf69be3`
- Branch before this report: `main...origin/main [ahead 42]`
- Execution scope: isolated local production-like staging only
- Production infrastructure used or changed: No
- Manual MongoDB or Redis mutation: No
- Operator identity and credentials: Redacted

## Runtime topology

- Browser origin: `https://localhost:8443`
- API instance A: local `api-a`
- API instance B: local `api-b`
- Local email capture: Mailpit
- MongoDB and Redis remained running and healthy throughout execution.
- The external operator configuration remained outside the repository.

## Routes exercised

### User authentication

- `POST /api/auth/register`
- `POST /api/auth/verify-email`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/refresh-token`
- `POST /api/auth/change-password`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `POST /api/auth/logout-all`

### Employer authentication

- `POST /api/auth/employer/register`
- `POST /api/auth/employer/login`
- `GET /api/employer/me`
- `POST /api/auth/employer/refresh-token`
- `POST /api/auth/employer/change-password`
- `POST /api/auth/employer/forgot-password`
- `POST /api/auth/employer/reset-password`
- `POST /api/auth/employer/logout-all`

### SuperAdmin account-state operations

- `GET /api/admin/permissions`
- `PATCH /api/admin/users/:id`
- `PATCH /api/admin/users/:id/role`

## Safe result matrix

| Result                                       | Status |
| -------------------------------------------- | ------ |
| OPERATOR-SUPERADMIN-AUTHORITY                | PASS   |
| USER-PASSWORD-CHANGE                         | PASS   |
| USER-PASSWORD-CHANGE-OLD-PASSWORD-DENIED     | PASS   |
| USER-PASSWORD-CHANGE-OLD-ACCESS-DENIED       | PASS   |
| USER-PASSWORD-CHANGE-OLD-REFRESH-DENIED      | PASS   |
| USER-PASSWORD-CHANGE-FRESH-LOGIN             | PASS   |
| USER-PASSWORD-RESET                          | PASS   |
| USER-RESET-TOKEN-SINGLE-USE                  | PASS   |
| USER-PASSWORD-RESET-OLD-ACCESS-DENIED        | PASS   |
| USER-PASSWORD-RESET-OLD-REFRESH-DENIED       | PASS   |
| USER-PASSWORD-RESET-FRESH-LOGIN              | PASS   |
| USER-LOGOUT-ALL                              | PASS   |
| USER-LOGOUT-ALL-ACCESS-DENIED                | PASS   |
| USER-LOGOUT-ALL-REFRESH-DENIED               | PASS   |
| USER-LOGOUT-ALL-FRESH-LOGIN                  | PASS   |
| EMPLOYER-PASSWORD-CHANGE                     | PASS   |
| EMPLOYER-PASSWORD-CHANGE-OLD-PASSWORD-DENIED | PASS   |
| EMPLOYER-PASSWORD-CHANGE-OLD-ACCESS-DENIED   | PASS   |
| EMPLOYER-PASSWORD-CHANGE-OLD-REFRESH-DENIED  | PASS   |
| EMPLOYER-PASSWORD-CHANGE-FRESH-LOGIN         | PASS   |
| EMPLOYER-PASSWORD-RESET                      | PASS   |
| EMPLOYER-RESET-TOKEN-SINGLE-USE              | PASS   |
| EMPLOYER-PASSWORD-RESET-OLD-ACCESS-DENIED    | PASS   |
| EMPLOYER-PASSWORD-RESET-OLD-REFRESH-DENIED   | PASS   |
| EMPLOYER-PASSWORD-RESET-FRESH-LOGIN          | PASS   |
| EMPLOYER-LOGOUT-ALL                          | PASS   |
| EMPLOYER-LOGOUT-ALL-ACCESS-DENIED            | PASS   |
| EMPLOYER-LOGOUT-ALL-REFRESH-DENIED           | PASS   |
| EMPLOYER-LOGOUT-ALL-FRESH-LOGIN              | PASS   |
| ACCOUNT-SUSPENSION                           | PASS   |
| ACCOUNT-SUSPENSION-ACCESS-DENIED             | PASS   |
| ACCOUNT-SUSPENSION-REFRESH-DENIED            | PASS   |
| ACCOUNT-SUSPENSION-LOGIN-DENIED              | PASS   |
| ACCOUNT-REACTIVATION-NO-SESSION-RESURRECTION | PASS   |
| ACCOUNT-REACTIVATION-FRESH-LOGIN             | PASS   |
| ROLE-CHANGE                                  | PASS   |
| ROLE-CHANGE-OLD-ACCESS-DENIED                | PASS   |
| ROLE-CHANGE-OLD-REFRESH-DENIED               | PASS   |
| ROLE-CHANGE-NEW-AUTHORITY                    | PASS   |
| ROLE-CHANGE-CROSS-INSTANCE-CONSISTENCY       | PASS   |
| ROLE-RESTORATION                             | PASS   |
| CROSS-REALM-INVALIDATION-ISOLATION           | PASS   |
| FINAL-DUAL-INSTANCE-HEALTH                   | PASS   |

Total: 43 passed, 0 failed, 0 blocked.

## User evidence

### Password change

- The supported route rejected a request without the current password.
- Two API sessions and one browser session existed before mutation.
- The old password was rejected and a fresh login with the new password succeeded.
- Both pre-change access authorities were rejected through both API instances.
- Both pre-change refresh families were rejected.
- Browser reload did not restore the old session.

### Password reset

- The exact-recipient reset message was captured through local Mailpit; its body, link, and token were never printed.
- The reset completed through the normal route.
- Reusing the reset token was rejected.
- Two pre-reset access authorities were rejected through both API instances.
- Both pre-reset refresh families were rejected, browser reload restored no old session, and fresh login succeeded.

### Logout all

- Three API sessions across `api-a` and `api-b`, plus a browser session, existed before logout-all.
- Every old access authority was rejected by both API instances.
- Every old refresh family was rejected and the browser session was not restored.
- Fresh login and cross-instance use succeeded.

## Employer evidence

### Password change

- The supported route rejected a request without the current password.
- Two API sessions and one browser session existed before mutation.
- The old password was rejected and a fresh login with the new password succeeded.
- Both pre-change access authorities were rejected through both API instances.
- Both pre-change refresh families were rejected and browser reload restored no old session.

### Password reset

- Existing-account and absent-account forgot-password requests returned the same safe generic response.
- The exact-recipient reset message was captured locally without printing its body, link, or token.
- The reset completed and token reuse was rejected.
- Both pre-reset access authorities and refresh families were rejected.
- Browser reload restored no old session and fresh login succeeded.

### Logout all

- Three API sessions across `api-a` and `api-b`, plus a browser session, existed before logout-all.
- Every old access authority was rejected by both API instances.
- Every old refresh family was rejected and no browser session was restored.
- Fresh login and cross-instance use succeeded.

## Suspension and reactivation evidence

- A dedicated verified User had two working sessions across both APIs.
- SuperAdmin suspension used `PATCH /api/admin/users/:id`; no datastore was edited directly.
- Both old access authorities and refresh families were rejected immediately.
- Suspended-account login returned the safe rejection and no protected account data.
- Reactivation used the same supported route with active status.
- No pre-suspension session was resurrected; fresh login and both API instances worked after reactivation.

## Role-change evidence

- A dedicated verified User began with role `User` and two active sessions.
- SuperAdmin changed the role to `Editor` through `PATCH /api/admin/users/:id/role`.
- Both old access authorities and refresh families were rejected.
- Fresh login reported `Editor` consistently through `api-a` and `api-b`.
- The role was restored to `User` through the same route.
- The interim authority was invalidated again and fresh login reported the restored role.

## Cross-realm and cross-instance evidence

- User password mutation and logout-all did not invalidate the unrelated Employer session.
- Employer password mutation and logout-all did not invalidate the unrelated User session.
- Suspension and role mutation affected only their dedicated target accounts.
- User and Employer refresh cookies retained distinct names and paths.
- Every tested stale access authority was rejected by both API instances.
- Fresh authority was consistent across both API instances.

## Preservation and limitations

- No source, configuration, package, environment, Docker, or Caddy file was changed.
- No production endpoint or production datastore was used.
- No manual datastore mutation, provisioning command, push, or deployment occurred.
- Operator credentials, account emails, passwords, tokens, cookies, email bodies, and reset links were not recorded.
- SEC-3F final evidence consolidation and infrastructure authority sign-off remain pending.
- SEC-3G remains blocked until SEC-3F is formally completed.
