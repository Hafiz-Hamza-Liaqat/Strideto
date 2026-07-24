# Branding Implementation Report — Phase B.1

**Date:** 24 July 2026  
**Brand:** Strideto  
**Tagline:** Every Step Toward Success.  
**Scope:** Visual identity, design system, SEO assets only (no API/auth/schema/route changes)

---

## Brand assets created

### SVG logo system (`client/public/branding/`)

- `logo.svg` — primary lockup
- `logo-light.svg` — light mark for dark backgrounds
- `logo-dark.svg` — dark-surface lockup
- `logo-symbol.svg` — symbol-only (path + upward arrow in “S” form)
- `wordmark.svg` — text wordmark
- `favicon-16.svg` — tiny SVG reference

### Favicons & PWA (`client/public/`)

- `favicon.svg`, `favicon.ico`, `favicon-16.png`, `favicon-32.png`
- `apple-touch-icon.png`
- `icons/icon-48.png`, `icon-192.png`, `icon-512.png`
- `safari-pinned-tab.svg` (mask icon)
- `site.webmanifest`, `browserconfig.xml`

### SEO / marketing placeholders

- `og-image.png` (1200×630)
- `branding/twitter-image.png`, `social-share.png`, `feature-image.png`
- `branding/email-header.png`, `pwa-splash.png`, `app-icon-source.png`

Concept: stylized **S** as a forward path ending in an upward arrow (growth / career journey). Flat, no gradients/shadows.

---

## Design tokens

Centralized under `client/src/design-system/`:

| Module | Purpose |
|--------|---------|
| `colors.js` | Primary `#2563EB`, accent `#F97316`, bg `#F8FAFC`, dark `#0F172A`, secondary text `#64748B`, border `#E2E8F0`, success/warning/danger |
| `typography.js` | Manrope headings, Inter body; H1–H4, body, small, caption |
| `spacing.js` | Spacing + radii scale |
| `brand.js` | Name, tagline, mission, asset paths |
| `BrandProvider.jsx` | Injects CSS variables on `documentElement` |
| `index.js` | Barrel exports |

Tailwind (`tailwind.config.js`) and `:root` CSS variables in `index.css` consume the same tokens. Legacy `edur-*` / `mint` aliases map to the new primary system (no scattered hex for brand colors).

---

## Typography

- **Headings:** Manrope (Google Fonts)
- **Body:** Inter
- Loaded in `client/index.html`
- Tailwind: `font-heading`, `font-sans`, type sizes `text-h1`…`text-caption`
- Base `h1–h6` use heading family

---

## UI components

- **`Logo`** (`components/brand/Logo.jsx`) — full / symbol / wordmark; light/dark tones
- **`Icon`** (`components/brand/Icon.jsx`) — shared outline/linear icon set (spinner, search, etc.) without new dependencies
- **`Button`** — variants: `primary`, `secondary`, `outline`, `cta` (orange), `danger`, `success`; loading spinner; disabled opacity; focus rings

Navbar + Footer use the logo lockup. Hero CTAs use accent (primary action) + white/blue (secondary).

---

## Homepage hero

Default copy (i18n `en/home`):

- **Headline:** Every Step Toward Success.
- **Subhead:** Discover jobs, scholarships, admissions, internships, and career resources—all in one place.
- **Primary CTA:** Explore Opportunities → `/jobs`
- **Secondary CTA:** Build Your Resume → `/resume-builder`

Search + category chips unchanged (behavior preserved). CMS-driven hero still overrides when configured.

---

## Email branding

`server/src/templates/emailTemplates.js`:

- White header
- Symbol logo
- **STRIDETO**
- Tagline under name
- Primary button color `#2563EB`

---

## SEO improvements

- Tagline + theme color `#2563EB` in `seo/config.js` (from design tokens)
- Organization JSON-LD logo → `/branding/logo-symbol.svg`
- `index.html` OG/Twitter/theme-color/mask-icon/Manrope updated
- Manifest theme/background aligned with design system

---

## Accessibility

- Visible `:focus-visible` outline using primary
- Button focus rings + disabled states
- Logo `alt` / navbar `aria-label`
- Dark mode logo swap
- Contrast: blue/white and orange/white on CTAs meet typical AA for large text; body uses `#334155` on `#F8FAFC`

---

## Performance notes

- Logos are SVG (scalable, small)
- PNG icons regenerated at required sizes (not multi-MB placeholders)
- No new npm dependencies
- Google Fonts: Inter + Manrope (+ existing Urdu/Arabic)

---

## Files changed (summary)

- `client/src/design-system/**`
- `client/src/components/brand/**`, `common/Button.jsx`
- `client/src/components/layout/Navbar.jsx`, `Footer.jsx`
- `client/src/pages/Home/Home.jsx`
- `client/src/seo/config.js`, `schemas.js`
- `client/src/index.css`, `tailwind.config.js`, `index.html`, `main.jsx`
- `client/public/**` branding + favicons + manifest
- `client/src/i18n/locales/en/home.json`, `footer.json`, `seo.json`
- `server/src/templates/emailTemplates.js`
- `docs/BRANDING_IMPLEMENTATION_REPORT.md` (this file)

---

## Verification results

| Check | Result |
|-------|--------|
| `npm run lint` (client) | Pass — 0 errors (51 pre-existing warnings) |
| `npm run build` (client) | Pass |

No new ESLint errors introduced. Production build completed successfully.

---

## Known manual tasks

1. Replace PNG placeholders with final designer exports when available (keep SVG as source of truth).
2. CMS homepage hero may still override new default copy until updated in admin.
3. Claim social handles matching `@Strideto`.
4. Optional: migrate remaining inline `edur-*` class usages over time (aliases already map to new tokens).
5. Mobile app icons / Expo assets not updated in this phase.
6. Do not deploy until stakeholder design sign-off.

---

## Constraints respected

- No backend business logic / API / auth / schema / routing changes
- No application behavior changes beyond branding presentation
- No unnecessary dependencies
