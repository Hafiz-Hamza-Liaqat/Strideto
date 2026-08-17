# STRIDETO P2D final public UX and accessibility closure

## Scope

P2D closes the known Notifications labelling, Admin Agent Marketplace theme/heading, bounded operational-attention, and local route-title gaps. It adds no workflow model, analytics, reminder engine, payment, filing, HSI, jurisdiction, or marketplace activation.

## Notifications accessibility

The shared Notifications page now gives the read-status and category filters visible labels. Native selects remain keyboard operable and use the existing visible-focus treatment. Loading, empty, error, pagination, mark-read, deletion, and realm-specific APIs are unchanged. The protected shared `FormField.jsx` was not touched.

## Admin Agent Marketplace

The page remains a thin consumer of the existing staff-authoritative moderation API. Its route identity is now an `h1`; detail headings form the child hierarchy. Cards, borders, selects, error/policy panels, empty/loading states, and secondary text now use existing Light/Dark Tailwind conventions. No Admin table component or moderation authority changed.

## Bounded attention projections

Education Provider attention uses at most 50 current authorized ProfessionalCases, then independently returns at most five open Provider tasks, actionable applications, and current document requests. Existing unread-message count is reused. No completed/cancelled child becomes actionable.

Student Case-list attention derives the Student identity from authentication, considers at most 50 current owned Cases, and returns at most five proposals, Student tasks, applications, document requests, and approvals. Provider-private notes are not projected.

Business Provider overview replaces full capability/listing loading with database-side grouped counts. It returns at most five current Requests, sent Quotes, active Provider-side Cases, and recent contextual threads for the exact Provider subject.

Business Client overview replaces all-record Request/Case counting with Mongo groups. It returns at most five sent Quotes awaiting decision and five `awaiting_client` Cases. The UI prioritizes Review Quote and preserves truthful private-beta messages: secure document exchange and filing authorization remain unavailable.

All attention links open canonical detail workflows. There is no dashboard mutation path, all-page prefetch, per-row query loop, or new persistence model.

## Document titles

Existing `SeoHead` infrastructure is reused. Education Overview, Student Cases, Business Provider routes, Business Client routes, public `/agents`, and Admin Agent Marketplace have route-appropriate titles. A broad SEO/router replacement was unnecessary.

## Manifest and favicon

The manifest references existing, non-empty local SVG and PNG assets. `/favicon.svg` is served as `image/svg+xml` over HTTPS. The intermittent Chromium manifest SVG diagnostic is a non-blocking static-asset diagnostic; no broken request or manifest contract was found, so assets were not churned.

## Verification

Focused source contracts cover accessible labels, Admin theme/heading semantics, bounded attention sources, deep links, titles, and manifest assets. P1A, P1C, P2A, P2B, P2C-1, P2C-2, P2C-3, auth/product-separation, and relevant 17D regressions remain required. Production Vite build, touched-file ESLint, server `node --check`, focused responsive/browser checks, and staging health complete the gate.

## Remaining manual-only acceptance

- Native browser 200% zoom.
- Real screen reader.
- Full platform four-theme by five-width matrix.
- Complete keyboard/focus walkthrough.
- Human loading, empty, error, wording, and visual-contrast review.

After P2D, proceed directly to final full manual responsive/theme/keyboard/accessibility acceptance. Do not begin another feature phase.
