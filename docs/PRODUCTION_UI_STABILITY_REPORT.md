# Phase D.6 — Production UI Stability Report

**Date:** 2026-07-26  
**Scope:** Homepage CMS flash, resume preview viewport, onboarding responsiveness, HTTP status review  
**Deploy / commit / push:** Not performed (per phase instructions)

---

## Final verdict

**READY FOR MANUAL REVIEW**

---

## Issue 1 — Homepage fallback/theme flash

### Root cause

`SiteContentProvider` fetched CMS via Context + `useEffect`, with `homepage` starting as `null` and `loading: true`. Consumers (`Home`, header nav, footer) **never gated on `loading`**. While `homepage` was null they immediately rendered i18n/hardcoded fallbacks — notably hero title **“Every Step Toward Success.”** and default orange CTAs. When the published CMS response arrived, the UI swapped to the admin hero, causing a visible flash and layout shift.

Loading path (unchanged architecture):

| Surface | Loader |
|---------|--------|
| Homepage / banners / header / footer nav | `SiteContentContext` (not React Query) |
| Featured jobs / scholarships / admissions | Local `useEffect` + listing APIs |

### Loading / fallback strategy (implemented)

1. **Initial state:** branded `HomeHeroSkeleton` (fixed `min-height: 28rem`, primary gradient) — not i18n fallback copy.
2. **`hasResolved` gate:** hero, banners, CMS-driven body sections, header nav, and footer columns wait until the initial CMS batch settles.
3. **Success:** render configured homepage once; background/lang refetch keeps prior valid CMS in `cacheRef` and does not re-show the skeleton.
4. **Failure / empty / timeout (10s):** after resolve, i18n/hardcoded fallbacks may appear (same as before, but only post-settle). Request failures reuse last good cached CMS when available.
5. **No blank white screen:** skeleton uses brand gradient; navbar/footer show pulse shells.

### Files changed (Issue 1)

- `client/src/context/SiteContentContext.jsx`
- `client/src/components/home/HomeHeroSkeleton.jsx` *(new)*
- `client/src/pages/Home/Home.jsx`
- `client/src/hooks/useHeaderNavItems.js`
- `client/src/components/layout/Navbar.jsx`
- `client/src/components/layout/Footer.jsx`
- `client/src/components/layout/DrawerMenu.jsx` *(loading shell)*

---

## Issue 2 — Resume Builder preview viewport

### Approach

- Keep `ResumeDocument` at true **210mm × 297mm** and keep PDF capture on `.resume-preview` via `html2canvas` + `jsPDF` A4 (unchanged).
- Screen-only: `ResumePreview` scales with `ResizeObserver`, sets a viewport height from `scrollHeight * scale` (replacing fragile negative margin), removes conflicting `max-width: 100%` on `.resume-preview-scale`.
- Layout: mobile stacks editor then preview; `lg` uses balanced two columns; `xl` restores 3/5–2/5; sticky preview from `lg` with capped scroll height (`min(85vh, 900px)`).

### Files changed (Issue 2)

- `client/src/pages/ResumeBuilder/ResumePreview.jsx`
- `client/src/pages/ResumeBuilder/ResumeBuilder.jsx`
- `client/src/index.css`

### Export regression

| Invariant | Status |
|-----------|--------|
| Capture selector `.resume-preview` | Unchanged |
| Off-screen clone + html2canvas scale 2 | Unchanged |
| `jsPDF('p', 'mm', 'a4')` + multi-page slice | Unchanged |
| Document width/minHeight 210mm/297mm | Unchanged |
| No new PDF library | Confirmed |

---

## Issue 3 — First-time onboarding responsiveness

### Fixes

- **SweetAlert welcome:** viewport-constrained width, safe-area padding, smaller title clamp, stacked full-width actions under 420px.
- **Goal picker CSS:** one column under 420px, `text-align: start`, scrollable grid (legacy path retained).
- **Profiling wizard:** `90dvh`, safe-area overlay, scrollable body + sticky action footer, close control 44×44 with `inset-inline-end`, chip/grid RTL-safe, stacked buttons on narrow screens.
- **Driver.js:** `min-width: 0`, max-width with safe-area, 44px nav/close, wrapping footer, stacked final CTAs; `scrollIntoView` on highlight; visibility-aware steps (centered card if anchor not highlightable).
- **TourAnchors:** visible on small screens (compact, scrollable) so resume/career targets exist below `lg`.
- **Employer-only step:** still gated on `isEmployer`; completion preferences untouched.

