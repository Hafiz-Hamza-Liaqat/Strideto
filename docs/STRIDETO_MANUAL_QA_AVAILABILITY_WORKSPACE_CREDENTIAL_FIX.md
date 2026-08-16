# STRIDETO Manual QA — Availability / User Workspace / Credential Discoverability Fixes

Date: 2026-08-17  
Starting HEAD: `3be2c00ec29e5499536e4a485985f5f57db37139`

## Defect A — Availability duplicate Tuesday

**Root cause:** There was no buggy Mon–Fri initializer that mapped Thursday→Tuesday. The form defaulted to a **single Monday** window, and **Add window** always cloned Monday (`weekday: 1`). The observed Mon/Tue/Wed/Tue/Fri set was therefore **user-edited / persisted overlapping rows** (duplicate Tuesday intervals), not a weekday-index shift. Server overlap rejection was correct.

**Fixes:**
- Empty / missing saved availability seeds **Mon–Fri 09:00–17:00** only (does not rewrite intentional saved schedules).
- Client pre-POST overlap detection with day-named `role=alert` and row highlight.
- Server overlap message names the weekday and clocks (authority unchanged).
- Responsive labeled day/start/end/remove controls.

## Consultation blank dropdown

**Root cause:** When `availability=[]`, the select rendered with zero options (blank). Commonly follows failed/empty provider availability for that service subject.

**Fix:** Truthful empty state + disabled Request button.

## Defect B — Business Client shown as Student

**Root cause (architecture):**
1. User registration always grants `student` via `initializeCustomerUser`.
2. `business_client` is granted only by explicit `POST /business/activate`.
3. Public header/`projectStudentIdentity` **always** labeled User-realm sessions as **Student**, ignoring capabilities.

**Wyoming QA Customer (staging DB, read-only audit):**
- `student` = active (registration)
- `business_client` = **not present**
- So truthful label after fix remains **Student** until Business activation succeeds.
- Dual workspace appears only when both grants are active.

**Fixes:**
- `/auth/me` and login attach `capabilities[]` (additive).
- UX preference `strideto-user-workspace` (`student` | `business_client`) — **not ACL**.
- Labels/menu/default href follow server capabilities; stale preference ignored.
- `/business` never shows StudentPortalNav; business UX mode hides Student nav.

## Defect C — Credential discoverability

Credentials remain on `/agent/verification` (Professional credentials & evidence). Not deleted.

**Fixes:** Education Trust → Professional Verification copy + `#professional-credentials`; Trust Center summarizes education/business layers and links; Business Verification nav → capabilities evidence page.

## Defect D — Public `/agents`

- Usama / Ameer: `agentType: agency` (Approved Agency = organization/marketplace profile approval; `trustBadges: []`).
- Usama: 0 active services. Ameer: 1 active Education service.
- Specialty slugs title-cased for display only (enums unchanged).
- Directory remains Education & Mobility; marketplace stays OFF.

## Safety

Wyoming draft/draft · Legal UNAPPROVED/EMPTY · Marketplace OFF · HSI OFF · Worker STOPPED · No push/deploy · 17D-9B not continued · Phase 18 not started.
