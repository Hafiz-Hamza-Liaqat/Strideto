# STRIDETO — Staged Workspace Launch Plan

## Purpose

Control which **private** organization workspaces are publicly active without deleting dashboards, onboarding, tours, or accounts.

Unlock is **manual only** via launch configuration. There is **no** `Date.now()` / calendar auto-unlock.

## Current state (Day 0)

| Workspace ID | Product name | Private workspace | Default |
|---|---|---|---|
| `student` | Student | `/dashboard` + User realm APIs | **ALWAYS ENABLED** (not staged) |
| `employer` | Employer | `/employer` + `/api/employer/*` | **ALWAYS ENABLED** (not staged) |
| `institution` | Institution | `/institution` + `/api/institution/*` | **DISABLED (Coming Soon)** |
| `education_mobility` | Education & Mobility | `/agent/education/*` + education Agent private APIs | **DISABLED (Coming Soon)** |
| `business_services` | Business Formation & Corporate Services | `/agent/business-services/*` + `/api/agent/business-services/*` | **DISABLED (Coming Soon)** |

Student and Employer are permanently active in this phase. They do **not** use launch env flags and cannot be turned off via configuration.

Public discovery (institutions directory, agents marketplace, business-services marketplace when its own flag allows, profiles) remains available according to existing public policies.

## Single source of truth

Shared module:

- `shared/launch/workspaceLaunchGates.js`

### Staged unlock env keys (server-authoritative)

| Workspace | Env key | Enable value | Default |
|---|---|---|---|
| Institution | `WORKSPACE_LAUNCH_INSTITUTION` | `1` | OFF |
| Education & Mobility | `WORKSPACE_LAUNCH_EDUCATION_MOBILITY` | `1` | OFF |
| Business Formation | `WORKSPACE_LAUNCH_BUSINESS_SERVICES` | `1` | OFF |

Client mirrors (presentation only — rebuild required after change):

- `VITE_WORKSPACE_LAUNCH_INSTITUTION`
- `VITE_WORKSPACE_LAUNCH_EDUCATION_MOBILITY`
- `VITE_WORKSPACE_LAUNCH_BUSINESS_SERVICES`

There are **no** `WORKSPACE_LAUNCH_STUDENT` / `WORKSPACE_LAUNCH_EMPLOYER` flags.

Request body / query / headers **cannot** override launch state.

Business Services still also respects legacy `BUSINESS_SERVICES_PROVIDER_ENABLED` / `BUSINESS_SERVICES_ENABLED` after the workspace launch gate is ON.

### Controlled unlock (ops note)

Private workspaces unlock after QA through a controlled launch configuration change — not an automatic calendar release. Planning target dates below are ops guidance only.

## Launch-plan targets (not automatic)

- **Day 0 / current:** Student + Employer active
- **Around Day 5:** manually unlock Institution after QA
- **Around Day 7:** manually unlock Education & Mobility and Business Formation after QA

These dates are planning targets only. The application does **not** auto-unlock.

## Manual unlock procedure

Example — unlock Institution:

1. Set `WORKSPACE_LAUNCH_INSTITUTION=1` on the API/server environment.
2. Set `VITE_WORKSPACE_LAUNCH_INSTITUTION=1` for the client build (or matching deploy env).
3. Run focused Institution portal + launch-gate tests.
4. Build (`npm run build`) and deploy through the normal release path.
5. Live acceptance: `/institution` mounts the real dashboard (for authenticated Institution accounts); public `/institutions` still works; Coming Soon no longer shown for Institution private URLs.
6. Confirm footer Institution entry becomes an active link again.
7. Confirm homepage “Work with Strideto” Institution card shows Available Now + login/register CTAs (no homepage code edit required).

Repeat with:

- `WORKSPACE_LAUNCH_EDUCATION_MOBILITY=1` (+ client Vite mirror)
- `WORKSPACE_LAUNCH_BUSINESS_SERVICES=1` (+ client Vite mirror; ensure GBS provider flag is also ON if required)

## Pre-unlock test checklist

- [ ] Launch-gate defaults still safe for un-unlocked workspaces
- [ ] Target workspace private route mounts real dashboard when flag=`1`
- [ ] Target workspace private API returns success path (auth permitting), not `WORKSPACE_COMING_SOON`
- [ ] Public discovery for that product remains intact
- [ ] Student + Employer regression (login → onboarding/tour → dashboard) unchanged
- [ ] Homepage unlocked card exposes canonical entry CTAs; locked cards have none
- [ ] SEO private prefixes remain noindex
- [ ] `npm run lint` / `npm run build` / relevant verify scripts green

## Rollback procedure

1. Set the staged workspace env flag back to unset/`0` (Institution / Education & Mobility / Business Services → not `1`).
2. Rebuild client if Vite mirrors changed.
3. Redeploy.
4. Confirm private URLs show Coming Soon again and private APIs return `403` + `code: WORKSPACE_COMING_SOON`.

No code deletion/restoration is required. No account wipe. No onboarding-state reset. Student/Employer remain active.

## Coming Soon behavior

Disabled private workspaces show a truthful Coming Soon experience:

- Public copy only (no internal QA/unlock engineering language)
- No fake launch date
- No countdown
- No fake waitlist / notify form unless a real workflow already exists
- Private URLs remain `noindex`

## Explicit non-goals

- No automatic calendar unlock
- No dashboard component deletion
- No onboarding/tour rewrite for gated roles
- No Student/Employer staged rollout flags in this phase
- No new `/for-*` SEO acquisition pages in this phase (reserved for SEO-P1)
