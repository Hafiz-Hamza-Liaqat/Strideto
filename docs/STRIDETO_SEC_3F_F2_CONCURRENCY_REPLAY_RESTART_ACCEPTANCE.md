# STRIDETO SEC-3F-F2 Concurrency, Replay and Restart Acceptance

## Acceptance verdict

All 19 required local cross-instance authentication scenarios passed. No scenario failed or was blocked in the completed acceptance run.

This evidence is limited to the isolated local SEC-3F production-like Docker environment. No production infrastructure was contacted or changed.

## Repository checkpoint

- Acceptance base: `618b5f079e5971c29936832b127d35e686961bb4`
- Base parent: `7945fad7861cf6da21d5150af7714bf543ee11ba`
- Branch before this report: `main...origin/main [ahead 37]`
- Tracked tree before execution: clean
- Staged files before execution: none
- Preserved untracked reports remained untouched
- `.env.staging` remained ignored and was not printed or modified

## Local environment and service health

- Browser origin: `https://localhost:8443`
- API A: `http://127.0.0.1:5001`, healthy, HTTP 200
- API B: `http://127.0.0.1:5002`, healthy, HTTP 200
- Caddy: running, local health HTTP 200
- Frontend: healthy
- MongoDB: healthy
- Redis: healthy
- Mailpit: healthy, UI HTTP 200
- Browser: external headless Chromium through Playwright
- Instance-pinned calls: local Node HTTP requests with trusted local origin

## Derived concurrency and replay contract

- Refresh rotation is a MongoDB compare-and-set operation against the current refresh-token hash.
- The benign concurrency window is 15,000 milliseconds, inclusive.
- Exactly one same-cookie concurrent request can rotate the session.
- The losing request within the benign window returns HTTP 409 with the safe `refresh_conflict` result.
- A benign concurrent loser does not clear the winning cookie and does not revoke the family.
- A previous token presented after the benign window is classified as replay.
- Stable replay returns HTTP 401 and revokes only the affected refresh-session family with the internal replay reason.
- Subsequent use of the rotated current token from that revoked family returns HTTP 401 on both instances.
- User and Employer realms use the same bounded rotation and replay semantics with distinct cookies and routes.

## Safe scenario matrix

| Scenario | Safe evidence | Result |
| --- | --- | --- |
| USER-CONCURRENT-REFRESH-CROSS-INSTANCE | API A HTTP 200; API B HTTP 409 `refresh_conflict` | PASS |
| USER-CONCURRENT-DOUBLE-SUCCESS-PREVENTED | Successful concurrent rotations: 1 | PASS |
| USER-CONCURRENT-POST-RACE-STATE | Winning successor refreshed through API B with HTTP 200 | PASS |
| USER-PREVIOUS-TOKEN-REPLAY-REJECTED | Previous token after the window rejected by API B with HTTP 401 | PASS |
| USER-REPLAY-POST-STATE | Current family token rejected by API A and API B with HTTP 401 | PASS |
| USER-CROSS-INSTANCE-LOGOUT | Logout on API B; refresh rejected by API A with HTTP 401 | PASS |
| USER-CROSS-INSTANCE-ACCESS-DENYLIST | Pre-logout access rejected by API A with HTTP 401 | PASS |
| EMPLOYER-CONCURRENT-REFRESH-CROSS-INSTANCE | API A HTTP 409 `refresh_conflict`; API B HTTP 200 | PASS |
| EMPLOYER-CONCURRENT-DOUBLE-SUCCESS-PREVENTED | Successful concurrent rotations: 1 | PASS |
| EMPLOYER-CONCURRENT-POST-RACE-STATE | Winning successor refreshed through API A with HTTP 200 | PASS |
| EMPLOYER-PREVIOUS-TOKEN-REPLAY-REJECTED | Previous token after the window rejected by API B with HTTP 401 | PASS |
| EMPLOYER-REPLAY-POST-STATE | Current family token rejected by API A and API B with HTTP 401 | PASS |
| EMPLOYER-CROSS-INSTANCE-LOGOUT | Logout on API A; refresh rejected by API B with HTTP 401 | PASS |
| EMPLOYER-CROSS-INSTANCE-ACCESS-DENYLIST | Pre-logout access rejected by API B with HTTP 401 | PASS |
| API-A-RESTART-SURVIVING-INSTANCE | API B stayed healthy; Caddy retained or regained HTTP 200; API A returned healthy | PASS |
| API-A-RESTART-SESSION-CONTINUITY | Pre-restart User family refreshed through API A; current User returned HTTP 200 | PASS |
| API-B-RESTART-SURVIVING-INSTANCE | API A stayed healthy; Caddy retained or regained HTTP 200; API B returned healthy | PASS |
| API-B-RESTART-SESSION-CONTINUITY | Pre-restart Employer family refreshed through API B; current Employer returned HTTP 200 | PASS |
| FINAL-DUAL-INSTANCE-HEALTH | API A, API B, Caddy and Mailpit returned HTTP 200; all Compose services healthy/running | PASS |

