# Strideto Mission 13 — Consultations + Contextual Messaging

## Completion status

Mission 13 is complete. Strideto now has a private professional-services foundation for consultation availability, booking, lifecycle management, consultation-bound messaging, selective Vault references, and notification/reminder readiness. It does not create a general direct-messaging network.

## Consultation model and lifecycle

- Added canonical Consultation records linking the authenticated Student, approved organization, assigned Agent membership, active AgentService, optional marketplace origin, and minimal AgentLead relationship.
- Stored requested UTC windows and confirmed instants separately from the preserved IANA timezone identity.
- Added explicit requested, pending-confirmation, confirmed, reschedule-requested, cancelled, completed, no-show, and declined states with actor-specific server transitions.
- Invalid and terminal-state transitions are rejected. Completion and no-show cannot occur before the confirmed start.
- Lifecycle events append to an immutable history collection; cancellation, completion, assignment, and thread state changes are audited with safe metadata.

## Availability and scheduling

- Agent members can manage timezone-specific weekday windows, blocked dates, effective dates, active status, minimum notice, booking horizon, and appointment buffer.
- IANA timezone validation reuses the Mission 1 contract; fixed offsets and server-local assumptions are rejected.
- Overlapping availability windows, inactive members, ineffective rules, unavailable slots, past/too-soon requests, excessive booking horizons, and double bookings are blocked server-side.
- No external calendar integration or Calendly-style subsystem was added.

## Payment boundary

- Consultation payment states are truthful: free, payment-required-future, or payment-not-configured.
- Mission 13 performs no card charge, settlement, escrow, payout, or simulated payment success.
- Mission 16/17 remain authoritative for real commerce and marketplace payments.

## Contextual threads and messages

- Exactly one deterministic thread is created for each explicit consultation request.
- Threads are restricted to `consultation` context; no arbitrary User-to-Agent DM route exists.
- Messages support bounded plain text, system vocabulary, and authorized document references without HTML or executable content.
- Student ownership, active Agent membership, matching organization, assigned-member authorization, thread identity, and bounded pagination are enforced on every read/write.
- Closed consultations remain readable. New messages are allowed for a deterministic 72-hour post-consultation window, then rejected.
- Generic audit metadata records message type and identifiers only, never message bodies or document contents.

## Marketplace and relationship integration

- Marketplace detail and approved public Agent services provide an explicit consultation-request action.
- Marketplace post/service correlation is validated and preserved when supplied.
- An explicit request creates or reuses the minimal Mission 11 AgentLead relationship.
- Marketplace views, saves, and interest alone never create a consultation or conversation.

## Vault document-reference boundary

- A consultation grants zero implicit Vault access.
- Student document-reference messages require the exact owned document, exact explicit grant, Agent/Agency grantee, view permission, and matching consultation reference.
- Mission 10 `canAccessDocument` is re-evaluated when an Agent resolves a historical reference, so revocation or expiry takes effect immediately.
- Messages store reference metadata only; no file, storage key, permanent URL, or whole-Vault permission is copied into conversation data.

## Notifications and reminders

- Added pending event records for consultation request, confirmation, decline, reschedule, cancellation, upcoming reminders, and new contextual messages.
- Reminder records preserve the consultation, recipient, scheduled instant, timezone, event type, and pending state.
- Delivery is explicitly unattempted. No worker, scheduler, email, SMS, WhatsApp, or push process was started.

## Student experience

- Added authenticated consultation list/history, request, and detail routes.
- Students see lifecycle, timezone-aware schedule, truthful payment state, restricted-verification state, authorized meeting metadata, reschedule/cancel controls, immutable history, and contextual messages.
- The Vault CTA explains that an exact, time-bounded grant must be created separately.

## Agent experience

- Added portal consultation inbox/history, assigned consultation detail, lifecycle controls, contextual messages, and truthful dashboard counts.
- Added availability management for working windows, blocked dates, effective dates, notice, horizon, buffer, timezone, and active status.
- No fake earnings, booking revenue, calendar synchronization, or delivery metrics are shown.

## Privacy and audit

- Consultation and message APIs are private and realm-specific; no public consultation/message API exists.
- Public surfaces expose only request links to approved services and never meeting URLs, Student identity, messages, notes, grants, or Vault references.
- Student history omits Agent-private reasons; Student projections omit Agent notes and withhold meeting metadata while verification is restricted.
- Employer and normal Admin APIs receive no consultation or conversation privileges.

## Verification

- Mission 13 focused acceptance: **38/38 passed** (37 initial passes plus one corrected false-positive assertion rerun).
- Post-review affected checks for Agent scoping, relationship creation, and private projections: **3/3 passed**.
- Mission 11 Agent/Agency realm regression: **30/30 passed**.
- Mission 10, Mission 12, and Mission 1 regressions were not run because their Vault access, marketplace/relationship, and timezone contracts were consumed without modification.
- New server modules and integration points passed JavaScript syntax checks.
- Frontend production build ran exactly once and passed: Vite transformed **1,114 modules** in 6.69 seconds.
- The three small post-build UX adjustments passed direct JSX transformation checks. Existing Browserslist, mixed React import, and large-chunk warnings remain non-blocking.

## Operational boundaries

- No live consultations, users, messages, or documents were created.
- No message was delivered externally, and no worker or scheduler was started.
- No payment was executed.
- No migration, backfill, seed, deployment, or remote push was performed.

## Deferred

- Mission 14: Case Management.
- Mission 15: Reviews, Reports, and Disputes.
- Mission 16: Commerce foundation.
- Mission 17: Marketplace payments.
