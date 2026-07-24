# Phase B.3 — Brand & Onboarding Enhancement Report

**Product:** Strideto  
**Phase:** B.3 Logo Refinement & Intelligent First-Time User Profiling  
**Status:** Complete (awaiting manual review)  
**Date:** 2026-07-24

## Logo design rationale

The previous mark used a thin curved stroke plus a separate corner arrow. At favicon size it read as a generic “path + arrow,” not clearly as an **S**.

The B.3 mark keeps flat SaaS geometry (rounded square, no gradients/shadows/3D) and rebuilds the icon as:

1. **Letterform-first S** — a continuous rounded stroke that remains recognizable at 16×16  
2. **Integrated arrow terminal** — the top-right of the S ends in an L-shaped up/forward terminal (momentum without a dominating standalone arrow)  
3. **Step accents** — two short orange (`#F97316`) bars on the S spine for *Every Step Toward Success.* / growth / opportunity  

Meaning: career journey, forward progress, learning steps — without briefcases, caps, magnifiers, or bridges.

## Assets created / replaced

### SVG (source of truth)
| Asset | Path |
|-------|------|
| Primary lockup | `client/public/branding/logo.svg` |
| Light lockup | `client/public/branding/logo-light.svg` |
| Dark lockup | `client/public/branding/logo-dark.svg` |
| Symbol | `client/public/branding/logo-symbol.svg` |
| Wordmark | `client/public/branding/wordmark.svg` |
| Favicon SVG | `client/public/favicon.svg`, `client/public/branding/favicon.svg` |
| Favicon 16 SVG | `client/public/branding/favicon-16.svg` |
| Mask / Safari | `client/public/branding/mask-icon.svg`, `client/public/safari-pinned-tab.svg` |
| Social / email / OG SVG | `social-logo.svg`, `email-logo.svg`, `og-logo.svg` |

### Raster / PWA (generated)
| Asset | Path |
|-------|------|
| `favicon.ico` | `client/public/favicon.ico` |
| Favicon PNG | `favicon-16.png`, `favicon-32.png` |
| Apple touch | `apple-touch-icon.png` |
| Android / PWA | `icons/icon-48.png`, `icon-192.png`, `icon-512.png` |
| App icon source | `branding/app-icon-source.png` (1024) |
| OG / social / feature / splash / email | under `branding/` + root `og-image.png` |

Regenerate rasters:

```bash
cd client && node scripts/generate-brand-assets.mjs
```

## User profiling flow

Order after successful first login/signup:

1. **Welcome** (SweetAlert2 — Phase B.2)  
2. **Profiling wizard** (new, optional, LinkedIn-style)  
3. **Guided tour** (Driver.js) — unless user chooses **Explore Platform**

### Wizard screens
1. Welcome / personalize  
2. Persona  
3. Looking for (multi)  
4. Education level  
5. Field of interest (searchable multi)  
6. Preferred location (multi)  
7. Experience  
8. Career goal (single → maps to tour landing goal)  
9. Notification preferences  
10. You’re all set → **Start Guided Tour** / **Explore Platform**

Skip any step; ESC / × exits wizard and continues to tour. Progress indicator + reduced-motion support.

### Preference model (future recommendations)

`client/src/preferences/careerPreferences.js` exports:

- `createEmptyCareerPreferences` / `normalizeCareerPreferences`  
- `getRecommendationSignals` — hook for homepage, jobs, scholarships, articles, notifications, email  
- localStorage helpers  

**No recommendation engine in this phase** — data preparation only.

## Profile fields added (additive)

| Field | Location | Notes |
|-------|----------|--------|
| `careerPreferences` | `User` (Mixed) | Full preference object |
| Existing | `onboardingCompleted`, `onboardingGoal` | Unchanged; goal derived from career goal |
| Legacy mirror | `interests`, `province` | Best-effort sync from looking-for / locations |

`PATCH /auth/profile` accepts `careerPreferences` without breaking existing clients.

## Files changed (high level)

- Brand SVGs + generated PNGs/ICO under `client/public/`  
- `client/scripts/generate-brand-assets.mjs`  
- `client/src/design-system/brand.js`  
- `client/src/preferences/*`  
- `client/src/onboarding/ProfilingWizard.jsx` + CSS  
- `client/src/onboarding/OnboardingProvider.jsx`  
- `server/src/models/User.js`, `profileController.js`  
- This report

## Verification results

| Check | Result |
|-------|--------|
| Lint (0 errors) | Pass |
| Production build | Pass (`vite build`) |
| Logo SVG suite present | Pass |
| Favicon / PWA / OG rasters generated | Pass |
| Wizard after welcome, before tour | Implemented |
| Skip / ESC | Implemented |
| Preferences persist (local + profile PATCH) | Implemented |
| Tour after wizard / Explore skips tour | Implemented |
| Browser visual QA / console | Manual follow-up |

## Manual follow-up tasks

1. Hard-refresh browser (or clear cache) to confirm new favicons  
2. Spot-check Navbar light/dark lockups and footer dark logo  
3. Run first-time login: Welcome → Wizard → Tour  
4. Confirm `careerPreferences` on user document after setup  
5. Optional: designer polish of OG/email PNG composition before campaigns  
6. Optional: add `sharp`/`to-ico` as official `devDependencies` if the generate script should run in CI  

## Constraints honored

- No deployment / no GitHub push  
- No auth / routing / deploy config changes  
- Additive profile fields only  
- Stopped after Phase B.3 for manual review
