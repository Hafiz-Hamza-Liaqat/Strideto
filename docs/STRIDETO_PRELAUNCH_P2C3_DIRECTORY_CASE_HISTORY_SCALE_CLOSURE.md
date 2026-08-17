# STRIDETO P2C-3 directory and Case-history pre-scale closure

## Scope

This phase removes public Education directory ID materialization in Node and bounds ProfessionalCase repeatable child histories. Education discovery semantics, Case authority, exact Vault grants, historical service snapshots, trust lifecycle, contextual messages, and all Business boundaries remain unchanged.

## Public directory

Previously, each `/agents` request loaded every approved `OrganizationVerification.organizationId` into Node. A service-category request also loaded every matching `AgentService.organizationId`, intersected both arrays in JavaScript, then passed the resulting unbounded `$in` list to the final bounded profile query.

The directory now runs one `AgentProfile` aggregation:

1. Apply public fixture exclusion and country, destination, language, or Provider-type filters.
2. Use an indexed lookup to require the canonical approved organization-verification record.
3. When category filtering is present, use an indexed existence lookup for an active Education service with the exact canonical category.
4. Preserve deterministic `createdAt DESC, _id DESC` order.
5. Use one facet for the requested 20-item window and unique Provider total.
6. Project only the established public card fields.

No approved-organization or service-organization ID population crosses into Node. Multiple matching services do not duplicate a Provider. Archived services do not qualify. The maximum page limit remains 50.

The disposable fixture contained 250 Provider profiles, 250 verification records, and 500 Education services. Baseline and combined-filter plans used indexes without a collection scan. The normal directory page was 8,107 bytes. A narrow create-only `{ createdAt: -1, _id: -1 }` index named `education_public_directory_created` supports deterministic baseline traversal; provisioning is idempotent, preserves unrelated indexes, and never uses index synchronization or dropping.

## ProfessionalCase child classification

| Resource | Classification | Contract |
| --- | --- | --- |
| Applications | High growth | Independent page/limit, default 20, maximum 50, chronological stable order |
| Tasks | High growth/actionable | Independent page/limit plus server-side open/completed/cancelled/all filter; open is the UI default |
| Document requests | High growth | Independent page/limit; exact Vault resolution remains a separate parent-authorized operation |
| Timeline/events | Highest growth | Independent page/limit, chronological stable order |
| Notes | Repeatable/moderate | Bounded independent window; Student query retains shared-only visibility |
| Approval requests | Repeatable/moderate | Bounded independent window; decision authority unchanged |
| Outcome | Singleton Case state | No pagination required |
| Case thread | Singleton | No pagination required |
| Messages | Existing high growth | Existing contextual 20/default, 50/maximum pagination preserved |
| Application status history | Practically small embedded history | Retained with its bounded application record; no separate collection/query |

Each Case-detail response returns a `childPagination` map. Provider and Student views expose compact Previous/Page/Next controls independently for each section. Page changes request only the selected child window and do not prefetch later pages. An out-of-range window is normalized back to the last valid page. Open tasks remain the default, so large completed history cannot hide current work.

The disposable large Case used 65 applications, 100 tasks, 100 document requests, 250 timeline events, 35 notes, and 35 approvals. The initial bounded response was 32,114 bytes: applications 11,111 bytes, tasks 4,201 bytes, documents 5,721 bytes, and timeline 2,021 bytes. Child queries use the existing parent `caseId` indexes and examine only that Case's population. Their bounded parent-scoped sorts do not justify broad secondary index expansion before measured load certification.

## Security and truth

- Student and Provider authorization is resolved from the parent ProfessionalCase before any child query.
- Student note visibility remains `shared` only.
- Document requests never project Vault document IDs or storage references; exact active grants are rechecked by the existing resolution operation.
- Completed Case mutation rules, application status authority, Student consent, review/report/dispute eligibility, and Case/Consultation message isolation are unchanged.
- Consultation service snapshots remain the preferred Case service source; the legacy live-service fallback is unchanged only for pre-snapshot records.
- Public directory projection does not expose private email, evidence, team, Business capability, or Case data.

## Verification and deferred work

Focused source and Mongo suites cover query shape, combined filters, archived-service exclusion, unique totals, all child windows, task visibility, parent isolation, response sizes, execution plans, and create-only index provisioning. P1A, P2A, P2B, P2C-1, P2C-2, authentication, and product-separation regressions are required before closure.

P2D retains the Notifications filter labels, Admin Marketplace dark-theme/h1 defects, small Provider/Customer operational attention queues, Business Client quote prioritization, partial document titles, and the non-blocking Chromium SVG manifest-icon diagnostic. Final four-theme/manual acceptance and load/concurrency/stress/soak certification remain later gates.
