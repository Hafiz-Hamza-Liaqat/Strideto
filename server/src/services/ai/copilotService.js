/**
 * Copilot Service — Mission 19.
 *
 * Main orchestration for the Evidence-Grounded AI Copilot.
 *
 * Pipeline:
 *   1. Validate request (bounds, context type, entity refs)
 *   2. Load authenticated student profile projection (Mission 3)
 *   3. Classify intent deterministically
 *   4. Retrieve canonical evidence (Missions 5–9, 18)
 *   5. Assemble evidence packet (server-side, client cannot forge)
 *   6. Generate answer (mock or not_configured — no real provider in Mission 19)
 *   7. Apply output policy + grounding validation
 *   8. Audit safe metadata
 *   9. Return structured response
 *
 * Constraints:
 *   - userId always derived from authenticated session (never from client body)
 *   - No cross-user access
 *   - No Vault content access
 *   - No autonomous account mutations
 *   - No real AI provider calls in Mission 19
 *   - Agent/Institution/Employer cannot retrieve Student Copilot context
 */
import { randomUUID } from 'crypto';
import {
  COPILOT_CONTEXT_TYPES,
  COPILOT_INTENT,
  COPILOT_BOUNDS,
  isValidContextType,
  isValidIntent as _isValidIntent,
  GROUNDING_STATUS,
  ANSWER_TYPES,
  PROVIDER_STATES,
} from '../../../../shared/ai/copilot.js';
import { CopilotModelProvider } from './CopilotModelProvider.js';
import { loadStudentContextProjection, retrieveForIntent } from './copilotRetrieval.js';
import { assembleEvidencePacket } from './copilotEvidencePacket.js';
import { applyOutputPolicy } from './copilotGroundingValidator.js';
import { logAudit } from '../auditService.js';

// ── Intent classification ─────────────────────────────────────────────────────

const CONTEXT_TO_INTENT = Object.freeze({
  [COPILOT_CONTEXT_TYPES.TESTS]: COPILOT_INTENT.TEST_QUESTION,
  [COPILOT_CONTEXT_TYPES.TEST_ACCEPTANCE]: COPILOT_INTENT.ACCEPTANCE_QUESTION,
  [COPILOT_CONTEXT_TYPES.PROGRAMS]: COPILOT_INTENT.PROGRAM_SEARCH,
  [COPILOT_CONTEXT_TYPES.SCHOLARSHIPS]: COPILOT_INTENT.SCHOLARSHIP_SEARCH,
  [COPILOT_CONTEXT_TYPES.ELIGIBILITY]: COPILOT_INTENT.ELIGIBILITY_QUESTION,
  [COPILOT_CONTEXT_TYPES.JOURNEY]: COPILOT_INTENT.JOURNEY_QUESTION,
  [COPILOT_CONTEXT_TYPES.INSTITUTION]: COPILOT_INTENT.INSTITUTION_QUESTION,
  [COPILOT_CONTEXT_TYPES.COMPARISON]: COPILOT_INTENT.COMPARISON,
  [COPILOT_CONTEXT_TYPES.GENERAL_GUIDANCE]: COPILOT_INTENT.GENERAL,
});

const QUESTION_KEYWORDS = Object.freeze({
  [COPILOT_INTENT.TEST_QUESTION]: /\b(test|exam|ielts|toefl|gre|gmat|sat|score)\b/i,
  [COPILOT_INTENT.ACCEPTANCE_QUESTION]: /\b(accept|require|need|minimum|score)\b/i,
  [COPILOT_INTENT.PROGRAM_SEARCH]: /\b(program|course|degree|study|master|bachelor|phd)\b/i,
  [COPILOT_INTENT.SCHOLARSHIP_SEARCH]: /\bscholarship|\bfunding\b|\bgrant\b|\bbursary\b|\bfellowship\b|financial\s+aid/i,
  [COPILOT_INTENT.ELIGIBILITY_QUESTION]: /\b(eligible|eligibility|qualify|qualification|gap|requirement)\b/i,
  [COPILOT_INTENT.JOURNEY_QUESTION]: /\b(next|step|action|deadline|journey|plan|document)\b/i,
  [COPILOT_INTENT.INSTITUTION_QUESTION]: /\b(university|college|institution|school)\b/i,
  [COPILOT_INTENT.COMPARISON]: /\b(compare|vs|versus|difference|better|which)\b/i,
  [COPILOT_INTENT.PROFILE_GAP]: /\b(gap|missing|incomplete|improve|profile)\b/i,
});

export function classifyIntent(question, contextType) {
  if (contextType && CONTEXT_TO_INTENT[contextType]) {
    return CONTEXT_TO_INTENT[contextType];
  }

  const q = String(question || '').slice(0, 500);
  for (const [intent, pattern] of Object.entries(QUESTION_KEYWORDS)) {
    if (pattern.test(q)) return intent;
  }
  return COPILOT_INTENT.GENERAL;
}

// ── Request validation ────────────────────────────────────────────────────────

function validateRequest(req) {
  const errors = [];

  if (!req.question || typeof req.question !== 'string') {
    errors.push('question is required');
  } else if (req.question.trim().length === 0) {
    errors.push('question must not be empty');
  } else if (req.question.length > COPILOT_BOUNDS.MAX_QUESTION_LENGTH) {
    errors.push(`question exceeds maximum length of ${COPILOT_BOUNDS.MAX_QUESTION_LENGTH}`);
  }

  if (req.contextType && !isValidContextType(req.contextType)) {
    errors.push(`invalid contextType: ${req.contextType}`);
  }

  const refs = req.entityRefs ?? {};
  const totalRefs = (refs.testIds?.length ?? 0) +
    (refs.programIds?.length ?? 0) +
    (refs.scholarshipIds?.length ?? 0) +
    (refs.institutionIds?.length ?? 0);
  if (totalRefs > COPILOT_BOUNDS.MAX_ENTITY_REFS) {
    errors.push(`too many entity references (max ${COPILOT_BOUNDS.MAX_ENTITY_REFS})`);
  }

  if (req.history && (!Array.isArray(req.history) || req.history.length > COPILOT_BOUNDS.MAX_HISTORY_MESSAGES)) {
    errors.push(`history exceeds maximum of ${COPILOT_BOUNDS.MAX_HISTORY_MESSAGES} messages`);
  }

  return errors;
}

