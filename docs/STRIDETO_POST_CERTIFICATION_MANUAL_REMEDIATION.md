# Strideto — Post-Certification Pre-Push Manual Remediation

**Status:** COMPLETE (source remediation)  
**Baseline HEAD:** `5ff6ae0` (Phase-14 / Mission 27 certification — HISTORICAL)  
**Branch:** `main`  
**Runtime target:** `https://localhost:8443`  
**Worker:** remains STOPPED  
**Push / deployment:** NOT performed  

## Purpose

After Phase-14 CONDITIONAL GO, manual QA found defects and authority/UX gaps that automated acceptance did not fully detect. This mission closes those defects with shared-foundation-first fixes. It is **not** Phase 15 and **not** launch certification of the new HEAD.

**NEW HEAD REQUIRES MANUAL ACCEPTANCE + RE-CERTIFICATION.**

Previous Phase-14 certification remains evidence for the prior candidate only.

## Pre-flight / WIP isolation

| Item | Result |
|------|--------|
| Starting HEAD | `5ff6ae0` |
| Unexpected tracked WIP | `FormField.jsx` (1-line aria-invalid) — path-scoped stash, excluded |
| Known Admin WIP | `AdminDataTable.jsx` + `AdminTableFilters.jsx` — path-scoped stash, excluded |
| Protected untracked | `docker-compose.appenv-align.yml`, prior audit/report docs — untouched |
| Remediation baseline | Clean match to `5ff6ae0` before edits |

## Track summary

### Shared platform
| Track | Outcome |
|-------|---------|
| A Navigation / scroll | `ScrollManager` — PUSH/REPLACE top; POP restore; hash target; search-only no reset. Contract test passed. |
| B HTTP 202 | Audit: no student dashboard GET returns 202. See `docs/HTTP_202_STUDENT_DASHBOARD_AUDIT.md`. Internal user IDs not restored in avatar menus. |
| C Skip link | Clip/sr-only until keyboard focus. |
| D Form system | Shared `controlClasses`, PasswordInput; **FormField.jsx not modified** (WIP preserved). |
| E Location | `shared/international/location.js` + CountrySelect + LocationFields. |
| F Phone | PhoneInput + dial-code helpers in `shared/international/phone.js`. |
| G Password recovery | Employer/Agent/Institution forgot+reset UI + server routes; generic responses; hashed tokens; worker not activated. |
| H Welcome | Portal welcome banner — first next-action once; welcome-back once per session. |
| I / AQ Announcements | One Announcement model + user state; admin manage; role feed; audience targeting; survey type supported. |
| X Logo | Auto tone uses theme (light mark on dark). |

### International / discovery / public
| Track | Outcome |
|-------|---------|
| J Jobs | Country → region → city facets; no hidden PK default; PK provinces only when country=PK. |
| K Taxonomy | `jobTaxonomy.js` + Job.jobFamily/specialization; employer authoring selectors. |
| L Program Explorer | Country facets from published programs. |
| M Apply CTAs | Primary internal / secondary external button CTAs. |
| N Career Guidance | Professionalized; PK salary not global default. |
| O Help/Legal/Sitemap | `PublicInfoPage` applied to help, support, privacy, terms, cookies, disclaimer, refund, sitemap. |
| P Newsletter | Truthful subscribe; delivery not claimed when not configured. |
| Q/R/S Agents public | Directory/detail/marketplace purpose polish; fixture exclusion doc. |

### Student
| Track | Outcome |
|-------|---------|
| T Copilot | Gap labels fixed; no `undefined:`; grounding downgrades when incomplete. |
| U Applications | Student cannot set employer pipeline; read-only + withdraw; external limited. |
| AU | No autonomous AI added. |

### Employer / Agent / Institution
| Track | Outcome |
|-------|---------|
| V/AR Entitlement | Server-derived free_quota / paid_product / not_configured snapshot on review + Plans & Usage. |
| W Employer forms | International location + taxonomy on job authoring. |
| Y Agent onboarding | Six real stages; finish → `/agent/verification`; no false under_review. |
| Z/AC Profile/Availability | Theme-aware controls; multi-selects; IANA timezone (no silent Karachi). |
| AB Marketplace draft | ObjectId/ISO validation → 422; client ISO checks. |
| AD Commerce | Truthful free/not_configured only. |
| AE–AN Institution | Forms, gate, guidelines, settings, billing, usage pipeline, dashboard, notification bell mount. |
| AH Claim | ObjectId guard + searchable picker. |
| AI Publishing gate | UI lock + reason codes; server dual-gate retained. |