## User concurrency and replay evidence

- One verified User session supplied the same current cookie to API A and API B concurrently.
- API A won with HTTP 200; API B returned HTTP 409 `refresh_conflict`.
- Successful refresh responses: 1.
- The winner remained valid and rotated through API B with HTTP 200.
- A separate User session rotated through API A.
- After the 15,000-millisecond benign window, the previous token was rejected by API B with HTTP 401.
- The replay-revoked family was rejected by both API A and API B with HTTP 401.

## Employer concurrency and replay evidence

- One Employer session supplied the same current cookie to API A and API B concurrently.
- API B won with HTTP 200; API A returned HTTP 409 `refresh_conflict`.
- Successful refresh responses: 1.
- The winner remained valid and rotated through API A with HTTP 200.
- A separate Employer session rotated through API A.
- After the 15,000-millisecond benign window, the previous token was rejected by API B with HTTP 401.
- The replay-revoked family was rejected by both API A and API B with HTTP 401.
- Employer email verification was not assumed because it is not required by the current Employer registration contract.

## Cross-instance logout evidence

### User realm

- The session was established through API A.
- Logout-current succeeded through API B with HTTP 200.
- API A rejected the logged-out refresh family with HTTP 401.
- API A rejected the access token presented to logout with HTTP 401.

### Employer realm

- The session was established through API B.
- Logout-current succeeded through API A with HTTP 200.
- API B rejected the logged-out refresh family with HTTP 401.
- API B rejected the access token presented to logout with HTTP 401.
- No User-realm cookie or session was used by the Employer checks.

## Shared-state evidence

- Cross-instance refresh rotation and replay results demonstrate that both APIs observed the same MongoDB-backed refresh-session family state.
- Logout on one API followed by refresh rejection on the other demonstrates shared MongoDB refresh-family revocation.
- Logout on one API followed by old-access rejection on the other demonstrates the shared Redis access-token denylist.
- No MongoDB or Redis connection value was read or printed.

## API A restart evidence

- A fresh verified User session was confirmed through API B before restart.
- Only `api-a` was restarted; no image was rebuilt.
- API B stayed healthy during the bounded observation.
- Caddy retained or regained HTTP 200 through the surviving upstream.
- MongoDB and Redis remained healthy and were not restarted.
- API A returned healthy.
- The pre-restart User session refreshed through API A with HTTP 200.
- The current-User route through API A returned HTTP 200.

## API B restart evidence

- A fresh Employer session was confirmed through API A before restart.
- Only `api-b` was restarted; no image was rebuilt.
- API A stayed healthy during the bounded observation.
- Caddy retained or regained HTTP 200 through the surviving upstream.
- MongoDB and Redis remained healthy and were not restarted.
- API B returned healthy.
- The pre-restart Employer session refreshed through API B with HTTP 200.
- The current-Employer route through API B returned HTTP 200.

## Preservation and limitations

- Test identities, passwords, access tokens, refresh cookies, `Set-Cookie` values, verification links and request credential headers were never printed.
- User email verification used the normal browser and local Mailpit flow.
- Test account and session data was created only through normal application routes.
- MongoDB and Redis were not modified manually.
- No source, Compose, Caddy or environment file was modified.
- No HAR file or persistent browser profile was created.
- The temporary external Playwright harness was deleted.
- Both API instances and every supporting local service remain running and healthy.
- No production infrastructure was used.
- SEC-3F-F3 datastore-outage and account-state invalidation acceptance remains pending.
- SEC-3G remains blocked until SEC-3F acceptance and consolidation are complete.
- No push or deployment occurred.
