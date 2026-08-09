# Strideto Mission 14 — Professional Case Management

Mission 14 adds consent-based professional cases without changing Missions 0–13 boundaries. A case belongs to one Student, one organization, and explicit active assigned members. It originates from an assigned completed consultation; an Agent proposes it and only the Student activates or rejects it.

## Model, workflows, and control

`ProfessionalCase` stores type, stable workflow id/version, lifecycle, current stage, assignment, optional consultation/relationship and opportunity references, dates, process completion, external result, and outcome. Study, scholarship, work, visit, business, guidance, and fallback workflows have type-specific stages and server-enforced adjacent transitions. Lifecycle is separate from stage.

System timeline events are append-only. Human notes are separate: shared notes are Student-visible; Agent-private bodies never enter Student projections or audit metadata. High-value application, document, submission, scope, transfer, and closure actions use Student approval requests. Only the owning Student can decide them.

Submission tracking supports truthful Student self-submission and Agent-assisted external submission after approval. It records `submittedByStrideto: false`; the future integration value is rejected. Process completion and external success remain distinct.

## Tasks, documents, and messaging

Case tasks have an explicit Student/Agent owner, status, optional due date and requirement reference; they do not overwrite canonical requirements. A document request grants zero access. Sharing requires the exact owned Vault document and an active, unexpired, non-revoked view grant for the exact assigned membership and case. Mission 10 stays authoritative, so revocation blocks the next access immediately.

Case messaging uses a distinct contextual case thread, available only to the Student and explicitly authorized active organization members. It is not arbitrary DM, public, Employer, or Admin messaging. Message bodies are excluded from generic audit metadata.

## Exit, transfer, outcomes, and events

Students can reject or close a case without deleting their Profile, Journey, Vault documents, or factual history. Closure makes messaging read-only. Transfer requires exact Student approval and an active same-organization target; the old participant is removed, while Vault grants and private notes are not copied. An outcome never guarantees admission, visa, scholarship, or employment success.

Proposal, approval, stage, document, message, assignment, and closure changes create pending notification event records only. No delivery worker is started. Audit metadata excludes messages, note bodies, file content, storage keys, and identity-document details.

## UX, security, and verification

Authenticated `/cases` and `/cases/:id` views show lifecycle/stage, tasks, document requests, approvals, timeline, consent, and closure. `/agent/cases` and `/agent/cases/:id` show explicitly assigned cases with workflow and privacy summaries.

The API derives Student identity from auth, requires the Agent realm for Agent mutations, scopes every Agent query to active membership and organization, denies cross-case IDs, bounds pagination/text, and exposes no Employer/Admin bypass or implicit Vault access.

Focused Mission 14 verification covers 55 behavioral/security assertions. Mission 13, 10, 9, and 11 contracts were consumed without modification, so regression suites were not required. The frontend production build covers new routes and pages. Mission 15 owns reviews/reports/disputes; Missions 16–17 own commerce/payments.
