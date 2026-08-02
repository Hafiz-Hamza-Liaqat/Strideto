# STRIDETO SEC-3F-F3A Datastore Outage Acceptance

## Verdict

SEC-3F-F3A datastore outage and automatic-recovery acceptance passed against the isolated local SEC-3F stack on 2026-08-02.

- Executed scenarios: 25
- Passed: 25
- Failed: 0
- Blocked: 0

The 25 scenarios comprise all 24 required matrix entries plus the separately required Redis-outage logout-current result.

## Repository checkpoint and scope

- Tested HEAD: `20390db6d49afbab552797d61f8ddaf83fecab63`
- Tested parent: `047443b90476bf7c6bd9cad0b505d8ca18e77975`
- Tested branch state: `main...origin/main [ahead 39]`
- Scope: isolated local Compose stack only
- Local origin: `https://localhost:8443`
- Production services used or changed: No
- Application source or configuration changed during acceptance: No
- Docker volumes recreated or deleted: No
- API restart during datastore recovery: No

Credentials, access tokens, refresh-cookie values, verification tokens, datastore connection values, and email bodies were retained only in memory and were not printed or written to this report.

## Initial health

Before testing:

- frontend: healthy
- api-a: healthy; direct health HTTP 200
- api-b: healthy; direct health HTTP 200
- MongoDB: healthy
- Redis: healthy
- Caddy: running; API HTTP 200
- Mailpit: healthy; HTTP 200

## Redis outage matrix

Only Redis was stopped. MongoDB remained healthy, and both API processes, the frontend, Caddy, and Mailpit remained running.

| Scenario                                  | Result | Safe evidence                                                                                               |
| ----------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------- |
| REDIS-OUTAGE-USER-ACCESS-FAIL-CLOSED      | PASS   | Both API instances returned HTTP 503 with the safe service-unavailable response and no User body.           |
| REDIS-OUTAGE-EMPLOYER-ACCESS-FAIL-CLOSED  | PASS   | Both API instances returned HTTP 503 with no Employer body.                                                 |
| REDIS-OUTAGE-USER-REFRESH-FAIL-CLOSED     | PASS   | HTTP 503; no access token, refresh token, or Set-Cookie mutation.                                           |
| REDIS-OUTAGE-EMPLOYER-REFRESH-FAIL-CLOSED | PASS   | HTTP 503; no access token, refresh token, or Set-Cookie mutation.                                           |
| REDIS-OUTAGE-USER-LOGIN-NOT-ISSUED        | PASS   | Valid credentials reached the corrected gate; HTTP 503 with no token or refresh cookie.                     |
| REDIS-OUTAGE-EMPLOYER-LOGIN-NOT-ISSUED    | PASS   | Valid credentials reached the corrected gate; HTTP 503 with no token or refresh cookie.                     |
| REDIS-OUTAGE-LOGOUT-CURRENT-FAIL-CLOSED   | PASS   | HTTP 503 was returned safely; successful logout was not claimed while denylist enforcement was unavailable. |

The corrected Redis session-issuance boundary was therefore exercised through live User and Employer login and refresh paths. The public response was `Service temporarily unavailable`; no raw Redis details were returned. Protected-access fail-closed enforcement remained active.

## Redis recovery matrix

Redis was started without recreating its volume. Neither API was restarted.

| Scenario                                | Result | Evidence                                                                                                                     |
| --------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------- |
| REDIS-RECOVERY-AUTOMATIC                | PASS   | api-a and api-b automatically reconnected and authorized valid sessions.                                                     |
| REDIS-RECOVERY-NORMAL-AUTH              | PASS   | Normal browser-origin User and Employer login returned HTTP 200.                                                             |
| REDIS-RECOVERY-ORIGINAL-REFRESH-COOKIES | PASS   | Both unchanged pre-outage refresh cookies refreshed successfully and rotated only after recovery.                            |
| REDIS-DENYLIST-PERSISTS-AFTER-RESTART   | PASS   | An access token denylisted through api-a before the outage remained rejected through both API instances after Redis restart. |

The denylist persistence check used a distinct verified User session. Logout-current completed through one API before the outage, the old access token was rejected through the other API, and the rejection survived the Redis stop/start cycle.

## MongoDB outage matrix

MongoDB was stopped only after Redis had completely recovered. Redis remained healthy, and both API processes, the frontend, Caddy, and Mailpit remained running.

| Scenario                                  | Result | Safe evidence                                                                                                                |
| ----------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------- |
| MONGO-OUTAGE-USER-ACCESS-FAIL-CLOSED      | PASS   | Both APIs returned HTTP 503 when authoritative account/token-version state could not be verified; no User body was returned. |
| MONGO-OUTAGE-EMPLOYER-ACCESS-FAIL-CLOSED  | PASS   | Both APIs returned HTTP 503 with no Employer body.                                                                           |
| MONGO-OUTAGE-USER-REFRESH-FAIL-CLOSED     | PASS   | HTTP 503; no access token, rotated refresh cookie, or false success.                                                         |
| MONGO-OUTAGE-EMPLOYER-REFRESH-FAIL-CLOSED | PASS   | HTTP 503; no access token, rotated refresh cookie, or false success.                                                         |
| MONGO-OUTAGE-USER-LOGIN-NOT-ISSUED        | PASS   | HTTP 500 with the production-safe `Internal Server Error` response; no credential or cookie.                                 |
| MONGO-OUTAGE-EMPLOYER-LOGIN-NOT-ISSUED    | PASS   | HTTP 500 with the production-safe `Internal Server Error` response; no credential or cookie.                                 |
| MONGO-OUTAGE-WRITE-FAILS-SAFELY           | PASS   | One unique registration attempt returned the safe HTTP 500 response and did not report success.                              |

No MongoDB URI, hostname, stack trace, raw driver error, or topology detail reached any client response.

## MongoDB recovery matrix

MongoDB was started without recreating its volume. Neither API was restarted.

| Scenario                        | Result | Evidence                                                                                    |
| ------------------------------- | ------ | ------------------------------------------------------------------------------------------- |
| MONGO-RECOVERY-AUTOMATIC        | PASS   | Both APIs automatically reconnected and authorized pre-outage sessions.                     |
| MONGO-RECOVERY-USER-SESSION     | PASS   | The pre-outage User session worked through api-a and api-b.                                 |
| MONGO-RECOVERY-EMPLOYER-SESSION | PASS   | The pre-outage Employer session worked through api-a and api-b.                             |
| MONGO-RECOVERY-NORMAL-AUTH      | PASS   | User and Employer refresh succeeded, followed by fresh normal browser-origin login.         |
| MONGO-RECOVERY-INDEXES-MATCH    | PASS   | `npm run auth:indexes:verify` completed successfully inside api-a; index apply was not run. |

This proves session continuity for unexpired User and Employer sessions, refresh-session continuity after safe outage failures, and automatic Mongoose recovery without an API restart.

## Final health

| Service  | Final state              |
| -------- | ------------------------ |
| frontend | healthy                  |
| api-a    | healthy; direct HTTP 200 |
| api-b    | healthy; direct HTTP 200 |
| MongoDB  | healthy                  |
| Redis    | healthy                  |
| Caddy    | running; API HTTP 200    |
| Mailpit  | healthy; HTTP 200        |

## Preservation and remaining work

- Source/configuration changes: None
- Datastore volumes or test contents deleted: No
- Production data or services used: No
- Push or deployment: No
- SEC-3F-F3B account-state invalidation scenarios: Pending
- SEC-3G: Blocked until the authorized preceding security acceptance phases complete
