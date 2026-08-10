/**
 * Evidence-Grounded AI Copilot — shared contract (Mission 19).
 *
 * Client- and server-safe: pure JS, no Node/DOM globals.
 *
 * Defines:
 *   - Context types (bounded scope of each Copilot request)
 *   - Intent categories for deterministic routing
 *   - Grounding status categories
 *   - Answer types
 *   - Evidence entity types + source statement types
 *   - Provider states
 *   - Freshness grounding rules
 *   - Bound constants (question length, entity count, etc.)
 *   - Guarantee-language patterns for output policy
 *   - Source priority mapping reusing Mission 5 authority tiers
 *   - Safe structured response shape
 *
 * No live model calls. No vendor SDK. No DB access.
 */

// ── Context types ─────────────────────────────────────────────────────────────

export const COPILOT_CONTEXT_TYPES = Object.freeze({
  GENERAL_GUIDANCE: 'general_guidance',
  TESTS: 'tests',
  TEST_ACCEPTANCE: 'test_acceptance',
  PROGRAMS: 'programs',
  SCHOLARSHIPS: 'scholarships',
  ELIGIBILITY: 'eligibility',
  JOURNEY: 'journey',
  INSTITUTION: 'institution',
  COMPARISON: 'comparison',
});

const CONTEXT_TYPE_SET = new Set(Object.values(COPILOT_CONTEXT_TYPES));

export function isValidContextType(value) {
  return typeof value === 'string' && CONTEXT_TYPE_SET.has(value);
}

// ── Intent categories (deterministic routing) ─────────────────────────────────

export const COPILOT_INTENT = Object.freeze({
  TEST_QUESTION: 'test_question',
  ACCEPTANCE_QUESTION: 'acceptance_question',
  PROGRAM_SEARCH: 'program_search',
  SCHOLARSHIP_SEARCH: 'scholarship_search',
  ELIGIBILITY_QUESTION: 'eligibility_question',
  JOURNEY_QUESTION: 'journey_question',
  INSTITUTION_QUESTION: 'institution_question',
  COMPARISON: 'comparison',
  PROFILE_GAP: 'profile_gap',
  GENERAL: 'general',
});

const INTENT_SET = new Set(Object.values(COPILOT_INTENT));

export function isValidIntent(value) {
  return typeof value === 'string' && INTENT_SET.has(value);
}

// ── Grounding status ──────────────────────────────────────────────────────────

export const GROUNDING_STATUS = Object.freeze({
  WELL_GROUNDED: 'well_grounded',
  PARTIALLY_GROUNDED: 'partially_grounded',
  INSUFFICIENT_EVIDENCE: 'insufficient_evidence',
  CONFLICTING_EVIDENCE: 'conflicting_evidence',
  STALE_EVIDENCE: 'stale_evidence',
  PROVIDER_NOT_CONFIGURED: 'provider_not_configured',
  POLICY_BLOCKED: 'policy_blocked',
});

const GROUNDING_STATUS_SET = new Set(Object.values(GROUNDING_STATUS));

export function isValidGroundingStatus(value) {
  return typeof value === 'string' && GROUNDING_STATUS_SET.has(value);
}

// ── Answer types ──────────────────────────────────────────────────────────────

export const ANSWER_TYPES = Object.freeze({
  FACT: 'fact',
  RECOMMENDATION: 'recommendation',
  EXPLANATION: 'explanation',
  SYNTHESIS: 'synthesis',
  UNAVAILABLE: 'unavailable',
  CONFLICT: 'conflict',
  DETERMINISTIC: 'deterministic',
  NOT_CONFIGURED: 'not_configured',
  ERROR: 'error',
});

// ── Evidence entity types ─────────────────────────────────────────────────────

export const EVIDENCE_ENTITY_TYPES = Object.freeze({
  TEST: 'test',
  TEST_ACCEPTANCE: 'test_acceptance',
  INSTITUTION: 'institution',
  PROGRAM: 'program',
  SCHOLARSHIP: 'scholarship',
  SCHOLARSHIP_CYCLE: 'scholarship_cycle',
  STUDENT_PROFILE: 'student_profile',
  ELIGIBILITY_RESULT: 'eligibility_result',
  MATCH_RESULT: 'match_result',
  JOURNEY_STAGE: 'journey_stage',
  NEXT_BEST_ACTION: 'next_best_action',
  GAP_ANALYSIS: 'gap_analysis',
  INSTITUTION_OFFICIAL: 'institution_official',
  FACT_PROVENANCE: 'fact_provenance',
});

