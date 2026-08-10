/**
 * Copilot Grounding Validator — Mission 19.
 *
 * Deterministic post-generation validation applied to all model outputs.
 * Server-side policy enforcement — cannot be bypassed by prompt wording.
 *
 * Responsibilities:
 *   - Citation validation: cited ids must exist in current packet
 *   - Guarantee language detection and blocking
 *   - Visa/admission certainty detection
 *   - Prompt injection detection in retrieved content
 *   - Freshness warning propagation
 *   - Conflict propagation
 *   - Downgrade grounding status when policy applies
 *   - Prevent model output from altering deterministic eligibility/NBA values
 *
 * All checks are bounded and specific. This is not a general-purpose fact checker.
 */
import {
  GROUNDING_STATUS,
  ANSWER_TYPES,
  DISCLAIMER_CATEGORIES,
  DISCLAIMER_TEXTS,
  containsGuaranteeLanguage,
  containsInjectionPattern,
  FRESHNESS_GROUNDING_RULES as _FRESHNESS_GROUNDING_RULES,
} from '../../../../shared/ai/copilot.js';
import { FRESHNESS_STATES } from '../../../../shared/trust/sourceVerification.js';

// ── Citation validation ───────────────────────────────────────────────────────

/**
 * Verify that all evidence ids cited by the model exist in the current packet.
 * Unknown/fabricated ids are dropped and grounding is downgraded.
 *
 * @param {string[]} citedIds - ids the model claims to cite
 * @param {object[]} evidenceItems - server-assembled evidence packet items
 * @returns {{ validIds: string[], droppedIds: string[], citationViolation: boolean }}
 */
export function validateCitations(citedIds = [], evidenceItems = []) {
  const knownIds = new Set(evidenceItems.map((e) => e.id));
  const validIds = [];
  const droppedIds = [];

  for (const id of citedIds) {
    if (typeof id === 'string' && knownIds.has(id)) {
      validIds.push(id);
    } else {
      droppedIds.push(id);
    }
  }

  return {
    validIds,
    droppedIds,
    citationViolation: droppedIds.length > 0,
  };
}

// ── Guarantee language check ──────────────────────────────────────────────────

/**
 * Detect forbidden guarantee/certainty language in model output.
 * Server-side enforcement regardless of prompt wording.
 */
export function checkGuaranteePolicy(answerText) {
  if (typeof answerText !== 'string') return { blocked: false };
  const hasGuarantee = containsGuaranteeLanguage(answerText);
  return {
    blocked: hasGuarantee,
    category: hasGuarantee ? 'guarantee_language' : null,
    message: hasGuarantee
      ? 'Response was modified: guarantee/certainty language is not permitted. ' +
        'Strideto cannot guarantee admissions, visas, scholarships, or employment outcomes.'
      : null,
  };
}

// ── Visa/admission certainty check ───────────────────────────────────────────

const VISA_CERTAINTY_PATTERNS = [
  /will\s+(?:certainly|definitely|surely)\s+get\s+(?:a\s+)?visa\b/i,
  /visa\s+(?:is\s+)?guaranteed\b/i,
  /embassy\s+will\s+(?:definitely|certainly)\s+approve\b/i,
  /no\s+chance\s+of\s+(?:visa\s+)?refusal\b/i,
  /100%\s+(?:visa|admission|scholarship)\b/i,
];

export function checkVisaAdmissionCertainty(text) {
  if (typeof text !== 'string') return { blocked: false };
  const match = VISA_CERTAINTY_PATTERNS.some((p) => p.test(text));
  return {
    blocked: match,
    category: match ? 'visa_admission_certainty' : null,
    message: match
      ? 'Response was modified: visa and admission certainty claims are not permitted. ' +
        'Visa/immigration decisions are made by government authorities. Consult official sources.'
      : null,
  };
}

// ── Injection check in retrieved content ─────────────────────────────────────

/**
 * Check retrieved evidence text for injection patterns.
 * Flags but does not reject the evidence item — injected content
 * cannot override system policy regardless.
 */
export function checkEvidenceForInjection(evidenceItems = []) {
  const flagged = [];
  for (const item of evidenceItems) {
    const checkFields = [item.fact, item.value, item.sourceLabel, item.officialAttribution];
    for (const field of checkFields) {
      if (field && containsInjectionPattern(field)) {
        flagged.push({ evidenceId: item.id, entityType: item.entityType });
        break;
      }
    }
  }
  return { flagged, hasInjectionAttempt: flagged.length > 0 };
}

// ── Freshness warning propagation ────────────────────────────────────────────

