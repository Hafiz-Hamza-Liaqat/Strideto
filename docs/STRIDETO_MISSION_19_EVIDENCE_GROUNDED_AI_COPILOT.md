# Strideto Mission 19 — Evidence-Grounded AI Copilot

## Overview

Mission 19 adds the Evidence-Grounded AI Copilot to the Strideto platform. The Copilot helps authenticated Students answer questions about tests, programs, scholarships, eligibility, and their study-abroad journey, grounded exclusively in verified canonical Strideto data.

**Core rule**: No evidence → no authoritative fact claim. The Copilot explains and synthesizes; it does not fabricate institutional, admission, visa, scholarship, test, financial, or employment facts.

---

## Architecture

### Pipeline

```
Request (authenticated Student)
→ Intent classification (deterministic)
→ Retrieval (server-side, bounded, canonical)
→ Evidence Packet assembly (server-side, client cannot forge)
→ Model generation (mock_test / not_configured — no real calls in Mission 19)
→ Output policy + grounding validation
→ Structured response
```

### Key files

| File | Purpose |
|------|---------|
| `shared/ai/copilot.js` | Shared contracts: context types, grounding status, evidence entity types, bounds, guarantee patterns |
| `server/src/services/ai/CopilotModelProvider.js` | Provider-neutral boundary; mock_test and not_configured states |
| `server/src/services/ai/copilotRetrieval.js` | Bounded retrieval over canonical records |
| `server/src/services/ai/copilotEvidencePacket.js` | EvidencePacket assembly with source priority and freshness |
| `server/src/services/ai/copilotGroundingValidator.js` | Post-generation output policy enforcement |
| `server/src/services/ai/copilotService.js` | Orchestration: validate → retrieve → assemble → generate → validate → audit |
| `server/src/controllers/copilotController.js` | HTTP controller (userId always from JWT, never body) |
| `server/src/routes/copilot.js` | Routes: POST /api/copilot/ask, GET /api/copilot/status |
| `client/src/pages/Copilot/CopilotPage.jsx` | Authenticated Student Copilot UX |
| `client/src/pages/Copilot/CopilotWidget.jsx` | Contextual "Ask Strideto" entry point widget |
| `server/src/__tests__/copilot.test.js` | 53 behavioral and security tests |

---

## Provider Abstraction

### Provider states

| State | Behavior |
|-------|----------|
| `not_configured` | Returns structured evidence summary; answer = "AI model not configured". No fake synthesis. |
| `mock_test` | Deterministic synthesis from evidence items. Used in CI/tests. `COPILOT_MOCK=true`. |
| `configured_future` | Placeholder. Reserved for approved production provider integration. |

Domain service never depends on vendor SDK objects. All vendor interaction is isolated to `CopilotModelProvider`.

### Not-configured behavior

When no provider is configured:
- `answerType = not_configured`
- `groundingStatus = provider_not_configured`
- Evidence packet is still assembled and returned
- No fake AI completion presented to the user

### Production provider requirements (future)

Before enabling a production provider:
1. Select AI provider and model
2. Configure credentials in secrets manager (never in code)
3. Review data-processing agreement and regional privacy compliance
4. Set token retention policy (avoid indefinite prompt logging)
5. Define rate and cost controls
6. Configure observability (latency, error rate — not raw prompts)
7. Run evaluation set against Mission 19 behavioral test fixtures
8. Complete production safety acceptance before enabling

---

## EvidencePacket

Every authoritative fact supplied to the model carries structured metadata:

```
EvidenceItem {
  id              — server-assigned UUID fragment (used for citation validation)
  entityType      — EVIDENCE_ENTITY_TYPES value
  entityId        — canonical record ID
  scope           — 'program+intake' | 'program' | 'institution' | 'country' | 'global'
  fact            — short label for what this item attests
  value           — summary value (sanitized, injection-checked)
  sourceType      — SOURCE_STATEMENT_TYPES value
  sourceAuthority — AUTHORITY_TYPES value (Mission 5)
  sourceLabel     — display name
  verificationState — VERIFICATION_STATUSES value
  freshnessState  — FRESHNESS_STATES value (Mission 5)
  lastVerifiedAt  — ISO timestamp
  officialAttribution — e.g. "Official information supplied and confirmed by the institution"
  publicSafeUrl   — canonical official URL (never internal admin URL)
}
```

Evidence items are assembled **server-side only**. The client cannot supply or forge evidence items.

---

## Source Priority

Follows Mission 5 authority hierarchy:

```
government / official_test_org
> institution_submitted (Mission 18 verified first-party)
> university / scholarship_provider
> trusted_secondary
> strideto_derived recommendation
> agent_statement
> ai_synthesis
```

