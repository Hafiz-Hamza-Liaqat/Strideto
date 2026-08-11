# Strideto Phase 11 — UI / Accessibility / International Acceptance

> **Status:** FROZEN  
> **Baseline after Phase 10 freeze:** `0066e2f`  
> **Authority:** [STRIDETO_FINAL_FROZEN_MODIFICATION_ROADMAP.md](STRIDETO_FINAL_FROZEN_MODIFICATION_ROADMAP.md)  
> **Phase 0–10:** FROZEN (not redesigned)  
> **This phase owns:** visual consistency, theme, route-shell, responsive behavior, accessibility, zoom, keyboard/focus, account-menu usability, international text/layout robustness  
> **Later phases** own security/devops/scalability (12) and deployment/provider activation (13–14). They may not reopen frozen portals or product workflows.

Runtime at `https://localhost:8443` (Docker `edurozgaar-staging` + SEC-3F Caddy + local `appenv-align`). Worker **stopped**. Local rebuild of **frontend only**. Mongo/Redis/media volumes preserved. No `down -v`, no volume prune, no push, no deploy. No live Stripe, no real email/SMS/push.

Pre-Phase-11 AdminTableFilters WIP was isolated in named stash `wip: AdminTableFilters values wiring (pre-phase-11)` (`AdminDataTable.jsx`, `AdminTableFilters.jsx` only; no `-u`). Restored unstaged after freeze. Protected untracked files untouched.

---

## Final global vs Student shell hierarchy

Classification is an **explicit Student-workspace allowlist** (`client/src/config/studentWorkspacePaths.js`), not a denylist and not a string-prefix accident.

| Shell | When shown |
| --- | --- |
| Global Strideto navbar | Always (public + authenticated) |
| Authenticated avatar / notifications | When a Student session exists |
| Student workspace nav (`aria-label="Student portal"`) | Authenticated **and** path matches a workspace prefix |

**PUBLIC (no Student workspace nav), including logged-in Students:** `/`, `/jobs`, `/jobs/*`, `/internships`, `/scholarships`, `/admissions`, `/program-explorer`, `/tests`, `/agents`, `/agents/*`, `/services`, `/help-center`, `/sitemap`, public legal.

**STUDENT WORKSPACE:** `/dashboard`, `/talent-profile`, `/applications`, `/applications/*`, `/journey`, `/journey/*`, `/vault`, `/consultations`, `/consultations/*`, `/cases`, `/cases/*`, `/messages`, `/notifications`, `/budget`, `/copilot`, `/account/*`, `/profile`, `/help/student`.

**Slash-boundary:** `/agents` (public directory) is not `/agent` (private Agent realm). `/employer`, `/institution`, `/admin`, `/agent/*` never receive Student workspace nav.

Runtime: logged-in Home and `/agents` → `studentNav: false`. `/dashboard`, `/copilot`, `/cases`, `/consultations`, `/applications` → `studentNav: true`.

---

## Student workspace navigation

`StudentPortalNav` no longer uses `overflow-x-auto` / `w-max`. Destinations are unchanged (`STUDENT_PORTAL_NAV`).

- **≥1200px:** core links (Dashboard, Talent Profile, My Applications, Journey, Vault, Notifications) + named **More** overflow.
- **&lt;1200px:** named **Workspace** menu holds the full destination list.
- Active route: `aria-current="page"`.
- Overflow: `role="menu"`, unique `aria-controls` ids, Escape via `useOverlayA11y` (no focus trap), outside `mousedown` closes.
- Mobile Workspace panel `align="start"` so it stays in-viewport at 320 (measured `l:12 r:268` in a 320 CSS viewport). Desktop More remains `align="end"`.
- Native horizontal scrollbar: **none**. Page overflow on workspace routes at 320/200%: **0**.

---

## Account menu

`UserAccountMenu` is a named `role="dialog"` (`aria-label="Account menu"`).

