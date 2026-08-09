# Strideto Mission 1 — International Platform Foundation

> **Status:** Implemented (source-complete, not deployed).
> **Scope:** Additive, international-by-architecture foundations, contracts,
> persistence primitives, shared utilities, tests and documentation.
> **Authority:** Subordinate to the frozen product spec, execution roadmap,
> engineering guardrails, trust/verification policy and employer final
> acceptance. Preserves the Employer Release Baseline and B1–B5B unchanged.

## 0. Purpose & principle

Mission 1 makes Strideto **international by architecture** while preserving all
existing behavior. Every new contract below is standards-derived and carries **no**
Pakistan/PKR/`+92`/`Asia/Karachi`/single-address/Employer-only assumption. Legacy
records keep working; migration is additive and never auto-executed.

Standards used: **ISO 3166-1** (countries), **ISO 3166-2** (subdivisions, shape
only), **ISO 4217** (currencies), **IANA tz database** (timezones), **ITU-T
E.164** (phones).

All shared modules live under [`shared/international/`](../shared/international)
and are pure, **client- and server-safe** (only ECMA-402 `Intl`, no Node/DOM
globals). They are re-exported from
[`shared/international/index.js`](../shared/international/index.js).

## 1. Canonical country contract — `country.js`

- ISO 3166-1 **alpha-2** is the canonical stored form; storage is **uppercase**.
- `normalizeCountryCode` / `isValidCountryCode` validate against a small,
  auditable, standards-derived allow-set (`ISO_3166_ALPHA2`). Display labels come
  from `Intl.DisplayNames` (locale-aware) — we do **not** bundle hundreds of
  names.
- `coerceCountryCode` accepts a legacy free-text **name** ("Pakistan") or a code,
  for incremental migration; unknown input returns `null` (never a fabricated
  default).
- Optional subdivision support (`normalizeSubdivisionCode`) validates ISO 3166-2
  **shape** only — no country's province list is hardcoded.

## 2. Currency + Money contract — `currency.js`, `money.js`

- ISO 4217 alphabetic codes; `normalizeCurrency` uppercases and validates against
  `ISO_4217_CURRENCIES`.
- **Minor units** are explicit: `currencyMinorUnits` returns 0 for zero-decimal
  currencies (`ZERO_DECIMAL_CURRENCIES`, e.g. JPY/KRW), 3 for three-decimal
  (`THREE_DECIMAL_CURRENCIES`, e.g. KWD), else 2.
- **Money** = `{ amountMinor: <safe integer>, currency: <ISO 4217> }`. Amount and
  currency always travel together. Amounts are integer minor units, so
  irreversible accounting never depends on IEEE-754 floats. `makeMoney` rejects
  non-integer/unsafe amounts and invalid currencies.
- Deterministic serialization: `serializeMoney` → `"1050 USD"`, round-tripped by
  `deserializeMoney`.
- Adapters for incremental Commerce migration: `fromDecimal` / `toDecimalString`
  (display/legacy interop only — arithmetic stays in integer minor units).
  `addMoney` refuses mixed-currency addition (needs an explicit rate — deferred).
- **No** PKR default; **no** real payment provider.

## 3. Timezone contract — `timezone.js`

- Mirrors and generalizes the accepted **B3** employer-interview architecture
  (`server/src/utils/appointmentTime.js`) for future modules (consultations,
  institution events, deadlines, journey planner, alerts). The B3 path is
  **unchanged**; this shared module is for new code.
- `isValidTimeZone` / `normalizeTimeZone` accept IANA `Area/Location` (and `UTC`)
  and **reject fixed offsets** (`+05:00`) — an offset is not a zone.
- A **UTC instant** and a **timezone identity** are separate concepts; the server
  process timezone is never consulted. `formatInstantInZone` falls back to a
  **labeled UTC** render when no zone is supplied (never a silent local guess).

## 4. Address + maps contract — `address.js`, `geo.js`