Agent statements are never promoted to official facts. AI synthesis is always labelled as such.

---

## Freshness

Follows Mission 5 `FRESHNESS_STATES`:

| State | Behavior |
|-------|---------|
| `fresh` | Supports normal factual synthesis |
| `review_due` | Supports synthesis with source warning |
| `stale` | Must be caveated; evidence grounding downgraded to `stale_evidence` |
| `broken` | Must not be treated as current; triggers source warning |
| `unknown` | Explicit uncertainty where material |

For high-impact facts, Copilot prefers "information unavailable" over using stale/broken evidence as if current.

---

## Conflict Handling

When evidence items conflict:
- Conflict metadata is exposed to the user
- Sources, values, and freshness/authority context are shown
- Recommendation: "Verify with official source — AI cannot auto-resolve conflicting evidence."
- No silent AI resolution
- Mission 18 conflict workflow remains authoritative for institution data

---

## Student Profile Privacy

### Included in safe context projection
Goals, nationality, country, education (level/field/GPA), test scores, experience, skills, preferences (destinations, degree, budget, study mode), profile completeness.

### Excluded (never sent to model)
- Password / auth tokens
- Vault document contents or references (Mission 10)
- Passport numbers / government IDs
- Raw private file storage paths
- Payment credentials
- Private messages
- Agent private notes

### Cross-user isolation
`userId` is always derived from the authenticated JWT (`req.user.userId`). Client-supplied `userId` in request body is silently ignored. All retrieval is scoped to the authenticated student.

---

## Vault Boundary

The Copilot has **zero** automatic Vault file access.

- No document contents are read
- No files are sent to the AI model
- No passport/transcript text is extracted
- No storage references are exposed

Document AI analysis belongs to a future explicitly authorized feature if ever approved.

---

## Mission 8 Eligibility and Matching Reuse

The Copilot reuses the deterministic Mission 8 engine:
- `evaluateProgramEligibility` / `evaluateScholarshipEligibility`
- Results are passed through as `deterministicResults` in the response
- The AI **explains** eligibility results; it does not override them
- Match score is never converted to an admission probability
- The AI cannot produce an "AI admission probability" claim

---

## Mission 9 Journey / NBA Reuse

- `buildJourneyPlan` and `computeNextBestAction` are used for journey evidence
- Journey stage and NBA are passed through as `deterministicResults`
- The AI explains the current stage and next actions; it does not reorder or override deterministic safety priorities

---

## Mission 18 Institution Official Data

Institution-submitted verified first-party facts receive:
- `entityType = INSTITUTION_OFFICIAL`
- `sourceType = INSTITUTION_SUBMITTED`
- `officialAttribution = "Official information supplied and confirmed by the institution"`

Unverified institutions receive `entityType = INSTITUTION` with `sourceType = CANONICAL_SECONDARY`.

---

## Structured Response

```
CopilotResponse {
  requestId         — server-generated
  answer            — synthesized text (post-validated)
  answerType        — ANSWER_TYPES value
  groundingStatus   — GROUNDING_STATUS value (never a number)
  confidenceCategory — same as groundingStatus (for UX)
  evidence          — EvidenceItem[]
  citedEvidenceIds  — validated ids only (fabricated ids dropped)
  sourceWarnings    — string[]
  conflicts         — ConflictItem[]
  deterministicResults — { eligibility, journeyStage, nextBestAction, gapSummary }
  policyMessages    — policy enforcement messages
  disclaimers       — contextual disclaimers (not generic boilerplate)
  suggestedFollowUps — string[]
  providerMeta      — { providerState, model } (never credentials)
  generatedAt       — ISO timestamp
  _observability    — { retrievalCount, evidenceCount, groundingStatus, freshnessWarningCount, ... }
}
```

---

## Citations

- Citations reference server-supplied `EvidenceItem.id` values only
- Unknown/fabricated citation IDs from the model are dropped
- Dropped citations downgrade `groundingStatus` to `partially_grounded`
- No model-generated URLs are surfaced as source links

---

## Grounding Validator (output policy)

Applied deterministically server-side after model generation. Cannot be bypassed by prompt wording.

### Checks
1. **Citation validation** — drops unknown evidence IDs, downgrades grounding
2. **Guarantee language** — blocks/rewrites guarantee/admission/visa/scholarship certainty claims → `policy_blocked`
3. **Visa certainty** — blocks "will certainly get a visa" etc.
4. **Injection in retrieved content** — flags evidence items containing injection patterns; grounding downgraded
5. **Freshness warnings** — propagated from evidence items
6. **Conflict propagation** — conflicts remain in structured response
7. **Deterministic result extraction** — eligibility/NBA values cannot be overridden by model text

