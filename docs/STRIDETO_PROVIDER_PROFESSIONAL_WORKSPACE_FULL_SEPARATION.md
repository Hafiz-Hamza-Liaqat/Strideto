# STRIDETO PROVIDER PLATFORM
# Professional workspace full separation

**Date:** 2026-08-17  
**Scope:** Provider Portal information architecture only  
**Does not:** Admin Panel, subscriptions, referrals, 17D-9B, Phase 18, Business marketplace activation, Wyoming/HSI/Worker

## Provider Dashboard gateway

Canonical home:

`/agent?home=1&subjectType=<type>&subjectId=<id>`

This page is the only professional-workspace selector.

Sidebar on home:

- Strideto branding + Agent Portal
- Acting as (exact subject)
- Empty operational menu
- Account identity + Logout

No Education nav, Business nav, Profile, Trust Center, Team, Messages, Notifications, Settings, Help, or Active Dashboard buttons.

## Workspace selection

Opening a workspace is a GET navigation with the current subject preserved.

- Open Education & Mobility → `/agent/education?subjectType=&subjectId=`
- Open Business Services → `/agent/business-services?subjectType=&subjectId=`

No POST/PATCH. No enrollment mutation. No verification mutation.

Switching workspaces is:

1. ← Provider Dashboard
2. Open the other workspace

The Active Dashboard sidebar switcher is removed so both professional systems cannot appear in one menu.

## Education route tree

| Route | Page |
| --- | --- |
| `/agent/education` | Overview |
| `/agent/education/profile` | Education & Mobility Profile |
| `/agent/education/leads` | Student Leads |
| `/agent/education/clients` | Clients |
| `/agent/education/consultations` | Consultations |
| `/agent/education/consultations/:id` | Consultation detail |
| `/agent/education/cases` | ProfessionalCase list |
| `/agent/education/cases/:id` | ProfessionalCase detail |
| `/agent/education/services` | My Education Services |
| `/agent/education/marketplace` | Education Marketplace |
| `/agent/education/availability` | Availability |
| `/agent/education/verification` | Professional Verification |
| `/agent/education/reviews` | Reviews |
| `/agent/education/team` | Education Team |
| `/agent/education/messages` | Education messages |
| `/agent/education/notifications` | Education notifications |
| `/agent/education/help` | Education Help |
| `/agent/education/settings` | Education account settings |

Models unchanged: `AgentService`, `AgentMarketplacePost`, `AgentAvailability`, `Consultation`, `ProfessionalCase`.

## Business route tree

| Route | Page |
| --- | --- |
| `/agent/business-services` | Overview |
| `/agent/business-services/profile` | Business Services Profile |
| `/agent/business-services/requests` | Requests |
| `/agent/business-services/quotes` | Quotes |
| `/agent/business-services/cases` | GbsCase list |
| `/agent/business-services/capabilities` | Capabilities |
| `/agent/business-services/jurisdictions` | Jurisdictions |
| `/agent/business-services/listings` | My Services |
| `/agent/business-services/verification` | Business Verification |
| `/agent/business-services/team` | Business Team |
| `/agent/business-services/messages` | Business messages |
| `/agent/business-services/notifications` | Business notifications |
| `/agent/business-services/help` | Business Help |
| `/agent/business-services/settings` | Business account settings |

Models unchanged: `GbsServiceListing`, `GbsServiceRequest`, `Quote`, `GbsCase`, capabilities, jurisdictions.

Public Business marketplace remains OFF. My Services is listing/service setup, not a live public catalog.

## Profile separation

Separate pages do **not** duplicate identity storage.

- Shared identity (name, legal name, email, phone, website, location, service regions, languages, summary) remains `AgentProfile` / organization fields.
- Education professional fields (`specialties`, `destinationCountries`) are edited only on Education Profile.
- Business professional representation is derived from GBS capabilities, jurisdictions, listings, and eligibility. No Education taxonomy. No invented freeform Business specialty fields.

## Team separation

Agency membership remains shared. Humans are not duplicated.

- Education Team shows Education-domain duties only.
- Business Team shows Business-domain duties only.
- Membership is not professional verification.

## Messages separation

- Education Messages: existing consultation + ProfessionalCase threads (`GET /api/agent/messages`).
- Business Messages: **NOT_CONFIGURED**. No GBS request/quote/case inbox exists yet. The page states that truthfully and does not show Education threads. No new messaging backend was added in this IA phase.

## Notifications separation

`UserNotification` has no `domainId`. Workspace inboxes classify with the existing `link` path plus shared categories:

| Bucket | Rule |
| --- | --- |
| Education | `/agent/education…`, legacy Education paths (`/agent/consultations`, `/agent/cases` but not `/agent/business-services/cases`, marketplace, leads, verification, services, availability, reviews) |
| Business | `/agent/business-services…` or `/business/…` |
| Shared | categories `system`, `payment`, `support` (account-security; may appear in both) |
| Unclassified | omitted rather than guessed |

Records are not duplicated. Deep links rewrite Education legacy paths to namespaced routes, preserving hash (`#professional-credentials`).

## Help separation

Education Help covers implemented Education workflows only.

Business Help covers implemented Business workflows only, states that the public marketplace is off, and does not imply government filing.

DOMAIN-SPECIFIC TERMS — FUTURE PRODUCT/LEGAL WORK. No new legal acceptance copy.

## Minimal Settings

`/agent/education/settings` and `/agent/business-services/settings` reuse the same account-security component:

- Account email
- Change password
- Log out all other sessions
- Connected accounts (OAuth sign-in state)

No Availability, Services, Marketplace, Capabilities, Jurisdictions, Team, Help, billing, subscriptions, referrals, or professional shortcuts.

Gateway has no Settings item because no professional workspace is selected.

## Settings / Logout footer

Professional sidebars:

1. Brand / Acting as / ← Provider Dashboard
2. Scrollable professional nav
3. Footer: account identity, Settings, then Logout (final sidebar action)

Logout is account-wide. One Provider Agent session.

The header notification bell remains account-level (unread across the Provider account). Clicking an item follows that notification’s existing `link`. Education and Business notification **pages** apply workspace filters as above. Unclassified operational events are omitted on those pages rather than guessed.

## Legacy redirects

Education operational paths such as `/agent/leads`, `/agent/verification#professional-credentials` redirect to `/agent/education/…` preserving query and hash.

Ambiguous shared paths (`/agent/profile`, `/agent/team`, `/agent/messages`, `/agent/notifications`, `/agent/settings`, `/agent/help`) without explicit `workspace` / `domain` query redirect to `/agent?home=1` with subject params preserved. They do **not** default to Education.

`/agent/trust` remains a compatibility page and is not primary navigation. Trust/report/dispute APIs are unchanged.

`/agent/cases` redirects to Education ProfessionalCase only.

## Future workspace scalability

Nav/domain registry remains `PROVIDER_DOMAIN_IDS` / `PROVIDER_DOMAINS`. Gateway cards are produced from authorized workspaces, so a future professional domain can appear as another card without a new Provider Account architecture. Future domains are not implemented here.

## Deferred

- Subscriptions / domain plans / billing / referrals: not implemented
- Admin Panel issues (verification review connection, marketplace dark theme, Admin notifications, Admin nav): not touched
- Business public marketplace: OFF
- Wyoming pack / filing legal text / HSI / Worker: unchanged
