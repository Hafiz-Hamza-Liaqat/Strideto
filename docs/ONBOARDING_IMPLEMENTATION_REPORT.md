# Phase B.2 — Onboarding Implementation Report

**Product:** Strideto  
**Phase:** B.2 First-Time User Onboarding & Guided Tour  
**Status:** Complete (awaiting manual review)  
**Date:** 2026-07-24

## Implemented features

### Stage 1 — Login success welcome (SweetAlert2)
- Success icon + SweetAlert success animation
- Title: **Welcome to Strideto!**
- Subtitle: **Every Step Toward Success.**
- Body copy for a ~2-minute product tour
- Primary **Start Tour** (auto-focused) / Secondary **Skip for Now**
- ESC closes; keyboard accessible
- Skip marks onboarding complete (local + optional backend) so the popup does not return unless reset via Help → Product Tour

### Goal selection (optional)
- Shown after welcome, before the Driver.js tour
- Question: *What brings you to Strideto today?*
- Goals: Job, Scholarships, Admissions, Resume, Study Abroad, Career, Employer
- Skip allowed; selection stored client-side and persisted to `User.onboardingGoal` when authenticated
- Used to suggest post-tour landing route

### Stage 2 — Interactive guided tour (Driver.js)
- Highlight + dim overlay, auto-scroll, progress text (`Step X of Y`)
- Mobile-friendly popovers; keyboard / ESC / close
- `prefers-reduced-motion` disables Driver animation/smooth scroll
- Steps: Welcome → Search → Nav → Resume → Dashboard → Career → Employer (conditional) → Notifications → Profile → Final CTAs
- Employer dashboard step only when an employer session is active
- Final CTAs: Explore Opportunities / Build My Resume / Finish

### Persistence
| Audience | Mechanism |
|----------|-----------|
| Guests / client | `localStorage` key `strideto-onboarding-complete=true` (+ user-scoped key when logged in) |
| Logged-in users | `User.onboardingCompleted` + `User.onboardingGoal` via existing `PATCH /auth/profile` (additive fields; no migration required) |
| First-time trigger | `sessionStorage` pending flag set by Login / Register / Employer Login only when not already complete |

### Restart
- Account menu → **Help** → **Product Tour** clears completion flags and restarts (skips welcome, goes to goals → tour)

### Analytics
- Integrated with existing `trackPlatformEvent` (`client/src/utils/platformAnalytics.js`)
- Events: `Tour Started`, `Tour Skipped`, `Tour Completed`, `Goal Selected`, `Resume CTA Clicked`, `Explore CTA Clicked`
- No new analytics provider

### Design
- Primary `#2563EB`, accent `#F97316`
- Manrope / Inter via SweetAlert + Driver theme CSS
- Existing Button patterns mirrored in onboarding CSS classes

## Files changed

### New
- `client/src/onboarding/` — module (`constants`, `storage`, `pending`, `actions`, `analytics`, `goals`, `welcomePopup`, `goalSelection`, `tour`, `TourAnchors`, `OnboardingProvider`, `onboarding.css`, `index`)
- `docs/ONBOARDING_IMPLEMENTATION_REPORT.md` (this file)

### Dependencies
- `sweetalert2`, `driver.js` (client `package.json` / lockfile)

### Modified (client)
- `client/src/main.jsx` — wrap app with `OnboardingProvider`
- `client/src/pages/Auth/Login.jsx` — pending flag + home redirect (replaces legacy `edur_onboarding_done` talent redirect)
- `client/src/pages/Auth/Register.jsx` — pending flag + home redirect
- `client/src/pages/Employer/EmployerLogin.jsx` — pending flag for first employer login
- `client/src/components/layout/Navbar.jsx` — `data-tour="nav"`, `TourAnchors`
- `client/src/components/layout/UserAccountMenu.jsx` — Help / Product Tour, `data-tour="user-profile"`
- `client/src/components/search/GlobalSearch.jsx` — `data-tour="search"`
- `client/src/components/notifications/NotificationBell.jsx` — `data-tour="notifications"`
- `client/src/pages/Employer/EmployerLayout.jsx` — employer tour anchor
- `client/src/i18n/locales/{en,ur,ar}/navbar.json` — Help / Product Tour strings

### Modified (server, additive only)
- `server/src/models/User.js` — `onboardingCompleted`, `onboardingGoal`
- `server/src/controllers/profileController.js` — accept those fields on profile PATCH

## Verification checklist

| Check | Result |
|-------|--------|
| Login success popup only when pending + incomplete | Implemented (session pending + storage/server flag) |
| Tour launches after Start Tour + optional goals | Implemented |
| Skip works and does not re-prompt | Implemented |
| Completion persists (localStorage + profile PATCH) | Implemented |
| Employer-only step conditional | Implemented (`isEmployer`) |
| Help → Product Tour restart | Implemented |
| Mobile layout / scroll / touch (Driver.js) | Implemented (library defaults + CSS) |
| Lint (0 errors) | Pass |
| Production build | Pass |
| No console errors / hydration issues | Not browser-verified in this run — manual QA recommended |
| Screenshots | Not captured in this environment |

## Known limitations

1. **Search step** requires the Home hero `GlobalSearch` (`data-tour="search"`). Tour flow navigates to `/` first.
2. **Notifications** step only appears when `NotificationBell` is mounted (authenticated users).
3. **Dashboard** tour target only when authenticated (TourAnchors link).
4. **Employer accounts** do not use `User.onboardingCompleted` (separate employer model); completion is client-side for employers.
5. **Legacy** `edur_onboarding_done` is migrated into the new complete flag when present for guests.
6. Returning users who never completed onboarding will still see the welcome once on next Login/Register from the default home path until they skip/complete (by design for “first successful login” UX after this ship).

## Future improvements

- Dedicated `PATCH /auth/onboarding` (or employer profile fields) for stronger server authority
- Seed/backfill `onboardingCompleted: true` for existing production users if product wants zero prompts for veterans
- i18n for SweetAlert / Driver copy (currently English strings in onboarding module)
- Wire selected goal into recommendation engines / home personalization
- Optional “Try Resume Builder” mid-tour button that navigates immediately
- Visual QA screenshots on desktop + mobile for design review

## Constraints honored

- No deployment
- No GitHub push
- No breaking API / auth / routing / deploy config changes
- Additive User fields only (no formal migration script; Mongoose defaults apply on write)
- Stopped after Phase B.2 for manual review
