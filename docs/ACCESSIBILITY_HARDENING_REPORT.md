# Phase B.7 — Accessibility Hardening Report

**Product:** Strideto  
**Phase:** B.7 — Accessibility Hardening & Final UX Validation  
**Date:** 2026-07-24  
**Scope:** ESC overlays, skip link, reduced motion, keyboard/focus/ARIA/contrast polish  
**Constraints honored:** No redesign, no features, no API/auth/schema/SEO changes, no deploy/commit/push

---

## Summary

Phase B.7 hardens keyboard and assistive-technology access across Strideto’s client UI. A shared **overlay Escape stack** closes only the top-most dialog/drawer/menu. A **skip-to-content** link lands on `#main-content`. **`prefers-reduced-motion`** is completed for ScrollReveal and global UI animations. Focus traps, ARIA attributes, toast live regions, and placeholder contrast were improved without visual redesign.

---

## Issues found → fixes applied

### 1. ESC key support (P0)

| Issue | Fix |
|-------|-----|
| Many overlays ignored Escape | Added `a11y/overlayStack.js` + `useOverlayA11y` + `EscapeWhen` so one Escape closes the top overlay only; listeners unregister on unmount |
| DrawerMenu no ESC / no focus trap | Wired `useOverlayA11y` |
| Employer mobile nav no ESC | Wired `useOverlayA11y` + `aria-controls` |
| Shared `Modal` no ESC | Wired `useOverlayA11y` + focus trap |
| `AdminConfirmDialog` no ESC | Wired `useOverlayA11y` + focus trap |
| AdminSidebar used local ESC only | Migrated to overlay stack + focus trap |
| MediaAssetPicker / ProfilingWizard / BlockTemplateSaveModal | Migrated to overlay stack / `useOverlayA11y` |
| CookieConsent no ESC | ESC accepts **essential-only** (least-privilege dismiss); not focus-trapped |
| UserAccountMenu / NotificationBell / Navbar mega | Register Escape via overlay stack; mega keyboard open + `aria-expanded` |
| AdminReviewQueue + 22 admin CRUD overlays | `<EscapeWhen>` with existing close handlers |
| AdminRoutePicker list | Escape closes listbox |
| SweetAlert / Driver.js / GlobalSearch | Already OK — left as-is (Swal `allowEscapeKey`, Driver `allowClose`, search input ESC) |

### 2. Skip-to-content

| Issue | Fix |
|-------|-----|
| No skip link; `<main>` lacked id | Added `SkipLink` + `.skip-link` CSS; `MainLayout` and `EmployerLayout` use `<main id="main-content" tabIndex={-1}>` |

### 3. prefers-reduced-motion

| Issue | Fix |
|-------|-----|
| ScrollReveal always animated | Skip IO animation when reduce is set; show content immediately |
| Drawer/overlay/fade Tailwind anims | Extended `@media (prefers-reduced-motion: reduce)` in `index.css` |
| Onboarding / Driver / PB anims | Already handled — retained |

### 4. Keyboard / focus

| Issue | Fix |
|-------|-----|
| No focus trap on modals/drawers | `useOverlayA11y` Tab cycle + restore focus on close |
| Mega menu hover-only | Click/keyboard toggle + ArrowDown + Escape |
| Account / notifications menus | `aria-expanded`, `aria-controls`, Escape |

### 5. Focus visibility

| Issue | Fix |
|-------|-----|
| Global focus already present | Kept `:focus-visible` outline; skip link uses high-contrast focus ring |

### 6. Semantic HTML / landmarks

| Issue | Fix |
|-------|-----|
| Main landmark without id | `id="main-content"` on Main + Employer layouts |
| Drawer/nav labels | Ensured `nav`/`dialog` labels; mega `role="menu"` / `menuitem` |

### 7. ARIA

| Issue | Fix |
|-------|-----|
| Missing expanded/controls on chrome menus | Added on account, notifications, hamburger, mega, employer menu |
| CookieConsent `role="dialog"` without modal semantics | Set `aria-modal="false"` (non-blocking banner) |

