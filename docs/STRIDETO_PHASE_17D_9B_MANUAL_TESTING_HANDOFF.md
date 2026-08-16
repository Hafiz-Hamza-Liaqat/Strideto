# STRIDETO PHASE 17D-9B
MANUAL TESTING HANDOFF

This is **not** Phase 18 certification.

**Current status: BLOCKED for live Wyoming authorization/filing workflow testing.**

Approved production filing-authorization legal text was not supplied. The Wyoming v1 pack remains `reviewStatus=draft` / `activationStatus=draft`. Committed kill switches remain OFF.

Do not treat local flag enablement as pack review, legal approval, or government filing authority.

---

## Safety — read first

**DO NOT** perform a real Wyoming government filing unless separately authorized for a real legal/business transaction.

**DO NOT** use real government credentials.

**DO NOT** use real passport / CNIC / KYC data.

**DO NOT** pay the $100 Wyoming Articles fee merely for software QA.

**DO NOT** log into WyoBiz for this software test.

**DO NOT** start the existing email/notification Worker.

**DO NOT** enable HSI, ClamAV, MinIO, or Vault Transit for Wyoming v1.

**DO NOT** drain the historical notification queue.

**DO NOT** modify protected WIP:

- `client/src/components/admin/AdminDataTable.jsx`
- `client/src/components/admin/AdminTableFilters.jsx`
- `client/src/components/common/FormField.jsx`
- `docker-compose.appenv-align.yml`

---

## What you can test today (safe default)

With committed flags OFF (normal local/staging):

- Customer Case shows filing authorization **unavailable** (no grant control)
- Provider Case does **not** offer “Record external filing”
- Quote accept still does **not** create CaseFilingAuthorization
- RA consent still does **not** create CaseFilingAuthorization
- No Wyoming pack snapshot on new Cases (pack is still draft)

---

## What you cannot test until USER supplies artifacts

Full Customer grant of **production** legal text, Provider external-filing eligibility against **production** pack+text, and live responsive/keyboard matrix of that grant dialog.

Required from USER first:

1. Exact approved production filing-authorization wording (do not rewrite it)
2. Real approval status / source / process (and dates/roles/refs only if known)
3. Real pack review role for official-source mechanical mapping
4. Explicit authorization to mark pack v1 `reviewed` + `active` for controlled pre-Phase-18 use

Until then, Cursor must not activate the pack or ingest “approved” prose.

---

## Local start (existing staging)

Use the existing local HTTPS staging stack. Do not `docker compose down`. Do not start `edurozgaar-staging-worker-1`.

APIs: `edurozgaar-staging-api-a` / `api-b`. Frontend: `edurozgaar-staging-frontend-1`. Caddy HTTPS root expected 200.

Marketplace must stay OFF. HSI must stay OFF.

---

## Manual-test enable (ephemeral, local only)

PowerShell **process** environment for a **local Node** process you start yourself. Do **not** commit these values. Do **not** put them in `docker-compose.appenv-align.yml`.

```powershell
$env:GBS_WYOMING_FORMATION_ENABLED = '1'
$env:GBS_FILING_AUTHORIZATION_ENABLED = '1'
$env:GBS_EXTERNAL_FILING_ATTESTATION_ENABLED = '1'
```

These flags still **cannot**:

- make the draft pack selectable
- approve legal text
- create a production grant

So enabling them **today** still yields: authorization unavailable, no live grant, no Provider filing action.

After USER supplies approved text and pack review/activation is separately committed, the same three flags are the kill switches for a disposable local test. External filing enablement is only appropriate if the legal gate is actually approved.

---

## Manual-test disable / rollback

```powershell
$env:GBS_WYOMING_FORMATION_ENABLED = '0'
$env:GBS_FILING_AUTHORIZATION_ENABLED = '0'
$env:GBS_EXTERNAL_FILING_ATTESTATION_ENABLED = '0'
```

Or close the shell. Restart APIs without those variables.

Expected after disable, without database mutation:

- New Wyoming pack attachment stopped
- New grants stopped
- Provider claim / external filing attestation stopped
- Exact Case owner can still revoke an already-active authorization
- Historical GET remains truthful

---

## Recommended disposable identities

Use fake names/emails only. No real business, no real HSI documents.

- Business Client test account (active `business_client`)
- Independent Provider test account (business_formation, US-WY LLC listing)
- Agency Provider only if you need agency isolation

Eligible flow: US-WY LLC `business_formation` ServiceRequest → Quote → accept → Case.

Do not reuse unrelated staging customer Cases for destructive tests.

---

## Expected sequence (after legal/pack gates exist)

1. Requirements not ready
2. Requirements ready (facts, provider checks, RA consent attestation)
3. Authorization unavailable if any gate/legal dependency is off
4. Authorization available (exact server legal paragraphs, version/hash, unchecked affirmation)
5. Authorized
6. Revoked
7. Authorized again only via a **new** grant
8. External filing eligible
9. `submitted_externally` only if you deliberately record a **synthetic** Provider attestation in a disposable environment

`submitted_externally` means: Provider attested an external action. It does **not** mean government approved, registered, or company formed. It must **not** auto-complete the Case.

v1 authorizes **one** initial formation submission. There is no Resubmit control.

---

## Customer checks (when unblocked)

- Exact legal paragraphs (not paraphrased, no HTML injection)
- Unchecked affirmation; Authorize Provider; confirmation dialog starts closed
- Cancel does not grant
- Revoke confirmation starts closed
- Keyboard: reach authorization, affirmation, grant, revoke; visible focus
- Widths 320 / 375 / 768 / 1024 / 1440 in System, Light, and Dark
- 320px: legal text wraps; controls reachable; no horizontal page scroll
- Native **200% zoom**: USER MANUAL
- Screen reader: USER MANUAL (heading, Provider identity, legal text, affirmation, grant/revoke, status)

---

## Provider checks (when unblocked)

- No Customer grant control
- Status textual, not color-only
- “Record external filing” / “outside STRIDETO” — never “Submit to Wyoming”
- Confirmation unchecked by default
- Disabled when no auth, revoked, invalidated, feature off, authority lost, Case terminal

---

## Security smoke (safe, no government)

- Customer B URL to Customer A Case → 404, no authorization existence leak
- Wrong Provider Case URL → 404
- Staff/Admin cannot grant or record filing as Provider
- Back-button after revoke does not resurrect authority
- Double-click grant / filing action does not duplicate the legal event
- Feature disable then refresh: new progression blocked; owner revoke still works if an active auth exists
- `?enableWyoming=true` / `X-Test-Mode` must not enable features

---

## Cleanup

Do not drop staging Mongo. Do not delete unrelated Cases. Do not drain the queue.

Prefer recording public refs of disposable 9B Cases and deleting **only those** if repo cleanup policy allows. If unsure, leave tagged test refs and do not run global cleanup.

---

## Defect capture

Record: account, public Case ref, flag values, screenshot/width/theme, request ids, and whether any government site was contacted (must be none).

Return runtime to OFF using the disable commands above when finished.
