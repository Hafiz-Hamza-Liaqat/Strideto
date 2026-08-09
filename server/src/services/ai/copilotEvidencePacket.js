/**
 * Copilot Evidence Packet — Mission 19.
 *
 * Assembles a deterministic, server-side EvidencePacket from retrieval results.
 * Every authoritative fact supplied to the model carries structured metadata.
 *
 * Client CANNOT forge evidence items. All items originate from server retrieval.
 *
 * Source priority follows Mission 5 authority hierarchy:
 *   official government/provider/institution
 *   > verified institution-submitted (Mission 18)
 *   > canonical secondary source
 *   > Strideto derived recommendation
 *   > agent/AI statement
 *
 * Freshness rules follow Mission 5 FRESHNESS_STATES.
 */
import { randomUUID } from 'crypto';
import {
  EVIDENCE_ENTITY_TYPES,
  SOURCE_STATEMENT_TYPES,
  COPILOT_BOUNDS,
  GROUNDING_STATUS,
  containsInjectionPattern,
} from '../../../../shared/ai/copilot.js';
import { FRESHNESS_STATES, authorityTier } from '../../../../shared/trust/sourceVerification.js';

const MAX_ITEMS = COPILOT_BOUNDS.MAX_EVIDENCE_ITEMS;

// ── Evidence item builder ─────────────────────────────────────────────────────

function makeId() {
  return randomUUID().replace(/-/g, '').slice(0, 16);
}

function sanitizeText(text, maxLen = 500) {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim().slice(0, maxLen);
  if (containsInjectionPattern(trimmed)) {
    return '[Content withheld: injection pattern detected]';
  }
  return trimmed;
}

function buildEvidenceItem({
  entityType,
  entityId = null,
  scope = 'global',
  fact,
  value = null,
  sourceType,
  sourceAuthority = null,
  sourceLabel = null,
  verificationState = null,
  freshnessState = FRESHNESS_STATES.UNKNOWN,
  lastVerifiedAt = null,
  effectiveDateFrom = null,
  effectiveDateTo = null,
  officialAttribution = null,
  publicSafeUrl = null,
}) {
  return {
    id: makeId(),
    entityType,
    entityId: entityId ? String(entityId) : null,
    scope,
    fact: sanitizeText(fact, 200) ?? 'unknown',
    value: sanitizeText(value, 500),
    sourceType,
    sourceAuthority,
    sourceLabel: sanitizeText(sourceLabel, 200),
    verificationState,
    freshnessState,
    lastVerifiedAt: lastVerifiedAt ?? null,
    effectiveDateFrom: effectiveDateFrom ?? null,
    effectiveDateTo: effectiveDateTo ?? null,
    officialAttribution: sanitizeText(officialAttribution, 300),
    publicSafeUrl: publicSafeUrl ?? null,
  };
}

// ── Packet assembly from retrieval result ─────────────────────────────────────