- Additive structured address: `addressLine1`, `addressLine2?`, `city`, `region?`,
  `postalCode?`, **`countryCode` (canonical, only hard requirement)**,
  `latitude?`, `longitude?`, `googleMapsUrl?`.
- Suitable for Users, Employers, Agents/Agencies, Institutions. No Pakistan-only
  field assumptions; fields are optional per jurisdiction.
- Coordinates (`normalizeCoordinates`): both-or-neither, validated to
  lat ∈ [-90,90], lng ∈ [-180,180].
- Google Maps URL (`isGoogleMapsUrl`): accepted only as **supporting location
  evidence**, never identity proof — HTTPS + genuine Google Maps host, and
  `google.com` must be a `/maps` path.
- `fromLegacyEmployer` adapts existing free-text Employer location fields for
  read/preview **without** destructive migration.

## 5. Phone contract — `phone.js`

- Canonical storage is **E.164-compatible** (`+`, calling code, ≤15 digits).
  Display/input concerns are kept separate from canonical storage.
- `normalizePhone` accepts common human formatting and `00` international prefix.
  It **never invents a country code**: a local number without `+` returns `null`
  unless the caller passes an explicit `defaultCountryCallingCode` — there is no
  `+92` assumption.
- Server-side validation via `isValidPhone`. **No** SMS verification built.
- Carrier-grade national parsing is deferred; if needed later, prefer a mature
  dependency (e.g. libphonenumber) rather than growing this module.

## 6. Organization abstraction — `organization.js` + `server/src/models/Organization.js`

- Additive identity foundation for Employer/company, Agent, Agency, University,
  College, Institute (`ORGANIZATION_TYPES`) with a coarse lifecycle
  (`ORGANIZATION_STATUSES`: draft/active/suspended/archived).
- Contract fields: `organizationType`, `legalName`, `displayName`, `slug`,
  `countryCode`, `website`, `officialDomain`, `phone`, `address`, `status`,
  `legacyEmployerId`, timestamps.
- **Does not replace the Employer model** and migrates **no** employer during
  Mission 1. `legacyEmployerId` (unique+sparse) links an Organization to the
  legacy record it represents.
- Collision-safe slugs via `ensureUniqueOrganizationSlug` (injected `slugExists`
  predicate — DB-agnostic, same pattern as the accepted employer-slug helper).
- The Mongoose model uses **safe additive indexes** (`unique+sparse` slug &
  legacy link; compound type/status; country). No live backfill.
- **Verification state / evidence / risk is Mission 2** — intentionally absent.

## 7. Actor / realm constants — `realms.js`

- Canonical `ACTOR_REALMS`: `user`, `employer`, `admin` (active) plus `agent`,
  `institution` (declared for future missions, **no live auth path**).
- `assertRealmIntegrity` guards against collision/casing drift.
- **No** Agent/Institution portal is built; existing auth separation is
  unchanged; server-side authorization remains authoritative. The staff RBAC
  roles in `server/src/config/rbac.js` are the ADMIN realm's sub-roles and are
  not duplicated here.

## 8. Generic audit primitive — `audit.js`

- Bounded audit **record contract**: `actorRealm`, `actorId`, `action`,
  `targetType`, `targetId`, `metadata`, `correlationId`, `timestamp` (ISO,
  immutable-event semantics).
- **Sensitive-key rejection**: `findForbiddenMetadataKeys` recursively rejects
  secrets, tokens, raw card data, private document content, etc.
  (`FORBIDDEN_METADATA_KEY_PATTERNS`). `validateAuditRecord` fails closed on any
  match.
- Complements the existing `auditService` / `AuditLog`; Mission 1 retrofits
  nothing — later missions adopt it incrementally.

## 9. Source / evidence primitive — `evidence.js`

- Base contract only: `sourceUrl`, `sourceType` (`SOURCE_TYPES`), `publisher`,
  `retrievedAt?`, `verifiedAt?`, `evidenceRef?`, `provenance?`.
- `validateSource` enforces http(s) URLs and requires a url or evidence ref
  (document sources may carry only a ref).
- **No** scraping/ingestion/freshness automation; **no** seed data. Full Source
  Verification + Freshness is **Mission 5**.