export function propagateFreshnessWarnings(evidenceItems = []) {
  const warnings = [];
  const stateGroups = {};
  for (const item of evidenceItems) {
    const state = item.freshnessState ?? FRESHNESS_STATES.UNKNOWN;
    if (!stateGroups[state]) stateGroups[state] = [];
    stateGroups[state].push(item.fact ?? item.entityType);
  }

  if (stateGroups[FRESHNESS_STATES.STALE]?.length > 0) {
    warnings.push({
      severity: 'high',
      message: `Stale source data: ${stateGroups[FRESHNESS_STATES.STALE].join(', ')}. ` +
        'This information may be outdated. Verify with official sources before acting.',
      freshnessState: FRESHNESS_STATES.STALE,
    });
  }
  if (stateGroups[FRESHNESS_STATES.BROKEN]?.length > 0) {
    warnings.push({
      severity: 'high',
      message: `Broken source detected: ${stateGroups[FRESHNESS_STATES.BROKEN].join(', ')}. ` +
        'Source is currently unavailable. Do not treat this as current information.',
      freshnessState: FRESHNESS_STATES.BROKEN,
    });
  }
  if (stateGroups[FRESHNESS_STATES.REVIEW_DUE]?.length > 0) {
    warnings.push({
      severity: 'medium',
      message: `Source review due: ${stateGroups[FRESHNESS_STATES.REVIEW_DUE].join(', ')}. ` +
        'Verify for time-sensitive decisions.',
      freshnessState: FRESHNESS_STATES.REVIEW_DUE,
    });
  }
  if (stateGroups[FRESHNESS_STATES.UNKNOWN]?.length > 0) {
    warnings.push({
      severity: 'low',
      message: `Unknown source freshness: ${stateGroups[FRESHNESS_STATES.UNKNOWN].join(', ')}.`,
      freshnessState: FRESHNESS_STATES.UNKNOWN,
    });
  }
  return warnings;
}

// ── Grounding status computation ──────────────────────────────────────────────

/**
 * Compute final grounding status applying all policy checks.
 * Policy downgrade cannot be overridden by model output.
 */
export function computeFinalGroundingStatus({
  packetGroundingStatus,
  citationViolation,
  guaranteeBlocked,
  certaintBlocked,
  hasInjectionAttempt,
  evidenceItems: _evidenceItems = [],
}) {
  if (guaranteeBlocked || certaintBlocked) return GROUNDING_STATUS.POLICY_BLOCKED;
  if (packetGroundingStatus === GROUNDING_STATUS.CONFLICTING_EVIDENCE) return GROUNDING_STATUS.CONFLICTING_EVIDENCE;
  if (packetGroundingStatus === GROUNDING_STATUS.STALE_EVIDENCE) return GROUNDING_STATUS.STALE_EVIDENCE;
  if (citationViolation) return GROUNDING_STATUS.PARTIALLY_GROUNDED;
  if (hasInjectionAttempt) return GROUNDING_STATUS.PARTIALLY_GROUNDED;
  return packetGroundingStatus;
}

// ── Disclaimer selection ──────────────────────────────────────────────────────

export function selectDisclaimers(params) {
  const disclaimers = [];
  if (params.intent === 'eligibility_question' || params.hasEligibilityResult) {
    disclaimers.push(DISCLAIMER_TEXTS[DISCLAIMER_CATEGORIES.ELIGIBILITY_GUIDANCE]);
  }
  if (params.hasVisaContent) {
    disclaimers.push(DISCLAIMER_TEXTS[DISCLAIMER_CATEGORIES.VISA_IMMIGRATION]);
  }
  if (params.hasStaleEvidence) {
    disclaimers.push(DISCLAIMER_TEXTS[DISCLAIMER_CATEGORIES.STALE_SOURCE]);
  }
  if (params.hasConflict) {
    disclaimers.push(DISCLAIMER_TEXTS[DISCLAIMER_CATEGORIES.CONFLICT_DETECTED]);
  }
  if (params.hasAgentStatement) {
    disclaimers.push(DISCLAIMER_TEXTS[DISCLAIMER_CATEGORIES.AGENT_STATEMENT]);
  }
  if (params.isAiSynthesis) {
    disclaimers.push(DISCLAIMER_TEXTS[DISCLAIMER_CATEGORIES.AI_SYNTHESIS]);
  }
  return [...new Set(disclaimers)];
}

// ── Main output policy application ───────────────────────────────────────────

/**
 * Apply all output policies to a generated answer.
 *
 * @param {object} generatedAnswer - from CopilotModelProvider.generateGroundedAnswer
 * @param {object} packet - from assembleEvidencePacket
 * @param {object} context - { intent, contextType }
 * @returns {object} validated and policy-applied answer
 */