export function assembleEvidencePacket(retrievalResult) {
  const items = [];

  // Tests
  for (const test of (retrievalResult.tests ?? [])) {
    items.push(buildEvidenceItem({
      entityType: EVIDENCE_ENTITY_TYPES.TEST,
      entityId: test.entityId,
      scope: 'global',
      fact: `Test: ${test.name ?? test.abbreviation}`,
      value: [
        test.name,
        test.abbreviation,
        test.category,
        test.administeredBy,
      ].filter(Boolean).join(' | '),
      sourceType: SOURCE_STATEMENT_TYPES.OFFICIAL_FACT,
      sourceAuthority: 'official_test_org',
      sourceLabel: test.administeredBy ?? null,
      verificationState: 'verified',
      freshnessState: FRESHNESS_STATES.FRESH,
      publicSafeUrl: test.website ?? null,
    }));
  }

  // TestAcceptances
  for (const ta of (retrievalResult.testAcceptances ?? [])) {
    items.push(buildEvidenceItem({
      entityType: EVIDENCE_ENTITY_TYPES.TEST_ACCEPTANCE,
      entityId: ta.entityId,
      scope: ta.scope ?? 'unknown',
      fact: `Test Acceptance: ${ta.testName ?? ta.testAbbreviation ?? 'Test'} — ${ta.scope ?? ''}`,
      value: [
        `Status: ${ta.acceptanceStatus}`,
        ta.minimumScore ? `Min score: ${JSON.stringify(ta.minimumScore)}` : null,
        ta.notes,
      ].filter(Boolean).join(' | '),
      sourceType: SOURCE_STATEMENT_TYPES.OFFICIAL_FACT,
      sourceAuthority: 'university',
      sourceLabel: 'Strideto Test Acceptance Database',
      verificationState: null,
      freshnessState: ta.freshnessState ?? FRESHNESS_STATES.UNKNOWN,
      lastVerifiedAt: ta.lastVerifiedAt ?? null,
    }));
  }

  // Programs
  for (const prog of (retrievalResult.programs ?? [])) {
    items.push(buildEvidenceItem({
      entityType: EVIDENCE_ENTITY_TYPES.PROGRAM,
      entityId: prog.entityId,
      scope: 'program',
      fact: `Program: ${prog.name}`,
      value: [
        prog.country,
        prog.degreeLevel,
        prog.field,
        prog.studyMode,
        prog.tuitionFee ? `Tuition: ${JSON.stringify(prog.tuitionFee)}` : null,
      ].filter(Boolean).join(' | '),
      sourceType: SOURCE_STATEMENT_TYPES.CANONICAL_SECONDARY,
      sourceAuthority: 'university',
      sourceLabel: 'Strideto Program Database',
      freshnessState: prog.freshnessState ?? FRESHNESS_STATES.UNKNOWN,
      lastVerifiedAt: prog.lastVerifiedAt ?? null,
    }));
  }

  // Scholarships
  for (const sch of (retrievalResult.scholarships ?? [])) {
    const hasDeadline = sch.activeDeadlines?.length > 0;
    items.push(buildEvidenceItem({
      entityType: EVIDENCE_ENTITY_TYPES.SCHOLARSHIP,
      entityId: sch.entityId,
      scope: 'scholarship',
      fact: `Scholarship: ${sch.name}`,
      value: [
        sch.provider,
        sch.country,
        sch.fundingType,
        sch.coverageDetails,
        hasDeadline ? `Deadline: ${sch.activeDeadlines[0].deadline ?? 'see details'}` : 'No current deadline found',
      ].filter(Boolean).join(' | '),
      sourceType: SOURCE_STATEMENT_TYPES.CANONICAL_SECONDARY,
      sourceAuthority: 'scholarship_provider',
      sourceLabel: sch.provider ?? 'Strideto Scholarship Database',
      freshnessState: sch.freshnessState ?? FRESHNESS_STATES.UNKNOWN,
      lastVerifiedAt: sch.lastVerifiedAt ?? null,
    }));
  }

  // Institutions
  for (const inst of (retrievalResult.institutions ?? [])) {
    items.push(buildEvidenceItem({
      entityType: inst.isVerifiedInstitution ? EVIDENCE_ENTITY_TYPES.INSTITUTION_OFFICIAL : EVIDENCE_ENTITY_TYPES.INSTITUTION,
      entityId: inst.entityId,
      scope: 'institution',
      fact: `Institution: ${inst.displayName}`,
      value: [inst.country, inst.type, inst.description].filter(Boolean).join(' | '),
      sourceType: inst.isVerifiedInstitution
        ? SOURCE_STATEMENT_TYPES.INSTITUTION_SUBMITTED
        : SOURCE_STATEMENT_TYPES.CANONICAL_SECONDARY,
      sourceAuthority: 'university',
      sourceLabel: inst.isVerifiedInstitution ? inst.displayName : 'Strideto Institution Database',
      verificationState: inst.isVerifiedInstitution ? 'verified' : null,
      freshnessState: inst.isVerifiedInstitution ? FRESHNESS_STATES.FRESH : FRESHNESS_STATES.UNKNOWN,
      lastVerifiedAt: inst.verifiedAt ?? null,
      officialAttribution: inst.officialAttribution ?? null,
      publicSafeUrl: inst.website ?? null,
    }));
  }

  // Eligibility results
  if (retrievalResult.eligibility) {
    for (const [key, eligResult] of Object.entries(retrievalResult.eligibility)) {
      if (!eligResult || eligResult.error) continue;
      items.push(buildEvidenceItem({
        entityType: EVIDENCE_ENTITY_TYPES.ELIGIBILITY_RESULT,
        entityId: eligResult.entityId ?? null,
        scope: key,
        fact: `Eligibility: ${key}`,
        value: eligResult.overallEligibility ?? eligResult.eligibilityState ?? 'unknown',
        sourceType: SOURCE_STATEMENT_TYPES.STRIDETO_DERIVED,
        sourceAuthority: null,
        sourceLabel: 'Strideto Eligibility Engine (Mission 8)',
        verificationState: null,
        freshnessState: FRESHNESS_STATES.FRESH,
        lastVerifiedAt: new Date().toISOString(),
      }));
    }
  }

  // Gap analysis
  if (retrievalResult.gapAnalysis && !retrievalResult.gapAnalysis.error) {
    const gaps = retrievalResult.gapAnalysis;
    items.push(buildEvidenceItem({
      entityType: EVIDENCE_ENTITY_TYPES.GAP_ANALYSIS,
      entityId: null,
      scope: 'profile',
      fact: 'Profile Gap Analysis',
      value: Array.isArray(gaps.gaps)
        ? gaps.gaps.slice(0, 5).map((g) => `${g.field}: ${g.severity}`).join(', ')
        : 'Gap analysis available',
      sourceType: SOURCE_STATEMENT_TYPES.STRIDETO_DERIVED,
      sourceLabel: 'Strideto Gap Analysis (Mission 8)',
      freshnessState: FRESHNESS_STATES.FRESH,
      lastVerifiedAt: new Date().toISOString(),
    }));
  }

  // Journey/NBA
  if (retrievalResult.journeyContext) {
    const jc = retrievalResult.journeyContext;
    if (jc.journeyPlan) {
      items.push(buildEvidenceItem({
        entityType: EVIDENCE_ENTITY_TYPES.JOURNEY_STAGE,
        entityId: null,
        scope: 'journey',
        fact: 'Current Journey Stage',
        value: jc.journeyPlan.currentStage?.id ?? 'discovery',
        sourceType: SOURCE_STATEMENT_TYPES.STRIDETO_DERIVED,
        sourceLabel: 'Strideto Journey Planner (Mission 9)',
        freshnessState: FRESHNESS_STATES.FRESH,
        lastVerifiedAt: new Date().toISOString(),
      }));
    }
    if (jc.nextBestAction) {
      items.push(buildEvidenceItem({
        entityType: EVIDENCE_ENTITY_TYPES.NEXT_BEST_ACTION,
        entityId: null,
        scope: 'journey',
        fact: 'Next Best Action',
        value: sanitizeText(jc.nextBestAction.title ?? jc.nextBestAction.type ?? 'See Journey', 200),
        sourceType: SOURCE_STATEMENT_TYPES.STRIDETO_DERIVED,
        sourceLabel: 'Strideto Action Engine (Mission 9)',
        freshnessState: FRESHNESS_STATES.FRESH,
        lastVerifiedAt: new Date().toISOString(),
      }));
    }
  }

  // Student profile context (anonymized label — never exposes sensitive fields)
  if (retrievalResult.studentContext) {
    const sc = retrievalResult.studentContext;
    const summary = [
      sc.goals ? `Goals: ${String(sc.goals).slice(0, 100)}` : null,
      sc.preferences?.destinations?.length ? `Destinations: ${sc.preferences.destinations.slice(0, 3).join(', ')}` : null,
      sc.preferences?.degreeLevel ? `Degree: ${sc.preferences.degreeLevel}` : null,
      sc.profileCompleteness !== null && sc.profileCompleteness !== undefined
        ? `Profile completeness: ${sc.profileCompleteness}%` : null,
    ].filter(Boolean).join('; ');
    if (summary) {
      items.push(buildEvidenceItem({
        entityType: EVIDENCE_ENTITY_TYPES.STUDENT_PROFILE,
        entityId: null,
        scope: 'profile',
        fact: 'Student Profile Context',
        value: summary,
        sourceType: SOURCE_STATEMENT_TYPES.STRIDETO_DERIVED,
        sourceLabel: 'Authenticated Student Profile (Mission 3)',
        freshnessState: FRESHNESS_STATES.FRESH,
        lastVerifiedAt: new Date().toISOString(),
      }));
    }
  }

  // Apply max cap
  const cappedItems = items.slice(0, MAX_ITEMS);

  // Derive source warnings and conflicts
  const sourceWarnings = deriveSourceWarnings(cappedItems);
  const conflicts = detectConflicts(cappedItems);
  const groundingStatus = deriveGroundingStatus(cappedItems, conflicts);

  return {
    items: cappedItems,
    sourceWarnings,
    conflicts,
    groundingStatus,
    assembledAt: new Date().toISOString(),
  };
}