| Group | Contents |
| --- | --- |
| IDENTITY | Display name, optional talent headline, email. **No internal user `_id`.** |
| WORKSPACE | My Workspace, Talent Profile, My Applications |
| ACCOUNT | Profile, Privacy, Account settings |
| PREFERENCES | Appearance System / Light / Dark; Language EN / UR / AR(disabled) |
| HELP | Student Help, Product Tour, Help Center |
| SESSION | **Logout** in a sticky footer |

Logout calls Phase-1 `authApi.logout()` / `clearAuth()`, then `navigate(HOME)`. Runtime: Logout from dashboard → `/`; `/dashboard` then redirected to `/auth/login`. Re-login restored the session. `edurozgaar-theme=dark` survived logout/login.

Viewport: panel is `fixed inset-x-2` below `sm`, `absolute end-0 w-80` from `sm`. At 320 after the rebuild: panel `l:8 r:312`, Logout visible (`bottom 563 / vh 720`), dark panel `rgb(31, 41, 55)`.

Keyboard: `aria-expanded`, Escape, focus trap, outside click.

---

## Theme preference

Single frozen provider (`ThemeContext` + `BrandProvider`).

- Preferences: `system` | `light` | `dark` in `localStorage` key `edurozgaar-theme`.
- `system` follows `prefers-color-scheme`.
- `html` class is the **resolved** `light` or `dark`. Brand tokens: `semanticCssVarsForTheme(appliedTheme)`.
- Persistence is client-side (not a server account preference). Survives navigation, public ↔ Student, reload, and logout/login on this runtime.

---

## Dark-mode closure (targeted pages)

Shared surfaces: `client/src/design-system/surfaceClasses.js` (`ui.card`, `ui.filterPanel`, `ui.empty`, `ui.input`, buttons, badges).

| Page | Runtime (Dark selected) |
| --- | --- |
| `/copilot` | Semantic CSS vars; page `rgb(15,23,42)`; form `rgb(30,41,59)`; Ask Strideto remains |
| `/cases` | Empty/card `rgb(31,41,55)`; workspace nav present |
| `/consultations` | Empty/card `rgb(31,41,55)`; workspace nav present |
| `/agents` | Public shell only; filter/cards `rgb(31,41,55)`; approved-only copy retained |
| Account menu | Panel `rgb(31, 41, 55)`; Dark `aria-pressed` |

Light pages remain readable via paired `dark:` / semantic tokens. No second theme store.

---

## Known MINOR closure

| Defect | Closure |
| --- | --- |
| Admin actions-column empty name | `AdminVerificationQueue` column `label: 'Actions'` |
| TourAnchors in a11y tree | Decorative `span`s, `aria-hidden` + `inert`, no `Link` |
| Public ~61px 200% overflow | `MainLayout` `overflow-x-hidden` + removal of workspace `w-max`; Home/Agents/Copilot/Cases/Consultations/Applications measured overflow **0** at 720 CSS / dpr 2 |
| Institution Program select at 320 | `fieldClass` / select `min-w-0 max-w-full` + `title` |
| Student dense grids | Kanban/table keep internal `overflow-x-auto`; page overflow 0 |
| 429 login UX | Login (and Employer/Agent/Institution login) map 429 → `validation:tooManyRequests`. Limiter policy unchanged (Phase 12) |

---

## Accessibility

- Global nav: `navbar:mainNav`. Mobile: named Open menu, expanded state, Escape.
- Student nav: distinct landmark `Student portal`. Overflow named More/Workspace.
- Avatar: named, expanded, dialog semantics, Logout named.
- Forms on modified pages: labels on Agent filters, login Email/Password, Copilot Ask action.
- Focus: `focus-visible:ring-2 focus-visible:ring-primary` on nav/menu/appearance.
- Contrast (Dark, not a WCAG certification): body/card `gray-100` on `gray-800/900`; muted `gray-400`; links `blue-300`; error/warning/success semantic tokens; account panel `rgb(31,41,55)` with white/gray text.

---