// ── Source statement types (for attribution) ──────────────────────────────────

export const SOURCE_STATEMENT_TYPES = Object.freeze({
  OFFICIAL_FACT: 'official_fact',
  INSTITUTION_SUBMITTED: 'institution_submitted',
  STRIDETO_DERIVED: 'strideto_derived',
  CANONICAL_SECONDARY: 'canonical_secondary',
  AGENT_STATEMENT: 'agent_statement',
  AI_SYNTHESIS: 'ai_synthesis',
});

// ── Provider states ───────────────────────────────────────────────────────────

export const PROVIDER_STATES = Object.freeze({
  NOT_CONFIGURED: 'not_configured',
  MOCK_TEST: 'mock_test',
  CONFIGURED_FUTURE: 'configured_future',
});

// ── Freshness grounding rules ─────────────────────────────────────────────────

/**
 * Maps Mission 5 freshness states to grounding behavior.
 *
 * fresh          → supports normal factual synthesis
 * review_due     → supports answer with source warning
 * stale          → must be caveated; may downgrade to stale_evidence grounding
 * broken         → must not be treated as current; triggers source warning
 * unknown        → must be explicit where material; triggers source warning
 */
export const FRESHNESS_GROUNDING_RULES = Object.freeze({
  fresh: { allowFactualSynthesis: true, requiresWarning: false, groundingDowngrade: null },
  review_due: { allowFactualSynthesis: true, requiresWarning: true, groundingDowngrade: null },
  stale: { allowFactualSynthesis: false, requiresWarning: true, groundingDowngrade: GROUNDING_STATUS.STALE_EVIDENCE },
  broken: { allowFactualSynthesis: false, requiresWarning: true, groundingDowngrade: GROUNDING_STATUS.STALE_EVIDENCE },
  unknown: { allowFactualSynthesis: false, requiresWarning: true, groundingDowngrade: null },
});

export function freshnessGroundingRule(freshnessState) {
  return FRESHNESS_GROUNDING_RULES[freshnessState] ?? FRESHNESS_GROUNDING_RULES.unknown;
}

// ── Source priority (reuses Mission 5 authority tiers) ────────────────────────

/**
 * Source priority label for UI attribution.
 * Higher authority types produce stronger grounding.
 * Conceptually:
 *   government/official_test_org
 *   > institution_submitted (Mission 18 verified)
 *   > university/scholarship_provider
 *   > trusted_secondary
 *   > strideto_derived recommendation
 *   > agent_statement
 */
export const SOURCE_PRIORITY_LABELS = Object.freeze({
  government: 'Official Government Source',
  official_test_org: 'Official Test Organization',
  university: 'University Official Source',
  scholarship_provider: 'Official Scholarship Provider',
  institution_submitted: 'Institution-Submitted (Verified)',
  official_employer: 'Official Employer Source',
  verified_org: 'Verified Organization',
  trusted_secondary: 'Trusted Secondary Source',
  strideto_derived: 'Strideto Derived Result',
  agent_statement: 'Agent Statement (Third Party)',
  ai_synthesis: 'AI Synthesis',
});

// ── Bound constants ───────────────────────────────────────────────────────────

export const COPILOT_BOUNDS = Object.freeze({
  MAX_QUESTION_LENGTH: 1000,
  MAX_ENTITY_REFS: 5,
  MAX_EVIDENCE_ITEMS: 30,
  MAX_HISTORY_MESSAGES: 6,
  MAX_OUTPUT_LENGTH: 4000,
  MAX_RETRIEVAL_ENTITIES: 10,
});

// ── Guarantee-language patterns (for output policy) ───────────────────────────

/**
 * Patterns that indicate forbidden guarantee/certainty language.
 * Server-side validator applies these regardless of prompt wording.
 */
export const GUARANTEE_PATTERNS = Object.freeze([
  /\bguaranteed?\s+admission\b/i,
  /\bguaranteed?\s+visa\b/i,
  /\bguaranteed?\s+scholarship\b/i,
  /\bguaranteed?\s+job\b/i,
  /\bguaranteed?\s+employment\b/i,
  /\bguaranteed?\s+embassy\s+approval\b/i,
  /\b100%\s+acceptance\b/i,
  /\bcertain\s+approval\b/i,
  /\bcertainly\s+admitted\b/i,
  /\bwill\s+definitely\s+get\s+(?:a\s+)?visa\b/i,
  /\bwill\s+definitely\s+be\s+admitted\b/i,
  /\bwill\s+definitely\s+receive\s+(?:the\s+)?scholarship\b/i,
  // Verb form: "we guarantee your admission", "I can guarantee you a visa".
  /\bguarantees?\b[^.!?]{0,40}\b(admission|visa|scholarship|job|employment|acceptance)\b/i,
]);