### Verification / Admin
| Track | Outcome |
|-------|---------|
| AA/AS Evidence policy | Website/Maps cannot mint unrelated VERIFIED badges; admin UI shows policy. Tests: 9 checks. |
| AO Sidebar scroll | scrollTop persistence + nearest active item. |
| AP | No portal dashboard impersonation added. |
| AV | Live providers remain off. |

## Tests run (focused)

- `server/src/__tests__/copilotGapSummary.test.js` — pass
- `server/src/__tests__/applicationAuthority.test.js` — pass
- `server/src/__tests__/verificationEvidencePolicy.test.js` — 9 checks pass
- `client/src/__tests__/scrollManagerContract.test.js` — 13 assertions pass
- `client/src/__tests__/postCertificationRemediationContract.test.js` — 30 assertions pass

## Residuals / unresolved (for user manual QA)

1. Scheduled announcement auto-publish cron not added (manual publish works).
2. Marketplace source-backed advanced mode still needs a full canonical **picker** UX (free-text IDs restricted/validated).
3. Full Docker rebuild/browser multi-role runtime pass deferred to **user manual acceptance**.
4. ar/ur i18n for new strings may fall back to English.
5. Legacy Admin broadcast notifications coexist with new Announcements system.

## Certification statement

Previous Phase-14 certification applies to previous candidate (`5ff6ae0` era product candidate) only.  
**New HEAD is NOT launch-certified yet.**

## NEXT

1. USER MANUAL ACCEPTANCE OF ALL ROLES  
2. Narrow defect closure if needed  
3. Only after explicit approval: final re-certification against new HEAD  
4. Only after explicit approval: push / deployment  

---

## Follow-up addendum — AdminConfirmDialog (post-report)

**Discovered after:** initial remediation report commit `ab638be`  
**Scope:** narrow UX confirmation footgun only — no change to server authorization, financial/trust authority, moderation permissions, or audit behavior.

### Defect

`AdminConfirmDialog` defaulted to `open = true`. Callers that omitted `open` (while relying on conditional mount) were safe only by accident; any accidental mount without `open` would render a confirmation overlay immediately. That violated controlled-component semantics.

### Affected call sites repaired

- `AdminCommerceCenter.jsx` — manual review dialog (now `open` under `{actionRow && …}`)
- `AdminTrustCenter.jsx` — update report dialog; resolve dispute dialog (same pattern)

### Fix

- Default changed to `open = false` in `AdminConfirmDialog.jsx`
- Commerce/Trust callers that conditionally mount now pass `open` explicitly
- Full call-site audit: **22** usages; **0** remaining implicit-open callers

### Focused evidence

- `client/src/__tests__/adminConfirmDialogContract.test.js` — 15 assertions; 22 sites audited
- ESLint on the three dialog source files: clean

### Remediation candidate HEAD after this follow-up

See documentation commit that records this addendum (HEAD after both follow-up commits).

Phase-14 certification remains historical evidence for the prior candidate only.  
**New HEAD still requires USER MANUAL ACCEPTANCE + re-certification.**

---

## Follow-up addendum — Announcements API startup (Docker)

**Discovered after:** AdminConfirmDialog follow-up HEAD `982c00c`  
**Symptom:** After rebuilding `api-a` / `api-b`, both replicas crash-looped (`Restarting (1)`). Caddy had no healthy upstream → `POST /api/auth/login` returned **502 Bad Gateway**.

### Exact error

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/app/utils/asyncHandler.js'
imported from '/app/src/controllers/announcementsController.js'
```

### Root cause

`server/src/controllers/announcementsController.js` used `../../utils|models|services/...`, which escapes `src/` to `/app/utils/...`. Peer controllers under `src/controllers/` correctly use `../utils/...`. Admin nested controllers under `src/controllers/admin/` correctly keep `../../utils/...`.

### Fix

Corrected all three imports in `announcementsController.js` to `../…`. No business-scope changes. No other Announcements-chain import defects found after audit.

### Real-runtime result (api rebuild only)

- `api-a` / `api-b`: Up (healthy)
- Mongo / Redis / frontend / media: preserved / not rebuilt for this fix
- Worker: remains stopped
- `/api/health` + readiness: 200
- `/api/auth/login`: reaches backend (**502 resolved**; unauthenticated/origin checks return 401/403 as appropriate — not gateway failure)
- `/api/announcements/feed` + `/api/admin/announcements`: **401 Authentication required** (not route 404)
- `/admin/announcements` SPA: 200

### Focused evidence

- `server/src/__tests__/announcementsStartupWiring.test.js` — 20 assertions
- `scripts/verify-module-link-integrity.mjs` — module graph links cleanly
- ESLint on touched controller/test — clean

### Candidate HEAD

See documentation commit that records this addendum.

Phase-14 certification remains historical only.  
**New HEAD is NOT launch-certified.**
