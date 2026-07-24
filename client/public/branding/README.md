# Strideto branding assets (Phase B.3)

Editable SVG sources live in this folder. PNG/ICO copies under `client/public/` are generated via:

```bash
cd client && node scripts/generate-brand-assets.mjs
```

(Requires `sharp` + `to-ico` available in node_modules.)

## Logo system (refined B.3)

| File | Use |
|------|-----|
| `logo.svg` | Primary lockup (symbol + wordmark) on light UI |
| `logo-light.svg` | Lockup for dark blue / photo backgrounds |
| `logo-dark.svg` | Lockup for dark UI chrome (footer/nav dark) |
| `logo-symbol.svg` | Symbol only (favicons, app icons) |
| `wordmark.svg` | Text-only wordmark |
| `favicon.svg` / `favicon-16.svg` | Browser favicons |
| `mask-icon.svg` | Safari mask companion (also `../safari-pinned-tab.svg`) |
| `social-logo.svg` / `email-logo.svg` / `og-logo.svg` | Channel-specific SVG lockups |

## Concept (v3 — Rising Stride)

Three soft ascending **steps** + warm orange **goal spark** (not a letter-S).

- Instantly reads as progress / career journey  
- Friendlier silhouette, clearer at favicon size  
- Wordmark: **Stride** + accent **to** (toward success)  

Meaning: *Every Step Toward Success.*

Replaced the earlier rigid “S + arrow” mark after design review.

## Marketing / SEO

| File | Size guidance |
|------|----------------|
| `og-image.png` | 1200×630 Open Graph |
| `twitter-image.png` | Twitter card |
| `social-share.png` | Generic share |
| `feature-image.png` | Feature / blog default |
| `email-header.png` | Transactional email header |
| `pwa-splash.png` | PWA splash |
| `app-icon-source.png` | 1024 app icon source |

## Brand

- **Name:** Strideto
- **Tagline:** Every Step Toward Success.
- **Primary:** `#2563EB`
- **Accent:** `#F97316`
- **Domain:** strideto.com
