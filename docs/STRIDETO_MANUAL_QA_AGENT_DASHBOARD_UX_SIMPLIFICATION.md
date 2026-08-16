# STRIDETO Manual QA — Agent Dashboard UX Simplification

Manual-QA UX refactor only. No backend authority change, no API contract change, no route deletion, no Wyoming activation, no Worker start.

## Old navigation problem

The Agent portal mixed two independent concepts into one “Current workspace” control:

1. **Who** the Provider is acting as (Independent vs Agency)
2. **Which** professional dashboard is open (Education & Mobility vs Business Services)

Sidebar links were a single ungrouped list, so Providers had to reason about implementation architecture (`subjectType`, domain IDs, overlapping Trust/Verification labels) instead of daily work.

## New information architecture

```
WHO AM I ACTING AS?     →  Acting as (subject)
WHICH DASHBOARD?        →  Active dashboard (workspace)
WHAT NEEDS ATTENTION?   →  domain Overview (existing counters only)
DO MY WORK              →  grouped sidebar for the active dashboard
```

Backend hierarchy is unchanged: realm → subject → domain → membership → capability → permission.

The new controls are **UX context only**. They never grant membership, domain enrollment, capability, or verification.

## Subject selector (Acting as)

- Visible label: **Acting as**
- Shows display name + Independent / Agency
- Enumerates only subjects already returned by provider-domain context
- Client does not invent subject IDs
- Switching re-resolves authorized domains for that subject
- If the previous dashboard is not authorized (example: Independent Education+Business → Agency Business-only), UI falls back to an authorized workspace
- Preference key remains `strideto-provider-workspace` (localStorage, UX only)

## Active dashboard selector

- Visible label: **Active dashboard**
- Two-domain: Education & Mobility | Business Services (`aria-pressed`, not color-only)
- One-domain: shows the authorized dashboard only — no disabled fake toggle
- One-domain CTA: **+ Add another provider category** (navigates to Provider Dashboard; does not auto-enroll)
- Narrow screens: native select to avoid overflow
- `/agent` (Provider Dashboard) does **not** mark Education or Business as operationally active
- Deep links restore dashboard from the route:
  - `/agent/cases…` → Education
  - `/agent/business-services/cases…` → Business

Switching dashboard is navigation only (no POST/PATCH).

## Education navigation

When Education & Mobility is active:

- **Education & Mobility** — Overview
- **Work** — Student Leads, Clients, Consultations, Cases (`/agent/cases`)
- **Services** — Education & Mobility Services, Marketplace, Availability
- **Trust** — Professional Verification, Reviews

## Business navigation

When Business Services is active:

- **Business Services** — Overview
- **Work** — Requests, Quotes, Cases (`/agent/business-services/cases`)
- **Service Setup** — Capabilities, Jurisdictions, My Services
- **Trust & Eligibility** — Business Verification

Page heading for the GBS workspace remains **Business Formation & Corporate Services**.

Education Cases and Business Cases remain separate routes and datasets.

## Shared navigation

After a divider:

**Account & Support** — Provider Dashboard, Profile, Trust Center, Team (agency/organization subject only), Messages, Notifications, Account Settings, Help

Notification bell is unchanged. Messages and notifications remain shared.

## Route preservation

All existing Agent/GBS routes remain. Navigation labels changed; contracts did not.

`/agent` remains the Provider Dashboard gateway (`?home=1` still valid).

## Security preservation

- Workspace preference is not an ACL input
- Unauthorized Business URL still uses existing GBS setup/add state
- Subject switcher cannot mint Agency membership
- Verification drafts still use `strideto-verification-draft:` (account + subject scoped)
- Tab identity guard still uses `strideto-tab-identity:` (no key collision)
- Single-flight refresh / session hydration unchanged
- No tokens in localStorage/sessionStorage from this refactor

## Responsive behavior

- 320/375: mobile drawer; Acting as + Active dashboard at top; select for two-domain switch
- 768: drawer remains; compact **Business Services** label
- 1024/1440: grouped desktop sidebar (`w-64`)
- Long Agency names: `break-words`
- Native 200% zoom and screen reader: **USER MANUAL**

## Manual QA scenarios

### Education-only

1. Login Education-only Provider
2. Provider Dashboard shows Education workspace (not a disabled Business toggle)
3. Open Education; Work/Services/Trust groups visible
4. Leads → Clients → Consultations → Cases → Services → Verification → Profile/Settings
5. Refresh: same session and Education dashboard
6. Add another provider category visible when the environment allows Business

### Business-only

1. Login Business-only Provider
2. Provider Dashboard shows Business Services
3. Education operational tree absent
4. Requests → Quotes → Cases → Capabilities → Jurisdictions → My Services → Business Verification
5. Refresh: same session and Business dashboard

### Both domains

1. Login both-domain Provider
2. Provider Dashboard shows both workspace cards
3. Active dashboard = Education → Education nav only
4. Switch to Business → Business nav only
5. Switch back; no logout; no enrollment POST
6. Refresh a Business case URL: Active dashboard stays Business

### Independent + Agency

Example: Ameer Independent (Education+Business) and Frontier Agency (Business only)

1. Acting as Ameer → Education and Business available
2. Acting as Frontier → Business only; Education option absent
3. Switch back; data stays subject-scoped

### Parallel same-realm accounts

Use separate browser profiles / InPrivate. Ordinary tabs share the Agent cookie.

## Remaining USER checks

- Native 200% zoom
- Screen reader pass of sidebar groups
- Visual System/Light/Dark 320–1440 matrix
- Live Independent+Agency subject switch
- Verification draft survive Education → Business → Education in the same tab
