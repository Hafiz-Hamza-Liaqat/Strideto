# Phase E.1F-A — Public Navbar Responsiveness Report

**Date:** 2026-07-27  
**Scope:** Public navbar hierarchy, TourAnchors containment, account menu, mobile drawer, MainLayout overflow.  
**Preserved:** E.1F-B auth realm gating; E.1F-C Post Job form (untouched).

---

## State matrix

| State | Primary (lg+) | More menu | Bell | Account | Drawer (&lt;lg) |
|-------|---------------|-----------|------|---------|-----------------|
| Guest | Home…Exam Prep | Blog, Contact, Resume, Career | Hidden | Login/Register/Forgot + Employer login | Full destinations |
| User | Same | + Dashboard | Shown* | User links + logout | + Dashboard section |
| Employer-only (public shell) | Same | + Employer → `/employer` | Hidden on employer routes* | Employer dashboard + employer logout | + Employer section |
| User + employer | Same | + Dashboard + Employer | Shown on public* | Both account sections | Both |
| Staff/admin | Same | + Dashboard | Shown* | + Admin link | + Dashboard |
| `/employer/login` \| `register` | Same (MainLayout) | Same | **No** user APIs (E.1F-B) | Guest-style + employer login link | Same |
| `/employer/:slug` public | Same | Same | User rules if user session | Same | Same |
| RTL | `start`/`end` logical classes | `end-0` menus | Same | `end-0` panel | Drawer `end-0` |

\*NotificationBell / talent summary remain gated by `useUserNavbarSession` (E.1F-B): disabled on employer portal and employer auth pages.

Employer dashboard link target: **`/employer`** (not `/employer/dashboard`).

---

## Hierarchy

**Wide desktop (`lg+`):** core primary links + **More** (Blog, Contact, Resume, Career Guidance, session links).  
**Reserved `shrink-0`:** logo, notification, account, hamburger.  
**Nav:** `min-w-0 flex-1` center.  
**&lt;lg:** hamburger only; no TourAnchors strip; drawer holds all destinations.

---

## Overflow / MainLayout

- Removed `overflow-x-hidden` from `MainLayout` root.
- Shell uses `min-w-0` / `max-w-full` on main.
- No `body { overflow-x: hidden }`.
- TourAnchors no longer use `overflow-x-auto` / `max-w-[42vw]` visible strip.

---

## TourAnchors

Invisible zero-footprint DOM anchors (`data-tour=*`) for Driver.js. Tour already falls back to centered cards when anchors are not highlightable (`tour.js`). Visible destinations live in More + drawer (and still carry `data-tour` where applicable).

---

## Account menu

- `end-0` alignment (RTL-safe), viewport-capped width.
- `useOverlayA11y` Escape + focus trap + focus restore.
- Outside click closes.
- Employer section when employer session exists.
- Talent summary still gated by `showUserSession` (E.1F-B).

---

## Mobile drawer

- `aria-expanded` / `aria-controls` on hamburger → `#mobile-drawer`.
- Focus trap, Escape, body scroll lock, close on navigate/link.
- Education submenu keyboard-accessible; `aria-current` on routes.
- Touch targets ≥44px; drawer uses logical `end` edge.

---

## Route consistency

Verified against `ROUTES`: Education mega (schools, intl scholarships, foreign), Exam Prep, Resume, Career Guidance, Dashboard, Employer `/employer`, Blog, Contact.

---

## Tests

```bash
node server/src/__tests__/navbarHierarchy.test.js
```

Also re-run `authRealm.test.js` to confirm E.1F-B gates unchanged.

---

## Files changed

| File | Change |
|------|--------|
| `client/src/components/layout/navConfig.js` | **New** primary/secondary/drawer config |
| `client/src/components/layout/Navbar.jsx` | Hierarchy, More menu, flex containment |
| `client/src/components/layout/DrawerMenu.jsx` | Full destinations, account section, a11y |
| `client/src/onboarding/TourAnchors.jsx` | Non-layout tour anchors |
| `client/src/layouts/MainLayout.jsx` | Remove overflow-x-hidden |
| `client/src/components/layout/UserAccountMenu.jsx` | RTL, focus a11y, employer actions |
| `client/src/i18n/locales/{en,ur,ar}/navbar.json` | `more`, employer labels |
| `server/src/__tests__/navbarHierarchy.test.js` | **New** |
| `docs/EMPLOYER_PORTAL_NAVBAR_AND_SOCIAL_AUDIT.md` | E.1F-A marked implemented |
| `docs/PUBLIC_NAVBAR_RESPONSIVENESS_REPORT.md` | This report |

---

## Remaining gaps (out of scope)

- E.1F-D application visibility  
- E.1F-E dashboard/settings  
- E.1F-F social URLs  
- Optional visual QA at every listed viewport after deploy  

---

## Final verdict

```
READY FOR APPLICATION-FLOW IMPLEMENTATION
```

*No commit, push, or deploy.*