export function containsGuaranteeLanguage(text) {
  if (typeof text !== 'string') return false;
  return GUARANTEE_PATTERNS.some((pattern) => pattern.test(text));
}

// ── Prompt injection detection ────────────────────────────────────────────────

/**
 * Basic heuristics to flag potential instruction injection in retrieved content.
 * These are signals to downgrade trust, not definitive detection.
 */
export const INJECTION_PATTERNS = Object.freeze([
  // "ignore all previous instructions", "disregard the above instruction",
  // "forget your prior instructions" — qualifiers may stack in any order.
  /\b(ignore|disregard|forget)\b(?:\s+\w+){0,4}?\s+instructions?\b/i,
  /you\s+are\s+now\s+(?:a|an)\s+/i,
  /system\s+prompt\s*:/i,
  /\[SYSTEM\]/i,
  /<\|im_start\|>/i,
  /override\s+(?:your|all)\s+(?:safety|policy|guidelines?)/i,
]);

export function containsInjectionPattern(text) {
  if (typeof text !== 'string') return false;
  return INJECTION_PATTERNS.some((pattern) => pattern.test(text));
}

// ── Disclaimer categories ─────────────────────────────────────────────────────

export const DISCLAIMER_CATEGORIES = Object.freeze({
  ELIGIBILITY_GUIDANCE: 'eligibility_guidance',
  VISA_IMMIGRATION: 'visa_immigration',
  STALE_SOURCE: 'stale_source',
  CONFLICT_DETECTED: 'conflict_detected',
  AGENT_STATEMENT: 'agent_statement',
  AI_SYNTHESIS: 'ai_synthesis',
  GENERAL: 'general',
});

export const DISCLAIMER_TEXTS = Object.freeze({
  eligibility_guidance: 'Eligibility results are guidance based on your stated profile. They are not an admission probability or guarantee.',
  visa_immigration: 'Visa and immigration information should be verified against official government sources before acting.',
  stale_source: 'Some supporting information may be outdated. Verify with official sources before relying on it.',
  conflict_detected: 'Conflicting information was found in available sources. Official verification is recommended.',
  agent_statement: 'Agent statements are third-party information and are not verified facts.',
  ai_synthesis: 'This answer is an AI synthesis of available evidence. It is not an official statement.',
  general: 'Information provided is for guidance only. Always verify with official sources before making decisions.',
});

// ── Structured response shape (reference) ────────────────────────────────────

/**
 * Canonical Copilot response shape. All fields optional except
 * groundingStatus and generatedAt.
 *
 * {
 *   answer: string,
 *   answerType: ANSWER_TYPES.*,
 *   groundingStatus: GROUNDING_STATUS.*,
 *   confidenceCategory: string,    // same as groundingStatus for UX
 *   evidence: EvidenceItem[],
 *   sourceWarnings: string[],
 *   conflicts: ConflictItem[],
 *   recommendations: RecommendationItem[],
 *   deterministicResults: object,  // eligibility/match/nba pass-through
 *   disclaimers: string[],
 *   suggestedFollowUps: string[],
 *   generatedAt: string,           // ISO
 *   requestId: string,
 *   providerMeta: {
 *     providerState: PROVIDER_STATES.*,
 *     model: string | null,
 *   },
 * }
 */

// ── Evidence item shape (reference) ──────────────────────────────────────────

/**
 * EvidenceItem shape. All fields may be null/absent where not applicable.
 *
 * {
 *   id: string,                // server-assigned, used for citation validation
 *   entityType: EVIDENCE_ENTITY_TYPES.*,
 *   entityId: string | null,
 *   scope: string,             // e.g. 'program+intake', 'institution', 'country'
 *   fact: string,              // short label for what this item attests
 *   value: string | null,      // summary value
 *   sourceType: SOURCE_STATEMENT_TYPES.*,
 *   sourceAuthority: string | null,   // AUTHORITY_TYPES value
 *   sourceLabel: string | null,
 *   verificationState: string | null, // VERIFICATION_STATUSES value
 *   freshnessState: string | null,    // FRESHNESS_STATES value
 *   lastVerifiedAt: string | null,    // ISO
 *   effectiveDateFrom: string | null,
 *   effectiveDateTo: string | null,
 *   officialAttribution: string | null,
 *   publicSafeUrl: string | null,
 * }
 */