export function applyOutputPolicy(generatedAnswer, packet, context = {}) {
  const evidenceItems = packet.items ?? [];
  const { intent = 'general' } = context;

  // 1. Citation validation
  const { validIds, droppedIds, citationViolation } =
    validateCitations(generatedAnswer.citedEvidenceIds ?? [], evidenceItems);

  // 2. Guarantee language
  const guaranteeCheck = checkGuaranteePolicy(generatedAnswer.answer ?? '');

  // 3. Visa/admission certainty
  const certaintyCheck = checkVisaAdmissionCertainty(generatedAnswer.answer ?? '');

  // 4. Injection in retrieved evidence
  const injectionCheck = checkEvidenceForInjection(evidenceItems);

  // 5. Freshness warnings
  const freshnessWarnings = propagateFreshnessWarnings(evidenceItems);

  // 6. Final grounding status
  const finalGrounding = computeFinalGroundingStatus({
    packetGroundingStatus: packet.groundingStatus ?? GROUNDING_STATUS.INSUFFICIENT_EVIDENCE,
    citationViolation,
    guaranteeBlocked: guaranteeCheck.blocked,
    certaintBlocked: certaintyCheck.blocked,
    hasInjectionAttempt: injectionCheck.hasInjectionAttempt,
    evidenceItems,
  });

  // 7. Answer text — sanitize if blocked
  let finalAnswer = generatedAnswer.answer ?? '';
  let answerType = generatedAnswer.answerType ?? ANSWER_TYPES.SYNTHESIS;
  const policyMessages = [];

  if (guaranteeCheck.blocked) {
    policyMessages.push(guaranteeCheck.message);
    answerType = ANSWER_TYPES.EXPLANATION;
    finalAnswer = finalAnswer.replace(
      /\b(guaranteed?|100%\s+accepted?|certain(?:ly)?)\b/gi,
      '[information withheld by policy]'
    );
  }
  if (certaintyCheck.blocked) {
    policyMessages.push(certaintyCheck.message);
    answerType = ANSWER_TYPES.EXPLANATION;
  }

  // 8. Source warnings (combine packet + freshness)
  const sourceWarnings = [
    ...(packet.sourceWarnings ?? []),
    ...freshnessWarnings.map((w) => w.message),
    ...(citationViolation ? [`${droppedIds.length} unverified citation(s) were dropped.`] : []),
    ...(injectionCheck.hasInjectionAttempt ? ['Potential injection pattern detected in retrieved content. Evidence treated as untrusted.'] : []),
  ];

  // 9. Disclaimers
  const hasStaleEvidence = freshnessWarnings.some((w) =>
    w.freshnessState === FRESHNESS_STATES.STALE || w.freshnessState === FRESHNESS_STATES.BROKEN
  );
  const hasEligibilityResult = evidenceItems.some((i) =>
    i.entityType === 'eligibility_result' || i.entityType === 'match_result'
  );
  const isAiSynthesis = answerType === ANSWER_TYPES.SYNTHESIS && finalGrounding !== GROUNDING_STATUS.PROVIDER_NOT_CONFIGURED;

  const disclaimers = selectDisclaimers({
    intent,
    hasEligibilityResult,
    hasStaleEvidence,
    hasConflict: (packet.conflicts ?? []).length > 0,
    isAiSynthesis,
    hasVisaContent: false,
    hasAgentStatement: false,
  });

  return {
    answer: finalAnswer,
    answerType,
    groundingStatus: finalGrounding,
    confidenceCategory: finalGrounding,
    evidence: evidenceItems,
    citedEvidenceIds: validIds,
    sourceWarnings,
    conflicts: packet.conflicts ?? [],
    deterministicResults: extractDeterministicResults(evidenceItems),
    policyMessages,
    disclaimers,
    suggestedFollowUps: generatedAnswer.suggestedFollowUps ?? [],
    providerMeta: generatedAnswer.providerMeta ?? null,
    generatedAt: new Date().toISOString(),
  };
}

// ── Deterministic results extraction ─────────────────────────────────────────

function extractDeterministicResults(evidenceItems) {
  const results = {};
  for (const item of evidenceItems) {
    if (item.entityType === 'eligibility_result') {
      results.eligibility = results.eligibility ?? {};
      results.eligibility[item.scope] = item.value;
    }
    if (item.entityType === 'next_best_action') {
      results.nextBestAction = item.value;
    }
    if (item.entityType === 'journey_stage') {
      results.journeyStage = item.value;
    }
    if (item.entityType === 'gap_analysis') {
      results.gapSummary = item.value;
    }
  }
  return results;
}