## Responsive matrix (runtime)

| Width | Public Home (logged in) | Student dashboard | Overflow |
| --- | --- | --- | --- |
| 320 | Global + hamburger; no Student nav | Workspace menu; all destinations; menu in-view | 0 |
| 375 | same | Workspace | 0 |
| 768 | hamburger | Workspace | 0 |
| 1024 | hamburger | Workspace | 0 |
| 1440 | inline global nav (hamburger `display:none`) | Core + More | 0 |
| 200% (720 CSS / dpr 2) | hamburger; no Student nav | Workspace | 0 on Home, Agents, Dashboard, Copilot, Cases, Consultations, Applications |

---

## International / long content

- Unicode Student name `آمنہ Khan — LongNameForLayoutTest` and long email wrap in the account menu (`break-words` / `break-all`).
- Long Agent names (Unicode `پروفیشنل`) visible on `/agents`.
- Urdu: `dir=rtl`, `lang=ur`, chrome/footer/account strings translated. AR remains **disabled** (`arabicComingSoon`).
- RTL **is supported for Urdu** (and would apply to AR if enabled). Locale URL prefixes exist only for public discovery; private Student/org paths are **not** prefixed (`localizedPathFor` + `isPrivateSeoPath`) so language switch does not 404 `/ur/applications`.

---

## Real runtime evidence

Student fixture (local only): Unicode name, verified email.

Journey:

1. Login as Student → Home: global nav only, Dark retained.  
2. `/agents`: global nav only; Dark filter/cards; approved-only.  
3. `/dashboard`: Student workspace nav.  
4. Avatar: Identity / Workspace / Account / Appearance / Language / Help / Logout.  
5. Dark → `/copilot`, `/cases`, `/consultations`, `/agents`: consistent Dark.  
6. Public ↔ Student: Dark retained.  
7. Logout: session cleared, Home; `/dashboard` → `/auth/login`.  
8. Login again: Dark still applied (`html.dark`, `edurozgaar-theme=dark`).

Unexpected 5xx: none in api-a/api-b JSON request logs (`"status":5` scan). Worker not running.

---

## Tests executed

- `phase11UiA11yInternational.test.js`: 85
- `phase10PublicShell.test.js`: 73
- `secureAuthClientContract.test.js`: 63
- Phase 1 foundation: 53
- Phase 3 Student portal: 62
- Phase 5 Agent portal: 114
- Phase 7 public discovery: 133
- Phase 8 handoff: 71
- `navbarHierarchy.test.js`: pass
- Mission 23: 37 (+ accepted suites)
- Module-link integrity: clean
- Client lint: 0 errors / 60 pre-existing warnings
- Client production Vite build: pass (browserslist / react-dom overlap / &gt;500kB chunks → Phase 12)

---

## Phase 12 deferrals

- Chunk/bundle optimization, browserslist refresh, react-dom dynamic/static overlap
- Rate-limiter **policy** (UX for 429 is closed here)
- Load testing, worker/email activation, backup/restore, deploy, Mission 27 certification
- Full WCAG certification claim
- Institution/Admin live-session zoom (source contracts closed; no Institution/Admin fixture session in this run)

---

## Freeze gate

Student workspace navbar does not appear on public routes and does appear on intended Student routes. `/agents` is not `/agent`. No permanent native horizontal workspace-nav scrollbar; all destinations remain reachable. Account menu has visible Logout, no internal user ID, required account/preferences/help actions. Logout invalidates the session and returns Home. Appearance is System/Light/Dark with accepted `edurozgaar-theme` persistence. Dark works on Copilot, Cases, Consultations, Agents, and the account menu. Admin actions name, TourAnchors, 200% overflow, Institution narrow select, dense-grid page overflow, and 429 UX are closed. 320/375/768/1024/1440 and 200% pass. Keyboard/focus/Escape pass. Zero unexpected 5xx. Worker stopped. Zero unresolved BLOCKER/P0/P1/UI-accessibility MAJOR.
