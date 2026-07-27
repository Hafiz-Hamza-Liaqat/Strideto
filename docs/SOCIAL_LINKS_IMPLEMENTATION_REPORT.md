# Social Links Implementation Report (E.1F-F / E.1F-G)

**Date:** 2026-07-27  
**Status:** **E.1F-F — PARTIALLY IMPLEMENTED**

## Confirmed URL

| Platform | URL |
|----------|-----|
| LinkedIn Company Page | `https://www.linkedin.com/company/strideto/` |

## Deferred (hidden until official URLs supplied)

Facebook, Instagram, X, YouTube, TikTok, Telegram, WhatsApp, GitHub

## Source of truth

| Layer | Role |
|-------|------|
| `shared/social/officialSocialLinks.js` | Canonical confirmed URLs and `resolvePublicSocialLinks()` |
| CMS `footerNav.socialLinks` | May list platforms; **only** a normalized match on the confirmed LinkedIn URL is honored; blank, placeholder, or deferred-platform CMS entries are **ignored** |
| Code fallback | When CMS has no valid LinkedIn entry, footer still shows the confirmed LinkedIn link |

Unconfirmed CMS LinkedIn URLs do **not** override the official company page URL.

## Surfaces updated

| Surface | Change |
|---------|--------|
| Footer | Removed guessed Twitter/Telegram fallbacks; single LinkedIn icon via `SocialLinksRow` |
| Contact | Replaced Telegram link with confirmed LinkedIn (`Strideto on LinkedIn`) |
| Organization JSON-LD | `sameAs: [confirmed LinkedIn URL]` in `organizationSchema()` |
| Mobile drawer | No separate social strip (footer carries public social link) |

## Placeholders removed

- `https://twitter.com/strideto`
- `https://t.me/strideto`
- Non-canonical `https://linkedin.com/company/strideto` (replaced with `www` canonical)

## Not in scope / unchanged

- Job detail “share” buttons (still inert UI; not social profile links)
- Email templates (no hardcoded social hrefs found in client audit)
- Admin CMS editor (can still store rows; public render filters via resolver)
- SEO `twitter:site` meta (`@Strideto`) — brand handle metadata, not an outbound social profile link

## Tests

```bash
node server/src/__tests__/officialSocialLinks.test.js
```

Covers: exact LinkedIn URL, CMS filtering, `sameAs`, no placeholder hrefs on social surfaces, `noopener noreferrer` pattern via component.

## Automated verification (E.1F-G)

Full employer + data-ops test battery and client build run in this phase (see phase summary). Disposable Mongo employer journey: `EMPLOYER_INTEGRATION_TEST=1 node server/src/__tests__/employerPortalIntegration.test.js` — **passed**.

## Browser / responsive

No Playwright suite in repo. Layout uses 44px touch targets on LinkedIn control, footer `flex-wrap`, and employer portal responsive patterns from E.1F-A/E. Full 12-viewport matrix not automated in CI.

## Production data

No CMS or production Mongo mutations in this phase.
