# STRIDETO Mission 12 — Agent Opportunity Marketplace

## Completion status

Mission 12 is complete. Strideto now provides a structured Agent opportunity marketplace with server-enforced publication and moderation workflows, explicit separation between Agent statements and source-backed facts, Student interest controls, Mission 9 saves, and verification-aware public visibility.

## Marketplace contract

- Added structured post types, lifecycle states, moderation states, content kinds, canonical reference types, interest states, forbidden-claim detection, provenance requirements, freshness warnings, and active-publication evaluation.
- Added tenant-scoped Agent marketplace posts with author, organization, statement, factual claims, canonical references, source provenance, service linkage, targeting metadata, freshness state, moderation feedback, publication dates, and policy signals.
- Added immutable moderation-history records and Student-to-post interest records with one active relationship per Student and post.

## Agent authoring

- Active Agent members can create, edit, list, submit, and archive their organization's posts.
- Draft and needs-changes posts remain editable; publication and moderation state changes are server-owned.
- Submission requires Mission 11 organization verification approval.
- Guarantee language, false official/partner claims, and unsupported source-backed facts are rejected server-side.
- Dashboard and marketplace views expose truthful draft, pending-review, published, and needs-changes counts.

## Provenance and canonical data

- Mission 5 `CanonicalSource` provenance and freshness derivation are reused for factual claims.
- Mission 7 program, scholarship, test, and institution records are referenced read-only and must be published.
- Public responses keep Agent-authored statements distinct from canonical references and source-backed facts.
- Stale or review-due sources produce public warnings; broken, unknown, missing, or invalid provenance blocks publication.

## Public Student experience

- Added public marketplace browse and detail routes with bounded filtering and allowlisted response projections.
- Only currently active, approved posts from currently verified Agent organizations are visible.
- Verification suspension or revocation immediately removes affected posts from public reads.
- Students can express or withdraw explicit interest. Interest creates only the minimum Agent lead context and remains correlated to the originating post.
- Mission 9 saves now support valid public Agent marketplace posts; saving does not create a lead.
- Public detail responses include organization verification badges, source freshness, service context, and the platform disclaimer without exposing private moderation or tenant data.

## Admin moderation

- Added a permission-gated Admin review queue and detail view.
- Admins can begin review, request changes, approve, reject, suspend, or archive posts through validated state transitions.
- Approval rechecks Agent verification, prohibited claims, provenance, canonical references, and source freshness before publishing.
- Negative decisions require a reason, and every transition records an audit event and moderation-history entry.
- Agents cannot self-approve or bypass moderation through client-supplied fields.

## Security and privacy

- All Agent authoring reads and writes are scoped through active organization membership.
- Public and Student routes return explicit allowlists rather than raw documents.
- Student interest requires authenticated user identity and explicit consent.
- No Vault payloads or private Student profile fields are used or exposed.
- Canonical Mission 7 records remain read-only, and lifecycle decisions remain server-authoritative.

## User interfaces

- Agent portal: marketplace list, truthful counts, authoring/edit form, submit and archive actions.
- Public portal: marketplace browse, opportunity detail, save, express-interest, and withdraw-interest actions.
- Admin portal: moderation queue, verification/provenance context, policy signals, history, and review actions.
- Added English, Urdu, and Arabic navigation labels and registered Agent/public/Admin routes in the existing application structure.

## Verification

- Mission 12 focused suite: **30/30 passed**.
- Mission 11 Agent/Agency portal regression: **30/30 passed**.
- Mission 9 action-engine regression: **50/50 passed**.
- Mission 5 and Mission 7 regression suites were not rerun because their source contracts were consumed without modification.
- New marketplace server modules passed JavaScript syntax checks.
- Frontend production build passed once: Vite transformed **1,107 modules** and completed successfully.
- Existing non-blocking build warnings remain: stale Browserslist data, a mixed dynamic/static `react-dom` import, and chunks larger than 500 kB.

## Operational notes

- No live data was modified.
- No database migration was required; the application uses its existing model initialization pattern.
- No deployment or remote push was performed.
- Pre-existing unrelated untracked reports were preserved and excluded from Mission 12 commits.

## Next mission

Mission 13 — Consultations + Contextual Messaging.
