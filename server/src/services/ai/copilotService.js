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
import { executeCopilotP1, isP1PlatformIntent } from './copilotP1Orchestrator.js';
import { sanitizeConversationRefs, validateIdList, sanitizeScholarshipRefs } from '../../../../shared/ai/copilotP1.js';

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
  [COPILOT_CONTEXT_TYPES.JOBS]: COPILOT_INTENT.JOB_SEARCH,
  [COPILOT_CONTEXT_TYPES.INTERNSHIPS]: COPILOT_INTENT.INTERNSHIP_SEARCH,
  [COPILOT_CONTEXT_TYPES.APPLICATIONS]: COPILOT_INTENT.APPLICATION_STATUS,
  [COPILOT_CONTEXT_TYPES.SAVED]: COPILOT_INTENT.SAVED_ITEMS,
  [COPILOT_CONTEXT_TYPES.PROFILE]: COPILOT_INTENT.PROFILE_GAP,
  [COPILOT_CONTEXT_TYPES.PLANNING]: COPILOT_INTENT.PLAN,
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
  [COPILOT_INTENT.JOB_SEARCH]: /\b(jobs?|career|employ|hire|react|typescript|frontend|backend|remote\s+work)\b/i,
  [COPILOT_INTENT.INTERNSHIP_SEARCH]: /\binternships?\b/i,
  [COPILOT_INTENT.APPLICATION_STATUS]: /\b(applied|applications?|pending|submitted|application\s+status)\b/i,
  [COPILOT_INTENT.SAVED_ITEMS]: /\b(saved|bookmarks?|favorites?|saved\s+opportunities)\b/i,
  [COPILOT_INTENT.PLAN]: /\b(plan|next\s+step|what\s+should\s+i\s+do|priorit)\b/i,
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

  if (req.conversationRefs && typeof req.conversationRefs !== 'object') {
    errors.push('conversationRefs must be an object');
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
  const conversationRefs = sanitizeConversationRefs(request.conversationRefs ?? {});
  const locale = request.locale ?? 'en';

  try {
    // COPILOT-P1: Platform brain path for jobs, internships, saved, applications, planning
    if (isP1PlatformIntent(question, contextType)) {
      const p1Result = await executeCopilotP1(userId, {
        question,
        contextType,
        entityRefs,
        conversationRefs,
        locale,
      });

      const providerStatus = CopilotModelProvider.getStatus();
      let finalAnswer = p1Result;
      if (providerStatus.providerState !== PROVIDER_STATES.NOT_CONFIGURED) {
        const generated = await CopilotModelProvider.generateGroundedAnswer({
          question,
          contextType,
          intent: p1Result.p1Intent,
          evidenceItems: [],
          studentContext: null,
          locale,
          p1Blocks: p1Result.blocks,
        });
        finalAnswer = { ...p1Result, ...generated, blocks: p1Result.blocks, resultRefs: p1Result.resultRefs };
      }

      const obs = {
        retrievalCount: p1Result.toolResults?.length ?? 0,
        evidenceCount: p1Result.blocks?.length ?? 0,
        groundingStatus: finalAnswer.groundingStatus,
        policyBlocked: false,
        latencyMs: p1Result._observability?.latencyMs ?? Date.now() - startMs,
        providerState: p1Result._observability?.providerState ?? PROVIDER_STATES.NOT_CONFIGURED,
        p1Intent: p1Result.p1Intent,
      };

      await logAudit({
        actor: { userId, role: actorMeta.role ?? 'user', email: actorMeta.email ?? '' },
        action: 'copilot.request',
        targetType: 'copilot_session',
        targetId: requestId,
        ip: actorMeta.ip ?? '',
        status: 'success',
        metadata: {
          intent: p1Result.p1Intent,
          contextType: contextType ?? 'none',
          groundingStatus: finalAnswer.groundingStatus,
          evidenceCount: obs.evidenceCount,
          providerState: obs.providerState,
          latencyMs: obs.latencyMs,
          platformBrain: true,
        },
      }).catch(() => {});

      return {
        requestId,
        answer: finalAnswer.answer,
        answerType: finalAnswer.answerType,
        groundingStatus: finalAnswer.groundingStatus,
        evidence: [],
        blocks: p1Result.blocks,
        resultRefs: p1Result.resultRefs,
        navigationActions: p1Result.navigationActions,
        sourceWarnings: [],
        conflicts: [],
        disclaimers: p1Result.writeRequested
          ? ['Copilot P1 is read-only. Application submission requires explicit future confirmation.']
          : [],
        suggestedFollowUps: buildP1FollowUps(p1Result.p1Intent),
        generatedAt: new Date().toISOString(),
        providerMeta: { providerState: obs.providerState, model: null },
        _observability: obs,
      };
    }

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
    institutionIds: toIdArray(refs.institutionIds, MAX),
    jobIds: toIdArray(refs.jobIds, MAX),
    internshipIds: toIdArray(refs.internshipIds, MAX),
    scholarshipRefs: sanitizeScholarshipRefs(refs.scholarshipRefs, MAX),
    search: refs.search ? String(refs.search).slice(0, 200) : null,
    country: refs.country ? String(refs.country).slice(0, 100) : null,
    field: refs.field ? String(refs.field).slice(0, 100) : null,
    degreeLevel: refs.degreeLevel ? String(refs.degreeLevel).slice(0, 50) : null,
    workMode: refs.workMode ? String(refs.workMode).slice(0, 20) : null,
  };
}


function buildP1FollowUps(intent) {
  const map = {
    job_search: ['Compare the first two', 'What gaps do I have for the top role?', 'Show my saved jobs'],
    internship_search: ['Compare these internships', 'Show internships matching my skills'],
    scholarship_search: ['Compare two scholarships', 'What should I prepare for applications?'],
    program_search: ['Compare programs', 'Am I eligible for the first program?'],
    saved_items: ['Compare saved jobs', 'What should I apply to next?'],
    application_status: ['What deadlines are coming?', 'What should I do next?'],
    plan: ['Find jobs matching my profile', 'Find scholarships for me'],
    compare: ['Show more details on the first option', 'What are my profile gaps?'],
    profile: ['Find jobs matching my profile', 'How can I improve my profile?'],
  };
  return (map[intent] || map.plan).slice(0, 3);
}

function toIdArray(value, max) {
  return validateIdList(value, max);
}

// ── Provider status ───────────────────────────────────────────────────────────

export function getCopilotProviderStatus() {
  return CopilotModelProvider.getStatus();
}