### Files changed (Issue 3)

- `client/src/onboarding/onboarding.css`
- `client/src/onboarding/profilingWizard.css`
- `client/src/onboarding/tour.js`
- `client/src/onboarding/TourAnchors.jsx`

---

## Issue 4 — Production request status review

### Findings

- CORS preflight **OPTIONS → 204** is expected and correct.
- Axios default `validateStatus` accepts **all 2xx** (200/201/202/204). Response interceptor returns `res` on success with no `status === 200` gate.
- Spot-checked core services: no `status === 200` success filters.
- Cached assets **304** are handled by the browser/CDN; not treated as client errors.

### Code change

**None.** No status-handling bug found; HTTP semantics left unchanged.

---

## Breakpoints / zoom (validation notes)

Automated browser matrix against live production was **not** used to certify these fixes (code is local/uncommitted; production still serves prior bundles).

| Check | Method | Result |
|-------|--------|--------|
| 320–1440 layout rules | Code review of CSS/grid/clamps | Implemented |
| Zoom 125/150/200 | Driver/Swal `min-width: 0` + `max-width: calc(100vw - …)` | Implemented |
| RTL/Urdu/Arabic | Logical properties + `[dir=rtl]` overrides | Implemented |
| Homepage no fallback flash | Static verify + source gate on `hasResolved` | Pass |
| Resume PDF A4 | Static assert capture path unchanged | Pass |
| Focused verify script | `node scripts/verify-production-ui-stability.mjs` | **19/19 pass** |
| Client lint | `npm run lint --prefix client` | **Pass** (existing warnings only) |
| Client production build | `npm run build --prefix client` | **Pass** (~12.7s) |

**Manual review should confirm on a preview/staging build:**

- Homepage: skeleton → CMS hero once (no “Every Step…” flash on success)
- Failure path: stop CMS / throttle → fallback after settle/timeout
- `/resume-builder` at 320, 375, 414, 768, 1024, 1280, 1440 + zoom
- Onboarding welcome → wizard → tour at 375 + RTL; employer step still employer-only
- PDF download still full A4

---

## Lint / build / test results

| Command | Result |
|---------|--------|
| `node scripts/verify-production-ui-stability.mjs` | Pass (19 checks) |
| `npm run lint --prefix client` | Pass (exit 0; pre-existing warnings ≤100) |
| `npm run build --prefix client` | Pass |

Client package has no Jest/Vitest runner; focused checks use the repo’s `scripts/verify-*.mjs` pattern.

---

## Remaining limitations

1. **Live production** still shows the old flash until this build is deployed.
2. Hero skeleton approximates height (`min-height: 28rem`); unusually tall CMS heroes with many stats may still shift slightly after paint.
3. Tour anchors on very narrow widths may truncate labels (`max-[360px]:hidden` for career); those steps fall back to centered popovers.
4. Sticky resume preview from `lg` can feel tall on short landscape viewports; capped by `max-height: min(85vh, 900px)`.
5. Onboarding copy remains largely English; RTL layout is fixed, full i18n of tour/wizard strings is out of scope.
6. Known multi-page PDF slice edge-case (line duplication at breaks) is pre-existing and untouched.

---

## All files touched

- `client/src/context/SiteContentContext.jsx`
- `client/src/components/home/HomeHeroSkeleton.jsx`
- `client/src/pages/Home/Home.jsx`
- `client/src/hooks/useHeaderNavItems.js`
- `client/src/components/layout/Navbar.jsx`
- `client/src/components/layout/Footer.jsx`
- `client/src/components/layout/DrawerMenu.jsx`
- `client/src/pages/ResumeBuilder/ResumePreview.jsx`
- `client/src/pages/ResumeBuilder/ResumeBuilder.jsx`
- `client/src/index.css`
- `client/src/onboarding/onboarding.css`
- `client/src/onboarding/profilingWizard.css`
- `client/src/onboarding/tour.js`
- `client/src/onboarding/TourAnchors.jsx`
- `scripts/verify-production-ui-stability.mjs`
- `docs/PRODUCTION_UI_STABILITY_REPORT.md`
