# Strideto Mission 15 — Verified Reviews, Reports, and Disputes

Mission 15 adds the trust-after-interaction layer without changing Missions 0–14 privacy or authority boundaries.

## Reviews

Review eligibility is derived server-side from an authenticated Student's completed Consultation or closed, process-completed ProfessionalCase. The anchor supplies the organization and assigned membership; arbitrary profiles, leads, saved posts, and client-supplied verification claims are not valid. A unique interaction constraint permits one review per Student interaction.

`ProfessionalReview` uses a 1–5 rating, bounded optional dimensions/title/text, explicit lifecycle, immutable derived `verifiedInteraction`, private moderation metadata, and one bounded organization response. Students may edit or withdraw their own non-finally-moderated review. Agents cannot edit, remove, or change its rating. Published verified reviews alone feed truthful count/average metrics; an empty set returns `averageRating: null` and zero count. Public projection uses “Verified Student,” safe interaction granularity, and a labelled Agent/Agency response; it excludes private identity, meeting, case, message, document, and moderation data. Verified means linked to a real Strideto interaction, not endorsed or legally proven.

## Reports and disputes

`ProfessionalReport` supports bounded validated targets, categories, severity, evidence references, and submitted-to-resolution states. Reporter identity is private on Agent surfaces; a report is an allegation, not proof of guilt. Message targets are authorized through their existing consultation/case thread and generic records never copy message or file content.

`ProfessionalDispute` requires a legitimate completed consultation, eligible closed case, or completed service engagement. Student and active organization members are ID-scoped parties. Events append to its timeline; neither party can set proposed/final resolution, dismissal, closure, or escalation states. Evidence stores typed record IDs only. A dispute grants no Vault or inbox access: Mission 10 exact grants and Missions 13/14 contextual messaging remain authoritative.

## Moderation, audit, and notification

The bounded staff queue covers reviews under review, reports, disputes, status, severity, organization and age. Moderators may inspect, triage, moderate content, request information, and recommend/escalate organization action. Admin/SuperAdmin authority is required for normal final resolution. Serious organization action remains a recommendation into Mission 2 verification authority; Mission 15 creates no parallel suspension system.

Review publication/withdrawal/response, report submission, dispute opening/response, and moderation actions emit safe audit metadata. Pending internal events cover review receipt, Agent response, report status, dispute action, resolution, and moderation; there is no delivery worker or external delivery.

## UX and boundaries

Student APIs and Trust Center expose eligibility, own reviews/reports/disputes, and timelines. Agent Portal exposes organization reviews/responses, privacy-safe actionable reports, and disputes. Approved public profiles show verified aggregates and review cards. Payment, refund, chargeback, escrow, payout, and financial-dispute actions are absent: Mission 16 owns Commerce Foundation and Mission 17 owns payments and financial disputes.

Focused Mission 15 behavioral/security contracts cover the required 40 trust assertions. The frontend production build validates the shared client, Student/Agent trust surfaces, and public projection. No live data, migration, backfill, notification, worker, payment, push, or deployment was performed.