---

## Prompt Injection Boundary

User text, agent statements, institution descriptions, and source text are all treated as **untrusted content**.

- System/provider instructions clearly separate DATA from INSTRUCTIONS
- Retrieved evidence cannot override Copilot policy
- Instructions found inside retrieved records are not executed
- Evidence items with injection patterns are flagged and evidence value sanitized to `[Content withheld: injection pattern detected]`

---

## No Autonomous Account Actions

The Copilot in Mission 19 is **read-only**. It cannot:
- Submit applications
- Send messages
- Book consultations
- Share Vault documents
- Spend credits or make payments
- Create cases
- Change profile or Journey state
- Publish institution data

Recommendations produced by the Copilot must be acted on explicitly by the user through normal application flows.

---

## Bounded Retrieval

| Bound | Value |
|-------|-------|
| Max question length | 1000 characters |
| Max entity references | 5 per request |
| Max evidence items | 30 per packet |
| Max history messages | 6 |
| Max retrieval entities | 10 per retrieval call |

---

## Context Types and Intent Routing

**Context types** (bounded scope):
`general_guidance`, `tests`, `test_acceptance`, `programs`, `scholarships`, `eligibility`, `journey`, `institution`, `comparison`

**Intent categories** (deterministic routing):
`test_question`, `acceptance_question`, `program_search`, `scholarship_search`, `eligibility_question`, `journey_question`, `institution_question`, `comparison`, `profile_gap`, `general`

No autonomous planner. No unrestricted agent tool execution.

---

## UX

**Route**: `/copilot` (authenticated Student only)

**Features**:
- Question input (bounded)
- Context type selector
- Evidence/source cards with Official / Strideto / AI synthesis labels
- Freshness warnings per evidence item
- Conflict display with recommendation
- Deterministic eligibility/match/journey pass-through
- Suggested follow-up questions
- Provider-not-configured state (truthful — no fake AI success)
- Loading and error states

**Contextual entry points** (`CopilotWidget`):
Deep-links from Test/Program/Scholarship/Institution detail pages and Journey dashboard to the Copilot with preselected context and entity refs. One Copilot engine — no duplicate implementation.

---

## Audit and Observability

### Audit (safe metadata)
`copilot.request` audit events contain:
- `intent`, `contextType`
- `groundingStatus`, `policyBlocked`
- `evidenceCount`, `conflictCount`
- `providerState`, `latencyMs`

Not logged by default: full question/answer text, Student profile details, Vault contents, payment data, raw credentials.

### Observability fields
`_observability` in each response: retrievalCount, evidenceCount, groundingStatus, freshnessWarningCount, conflictCount, policyBlocked, latencyMs, providerState.

---

## Access Control

| Realm | Access |
|-------|--------|
| Authenticated Student | Own Copilot context only |
| Agent | No access to Student Copilot conversations |
| Institution | No access to Student Copilot context |
| Employer | No access |
| Admin | Not via Copilot (separate admin tools) |

---

## Tests

Run: `node server/src/__tests__/copilot.test.js`

53 tests covering:
- Shared contract constants and guards (1–7)
- Intent classification (8–10)
- Evidence packet assembly (11–16)
- Provider state honesty — no real AI calls (17–20)
- Grounding validator: citations, guarantee policy, injection, freshness (21–37)
- Source priority and attribution (38–40)
- Unsupported claims and conflicts (41–45)
- Privacy and isolation (46–50)
- Plus additional sub-cases (24b, 25b, 26b)

All tests are pure-contract: no DB, no network, no real AI provider.

---

## Production AI Provider Prerequisites

Before enabling production AI synthesis:

1. **Provider/model selection** — choose and document approved vendor and model
2. **Credentials** — stored in secrets manager; never in code or env files checked into version control
3. **Regional/privacy configuration** — confirm data-processing terms, data residency, and retention policy
4. **Rate and cost controls** — per-user and per-day limits; cost alerting
5. **Observability** — latency, error rate, policy block rate (not raw prompts)
6. **Evaluation set** — run Mission 19 behavioral fixtures plus any new cases before launch
7. **Production safety acceptance** — guarantee language, visa certainty, prompt injection, cross-user privacy

---

## Explicit Statement

**No real AI model or provider calls are made anywhere in Mission 19.**

All tests use deterministic mock responses only (`COPILOT_MOCK=true`).
No student data is sent to external models.
No Vault documents are read by AI.
No autonomous account actions are permitted.
No live database migrations or backfills are performed.