// ── Observability summary ─────────────────────────────────────────────────────

function buildObservabilitySummary(packet, result, startMs) {
  return {
    retrievalCount: packet.items.length,
    evidenceCount: packet.items.length,
    groundingStatus: result.groundingStatus,
    freshnessWarningCount: (result.sourceWarnings ?? []).filter((w) => /stale|review|broken|unknown/i.test(w)).length,
    conflictCount: (result.conflicts ?? []).length,
    policyBlocked: result.groundingStatus === GROUNDING_STATUS.POLICY_BLOCKED,
    latencyMs: Date.now() - startMs,
    providerState: result.providerMeta?.providerState ?? PROVIDER_STATES.NOT_CONFIGURED,
  };
}

// ── Main handler ──────────────────────────────────────────────────────────────

/**
 * Handle a Copilot request for an authenticated student.
 *
 * @param {string} userId - from authenticated session (not client body)
 * @param {object} request - validated request object
 * @param {object} actorMeta - { role, email, ip } for audit
 * @returns {object} structured CopilotResponse
 */
export async function handleCopilotRequest(userId, request, actorMeta = {}) {
  const startMs = Date.now();
  const requestId = randomUUID().replace(/-/g, '');

  // 1. Validate
  const validationErrors = validateRequest(request);
  if (validationErrors.length > 0) {
    return {
      requestId,
      error: 'validation_error',
      details: validationErrors,
    };
  }

  const question = request.question.trim();
  const contextType = request.contextType ?? null;
  const entityRefs = sanitizeEntityRefs(request.entityRefs ?? {});
  const locale = request.locale ?? 'en';

  try {
    // 2. Load student profile projection (data minimization)
    const studentContext = await loadStudentContextProjection(userId).catch(() => null);

    // 3. Classify intent
    const intent = classifyIntent(question, contextType);

    // 4. Retrieve evidence (deterministic, server-side)
    const retrievalResult = await retrieveForIntent(userId, intent, entityRefs, studentContext);

    // 5. Assemble evidence packet
    const packet = assembleEvidencePacket(retrievalResult);

    // 6. Generate answer
    const generatedAnswer = await CopilotModelProvider.generateGroundedAnswer({
      question,
      contextType,
      intent,
      evidenceItems: packet.items,
      studentContext,
      locale,
    });

    // 7. Apply output policy + grounding validation
    const finalResponse = applyOutputPolicy(generatedAnswer, packet, { intent, contextType });

    const obs = buildObservabilitySummary(packet, finalResponse, startMs);

    // 8. Audit (safe metadata only — no raw question/answer by default)
    await logAudit({
      actor: { userId, role: actorMeta.role ?? 'user', email: actorMeta.email ?? '' },
      action: 'copilot.request',
      targetType: 'copilot_session',
      targetId: requestId,
      ip: actorMeta.ip ?? '',
      status: 'success',
      metadata: {
        intent,
        contextType: contextType ?? 'none',
        groundingStatus: finalResponse.groundingStatus,
        policyBlocked: obs.policyBlocked,
        evidenceCount: obs.evidenceCount,
        conflictCount: obs.conflictCount,
        providerState: obs.providerState,
        latencyMs: obs.latencyMs,
      },
    }).catch(() => {});

    // 9. Return
    return {
      requestId,
      ...finalResponse,
      _observability: obs,
    };
  } catch (err) {
    await logAudit({
      actor: { userId, role: actorMeta.role ?? 'user', email: actorMeta.email ?? '' },
      action: 'copilot.request',
      targetType: 'copilot_session',
      targetId: requestId,
      ip: actorMeta.ip ?? '',
      status: 'failure',
      metadata: { error: err?.message, intent: 'unknown', latencyMs: Date.now() - startMs },
    }).catch(() => {});

    return {
      requestId,
      answer: 'An error occurred while processing your request. Please try again.',
      answerType: ANSWER_TYPES.ERROR,
      groundingStatus: GROUNDING_STATUS.INSUFFICIENT_EVIDENCE,
      evidence: [],
      sourceWarnings: [],
      conflicts: [],
      disclaimers: [],
      generatedAt: new Date().toISOString(),
      error: 'internal_error',
    };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sanitizeEntityRefs(refs) {
  const MAX = COPILOT_BOUNDS.MAX_ENTITY_REFS;
  return {
    testIds: toIdArray(refs.testIds, MAX),
    programIds: toIdArray(refs.programIds, MAX),
    scholarshipIds: toIdArray(refs.scholarshipIds, MAX),
    institutionIds: toIdArray(refs.institutionIds, MAX),
    search: refs.search ? String(refs.search).slice(0, 200) : null,
    country: refs.country ? String(refs.country).slice(0, 100) : null,
    field: refs.field ? String(refs.field).slice(0, 100) : null,
    degreeLevel: refs.degreeLevel ? String(refs.degreeLevel).slice(0, 50) : null,
  };
}

function toIdArray(value, max) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, max).map((id) => String(id)).filter((id) => id.length > 0 && id.length < 50);
}

// ── Provider status ───────────────────────────────────────────────────────────

export function getCopilotProviderStatus() {
  return CopilotModelProvider.getStatus();
}