## 10. Rollout configuration boundary — `rolloutConfig.js`

- Deterministic, **specificity-ordered** resolver: a feature's value can vary by
  `countryCode` and/or `organizationType`, falling back to a default rule.
- `validateRolloutTable` rejects typo'd (unmatchable) country/type narrowing.
- Mission 1 provides only the **boundary** — it hardcodes **no** legal or
  jurisdiction rules (credential requirements, payment availability, agent/
  institution rules are later missions' rule tables).

## 11. Notification preferences — `notificationPreferences.js`

- Additive category vocabulary (`NOTIFICATION_CATEGORIES`: scholarships, tests,
  deadlines, applications, consultant_messages, appointments, jobs, promotions)
  and channels (`NOTIFICATION_CHANNELS`: in_app, email + declared push/sms/
  whatsapp).
- **Transactional/security is separable from marketing**: `TRANSACTIONAL_CATEGORIES`
  cannot be silenced by an opt-out; `validateNotificationPreferences` coerces such
  values back on and reports the coercion. A `promotions` opt-out never affects a
  transactional message.
- Complements the existing `User.notifications` channel booleans. **No** SMS/push/
  WhatsApp delivery built.

## 12. Locale/date/display helpers — `dateDisplay.js`

- `formatDate`, `formatNumber`, `formatMoney` are **display only** — persistence
  stays canonical (UTC instants, integer minor units, ISO codes).
- Locale and timezone are always explicit arguments; **no** US date order, **no**
  Pakistan locale, **no** server-timezone assumption.

## 13. Compatibility strategy

| Domain | Mission 1 treatment |
| --- | --- |
| Existing **Users** | Untouched. `User.notifications` and profile fields keep working; new preference/address/phone contracts are additive and opt-in. |
| Existing **Employers** | Untouched. Employer model, slug helper and B1–B5B behavior preserved. `address.fromLegacyEmployer` adapts legacy location fields for read; `legacyEmployerId` links a future Organization. |
| **Jobs / Applications / interview data / payment history** | Untouched. Money contract adds no rewrite; `fromDecimal`/`toDecimalString` enable later incremental Commerce migration. |
| **Migrations** | One additive, dry-run-first script added, **not executed**: `server/src/scripts/provisionOrganizationFoundation.js` (verify → preview → `--commit`, refuses production without `--allow-production`, idempotent, collision-safe). No live mutation, no employer slug backfill. |

## 14. Admin / debug visibility

New Organization records are inspectable via the standard model layer and the
dry-run provisioning script's `--verify`/`--preview` output. No internal security
metadata is exposed publicly. The full Admin center remains **Mission 21**.

## 15. Tests

`server/src/__tests__/internationalFoundation.test.js` (plain-node `assert`,
run with `node src/__tests__/internationalFoundation.test.js`) — 13 grouped
checks covering: country normalization/validation, currency
normalization/validation, Money serialization + minor-unit/FP safety, timezone
validation, address validation, coordinate validation, Google Maps URL
accept/reject boundary, phone E.164 normalization, organization slug uniqueness,
organization type/status validation, legacy Employer compatibility, realm drift
integrity, audit sensitive-key rejection, source/evidence validation,
notification preference (transactional-vs-marketing) validation, and
country/feature configuration resolution.

Accepted **Employer B1–B5B** regression suite (`employer*.test.js`, `authRealm`)
re-run green. One frontend production build (`vite build`) run green after shared
changes.

## 16. Deferred to later missions

Agent Portal & verification; Institution Portal & verification; the full Trust
verification state machine, evidence & risk (Mission 2); Test Intelligence;
Scholarships; Document Vault; matching/eligibility; Journey Planner; consultation
system; messaging; real payment provider; AI Copilot; Source Verification +
Freshness automation (Mission 5); jurisdiction legal rule tables; SMS/push/
WhatsApp delivery; cross-currency conversion; carrier-grade phone parsing;
full Admin center (Mission 21); live migration execution / employer slug
backfill.
