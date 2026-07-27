# Beta content data directory

## Public verified opportunities

Add human-verified listings to `verifiedPublic.opportunities.js` only after confirming:

- Official `sourceUrl` / application link
- Future deadline
- Accurate title, organization, and eligibility from the official posting

The seed **does not** scrape or invent live public opportunities. An empty array is expected until editorial/ops supplies records.

## Demo drafts

`demoOpportunities.js` creates **draft** templates (`beta-v1-*`) for admin QA. They do not appear on public `status: active` listings.

## Editorial

`editorial.js` — original Strideto articles (`beta-v1-*` slugs, `published`).

## Reference

`referenceContent.js` — institutions, universities, foreign-study orientation pages, webinars, demo companies (official portal links only).
