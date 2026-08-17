# STRIDETO Pre-Freeze Final Acceptance Harness

## Purpose

`scripts/pre-freeze-final-acceptance-harness.mjs` is test-only QA
infrastructure. It is not imported by the client, API, or Worker runtime and
does not change authorization, rate limits, schemas, or production data.

## Route manifest

The harness consumes the existing AST-backed route inventory in
`scripts/lib/preMission27RouteInventory.mjs`, which derives records from
`client/src/routes/index.jsx` and route constants. Each record is classified
as:

- `FULL_MATRIX_UI` — rendered static launch route;
- `PARAMETRIC_UI` — rendered route with a disposable fixture parameter;
- `REDIRECT_ONLY` — legacy redirect component;
- `SHELL_EQUIVALENT_ALIAS` — reserved for a proven identical rendered alias;
- `NON_LAUNCH_INTERNAL` — development-only route.

The manifest expands Agent routes across Education Independent, Education
Agency, Business Independent, and Business Agency personas, while retaining
separate Student, Client, Employer, Institution, Admin, and Anonymous realms.
It records fixture requirements, h1 and active-navigation contracts, auth
realm, and domain capability.

## Theme and viewport contract

The runner supports Explicit Light, Explicit Dark, System Light, and System
Dark. System modes set the application preference to `system` and separately
emulate `prefers-color-scheme`. Viewports are exactly 320, 375, 768, 1024,
and 1440 pixels.

## Fixture and isolation strategy

The self-test uses disposable intercepted API fixtures and independent browser
contexts per persona. Dynamic routes use deterministic disposable IDs. Auth
responses are scoped by persona; negative self-tests verify Student/Provider,
Education/Business, Client-resource, and Admin-session isolation. No bypass
route or production credential is introduced.

## Assertions and scheduling

Visual cells capture h1 presence/uniqueness, theme application, body overflow,
console/page errors, failed requests, and named select controls. Workspace
routes additionally carry active-navigation contracts in the manifest. The
runner is serial by default and has no rate-limit disabling behavior. The
representative self-test covers 11 routes × 4 themes × 2 widths (88 cells),
including both system modes. A future `--full` execution can iterate the
manifest’s rendered cells without recreating fixtures per cell.

Functional workflow suites remain separate from the visual matrix: P1A–P2D
focused tests, attention adversarial tests, pagination, privacy, and
authorization suites continue to run independently.

## Current manifest evidence

The source inventory contains 329 route records. Current normalized expansion
produces 367 rendered persona-route combinations and 7,340 visual cells,
with 252 `FULL_MATRIX_UI`, 57 `PARAMETRIC_UI`, 20 `REDIRECT_ONLY`, zero
shell-equivalent aliases, and zero non-launch/internal records.

## Human boundary

The harness does not claim native 200% zoom, human keyboard, real
screen-reader, or human visual acceptance. Those remain the subsequent human
acceptance gate.