### 8. Screen reader / live regions

| Issue | Fix |
|-------|-----|
| Toasts all `role="alert"` | Region `aria-live="polite"`; errors stay `alert`, others `status` |
| Toast dismiss hit target | Close control ≥44px |

### 9. Color contrast (WCAG AA)

| Issue | Fix |
|-------|-----|
| Admin placeholders gray-400 | `placeholder:text-gray-500` / dark `gray-400` |
| Profile placeholders | Same bump |
| GlobalSearch placeholder | `placeholder-gray-600` |
| Primary `#2563EB` / accent `#F97316` on white | Meet AA for large/UI text; no brand color change required |

### 10. Accessibility smoke

| Check | Result |
|-------|--------|
| Client lint | **Pass** — 0 errors (52 pre-existing warnings) |
| Production build | **Pass** |
| Keyboard traps | Focus trap limited to open modals/drawers; Escape always available via stack |
| Landmarks | header / nav / main / footer preserved |

---

## Remaining non-blocking items

1. **Full axe/WAVE automated suite** and physical VoiceOver/NVDA pass not run in this phase.
2. Some **admin form overlays** have Escape but not full focus traps (shared shells do); migrate remaining CRUD to `AdminModalShell` when convenient.
3. **Navbar mega** still closes on mouse leave (desktop pattern); keyboard path is supported.
4. **Cookie banner** ESC chooses essential-only (documented product choice).
5. Occasional **secondary microcopy** (`text-gray-400` at tiny sizes) may remain below AA for non-essential chrome — not changed to avoid visual redesign.
6. **Authenticated SR walkthrough** of dashboard widgets recommended at go-live.

---

## WCAG considerations

Target: **WCAG 2.1 Level AA** for interactive chrome.

| Criterion | Status |
|-----------|--------|
| 2.1.1 Keyboard | Improved — overlays Escape, traps, skip link |
| 2.1.2 No Keyboard Trap | Pass with Escape + Tab cycle |
| 2.4.1 Bypass Blocks | Skip link |
| 2.4.7 Focus Visible | Global `:focus-visible` |
| 2.3.3 Animation from Interactions | Reduced-motion CSS + ScrollReveal |
| 1.4.3 Contrast (Minimum) | Placeholders darkened; brand colors retained |
| 4.1.2 Name, Role, Value | Expanded ARIA on menus/dialogs |

---

## Audits (summary)

### Keyboard
- TAB reaches skip link first, then chrome, then main.
- Escape closes top overlay only (stack).
- Enter/Space activate native buttons/links.
- Modals trap focus; focus returns to trigger.

### Screen reader
- Toasts announce politely (errors assertive).
- Dialogs expose `aria-modal` / labels.
- Form validation patterns unchanged (existing `role="alert"` on errors).

### Reduced motion
- ScrollReveal, drawer/overlay/dropdown/fade, PB anims, onboarding/Driver respect reduce.

### ARIA
- Prefer native controls; added expanded/controls/current where needed; removed over-assertive toast alerts for non-errors.

### Semantic HTML
- `header`, `nav`, `main`, `footer`, `aside` (drawers), `dialog` roles for overlays; skip targets main landmark.

---

## Final accessibility checklist

- [x] Escape closes drawer / employer nav / shared modal / admin confirm / admin CRUD overlays / menus
- [x] Top-most overlay only
- [x] Skip to content → `#main-content`
- [x] `prefers-reduced-motion` for ScrollReveal + UI anims
- [x] Focus trap on primary modals/drawers
- [x] Visible focus rings retained
- [x] Toast live region
- [x] Placeholder contrast bump
- [x] Lint 0 errors
- [x] Production build pass
- [ ] Physical SR lab (NVDA/VoiceOver) — recommended pre-launch
- [ ] Full axe CI gate — optional follow-up

---

## Verification

| Command | Result |
|---------|--------|
| `npm run lint` (client) | **0 errors**, 52 warnings (pre-existing) |
| `npm run build` (client) | **Pass** |

---

## Stop

Phase B.7 complete. No deployment. No Git operations. Await human review before production configuration.