// ── Source warnings ───────────────────────────────────────────────────────────

function deriveSourceWarnings(items) {
  const warnings = [];
  const stale = items.filter((i) => i.freshnessState === FRESHNESS_STATES.STALE || i.freshnessState === FRESHNESS_STATES.BROKEN);
  const reviewDue = items.filter((i) => i.freshnessState === FRESHNESS_STATES.REVIEW_DUE);
  const unknown = items.filter((i) => i.freshnessState === FRESHNESS_STATES.UNKNOWN);

  if (stale.length > 0) {
    warnings.push(`${stale.length} evidence item(s) have outdated or broken sources. Verify with official sources.`);
  }
  if (reviewDue.length > 0) {
    warnings.push(`${reviewDue.length} evidence item(s) are due for source review. Information may have changed.`);
  }
  if (unknown.length > 0) {
    warnings.push(`${unknown.length} evidence item(s) have unknown source freshness.`);
  }
  return warnings;
}

// ── Basic conflict detection ──────────────────────────────────────────────────

function detectConflicts(items) {
  const conflicts = [];
  const byFact = {};
  for (const item of items) {
    const key = item.entityType + ':' + (item.entityId ?? item.fact);
    if (!byFact[key]) byFact[key] = [];
    byFact[key].push(item);
  }
  for (const [key, group] of Object.entries(byFact)) {
    if (group.length < 2) continue;
    const values = [...new Set(group.map((i) => i.value).filter(Boolean))];
    if (values.length > 1) {
      const tiers = group.map((i) => ({
        authority: i.sourceAuthority,
        tier: i.sourceAuthority ? authorityTier(i.sourceAuthority) : 99,
        value: i.value,
        freshness: i.freshnessState,
      }));
      conflicts.push({
        key,
        values,
        sources: tiers.map((t) => ({
          authority: t.authority,
          tier: t.tier,
          value: t.value,
          freshness: t.freshness,
        })),
        recommendation: 'Verify with official source — AI cannot auto-resolve conflicting evidence.',
      });
    }
  }
  return conflicts;
}

// ── Grounding status from evidence ────────────────────────────────────────────

function deriveGroundingStatus(items, conflicts) {
  if (items.length === 0) return GROUNDING_STATUS.INSUFFICIENT_EVIDENCE;
  if (conflicts.length > 0) return GROUNDING_STATUS.CONFLICTING_EVIDENCE;
  const hasStale = items.some((i) => i.freshnessState === FRESHNESS_STATES.STALE || i.freshnessState === FRESHNESS_STATES.BROKEN);
  if (hasStale) return GROUNDING_STATUS.STALE_EVIDENCE;
  const hasFresh = items.some((i) => i.freshnessState === FRESHNESS_STATES.FRESH || i.freshnessState === FRESHNESS_STATES.REVIEW_DUE);
  if (hasFresh) return GROUNDING_STATUS.WELL_GROUNDED;
  return GROUNDING_STATUS.PARTIALLY_GROUNDED;
}
