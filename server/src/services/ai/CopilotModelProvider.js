/**
 * CopilotModelProvider — Mission 19.
 *
 * Provider-neutral boundary between domain Copilot service and any future
 * AI/LLM vendor integration.
 *
 * Domain service MUST NOT depend on vendor SDK objects directly.
 *
 * Supported states:
 *   not_configured — no provider configured; returns truthful structured summary
 *   mock_test      — deterministic mock for tests/CI; no real network calls
 *   configured_future — placeholder for future production provider wiring
 *
 * Mission 19 verification uses mock_test state only.
 * NO real OpenAI/Anthropic/etc calls are made anywhere in this file.
 */
import { PROVIDER_STATES, GROUNDING_STATUS, ANSWER_TYPES } from '../../../../shared/ai/copilot.js';

// ── Provider state resolution ─────────────────────────────────────────────────

/**
 * Resolve the current provider state from environment/config.
 *
 * Production wiring will eventually read from config service.
 * For now: COPILOT_MOCK=true → mock_test, else not_configured.
 * configured_future is reserved for a real integration once approved.
 */
function resolveProviderState() {
  if (process.env.COPILOT_MOCK === 'true') return PROVIDER_STATES.MOCK_TEST;
  return PROVIDER_STATES.NOT_CONFIGURED;
}

// ── Public provider interface ─────────────────────────────────────────────────

export const CopilotModelProvider = {
  /**
   * Return the current provider state and capability metadata.
   * Safe for exposure in observability/status endpoints.
   */
  getStatus() {
    const state = resolveProviderState();
    return {
      providerState: state,
      model: state === PROVIDER_STATES.MOCK_TEST ? 'mock-deterministic-v1' : null,
      streaming: false,
      capabilities: state === PROVIDER_STATES.MOCK_TEST
        ? ['grounded_answer', 'evidence_synthesis']
        : [],
      readyForProduction: false,
      productionPrerequisites: [
        'Select AI provider and model (see Mission 19 docs)',
        'Configure credentials in secrets manager',
        'Review data-processing/privacy agreement',
        'Set regional endpoint and retention policy',
        'Define rate/cost controls',
        'Configure observability and prompt logging policy',
        'Run evaluation set and safety acceptance',
      ],
    };
  },

  /**
   * Generate a grounded answer from the evidence packet.
   *
   * Parameters:
   *   question     — user question string (already sanitized)
   *   contextType  — COPILOT_CONTEXT_TYPES value
   *   intent       — COPILOT_INTENT value
   *   evidenceItems — EvidenceItem[] from server-assembled packet
   *   studentContext — safe profile projection (no Vault, no credentials)
   *   locale       — BCP-47 locale string
   *
   * Returns:
   *   { answer, answerType, groundingStatus, citedEvidenceIds, suggestedFollowUps, providerMeta }
   *
   * Never makes real network calls.
   * Never reads .env secrets beyond COPILOT_MOCK flag.
   */
  async generateGroundedAnswer({
    question,
    contextType,
    intent,
    evidenceItems = [],
    studentContext = null,
    locale = 'en',
  }) {
    const state = resolveProviderState();

    if (state === PROVIDER_STATES.NOT_CONFIGURED) {
      return buildNotConfiguredResponse(evidenceItems);
    }

    if (state === PROVIDER_STATES.MOCK_TEST) {
      return buildMockResponse({ question, contextType, intent, evidenceItems, studentContext, locale });
    }

    // configured_future — placeholder; never reached in Mission 19
    return buildNotConfiguredResponse(evidenceItems);
  },

  /** Stub for future streaming support. */
  async streamGroundedAnswer(_params) {
    throw new Error('Streaming not supported in Mission 19. Implement in future provider integration.');
  },
};

// ── Not-configured response ───────────────────────────────────────────────────

function buildNotConfiguredResponse(evidenceItems) {
  const hasFreshEvidence = evidenceItems.some(
    (e) => e.freshnessState === 'fresh' || e.freshnessState === 'review_due'
  );

  const answer = hasFreshEvidence
    ? 'An AI language model is not configured for this Strideto environment. ' +
      'The verified evidence retrieved for your question is available in the evidence cards below. ' +
      'Please review the sourced facts directly.'
    : 'An AI language model is not configured for this environment. ' +
      'No verified evidence could be retrieved for your question at this time.';

  return {
    answer,
    answerType: ANSWER_TYPES.NOT_CONFIGURED,
    groundingStatus: GROUNDING_STATUS.PROVIDER_NOT_CONFIGURED,
    citedEvidenceIds: [],
    suggestedFollowUps: [],
    providerMeta: {
      providerState: PROVIDER_STATES.NOT_CONFIGURED,
      model: null,
    },
  };
}

// ── Mock/test response ────────────────────────────────────────────────────────

function buildMockResponse({ question, contextType, intent, evidenceItems, studentContext }) {
  const freshItems = evidenceItems.filter(
    (e) => e.freshnessState === 'fresh' || e.freshnessState === 'review_due'
  );
  const staleItems = evidenceItems.filter(
    (e) => e.freshnessState === 'stale' || e.freshnessState === 'broken'
  );
  const citedEvidenceIds = freshItems.slice(0, 5).map((e) => e.id);

  let groundingStatus = GROUNDING_STATUS.WELL_GROUNDED;
  if (freshItems.length === 0 && staleItems.length > 0) {
    groundingStatus = GROUNDING_STATUS.STALE_EVIDENCE;
  } else if (staleItems.length > 0) {
    groundingStatus = GROUNDING_STATUS.INSUFFICIENT_EVIDENCE;
  } else if (freshItems.length === 0) {
    groundingStatus = GROUNDING_STATUS.PARTIALLY_GROUNDED;
  }

  const answerType = freshItems.length > 0 ? ANSWER_TYPES.SYNTHESIS : ANSWER_TYPES.UNAVAILABLE;

  let answer = buildMockAnswerText({ intent, contextType, freshItems, studentContext, question });

  const suggestedFollowUps = buildMockFollowUps(intent, contextType);

  return {
    answer,
    answerType,
    groundingStatus,
    citedEvidenceIds,
    suggestedFollowUps,
    providerMeta: {
      providerState: PROVIDER_STATES.MOCK_TEST,
      model: 'mock-deterministic-v1',
    },
  };
}

function buildMockAnswerText({ intent, contextType: _contextType, freshItems, studentContext: _studentContext, question: _question }) {
  if (freshItems.length === 0) {
    return 'The verified information needed to answer this question is not currently available in Strideto\'s data. ' +
      'Please verify with official sources.';
  }

  const entitySummaries = freshItems.slice(0, 3).map((e) => {
    const label = e.fact || e.entityType || 'item';
    const val = e.value ? ` — ${String(e.value).slice(0, 100)}` : '';
    return `• ${label}${val}`;
  }).join('\n');

  let prefix = '[Mock synthesis — no real AI model active] ';

  if (intent === 'eligibility_question') {
    prefix += 'Based on your profile and the canonical data, here is what the eligibility engine determined:\n\n';
  } else if (intent === 'journey_question') {
    prefix += 'Based on your current Journey stage and deterministic Next Best Actions:\n\n';
  } else if (intent === 'test_question' || intent === 'acceptance_question') {
    prefix += 'Based on verified test acceptance data:\n\n';
  } else if (intent === 'program_search') {
    prefix += 'Based on canonical program data:\n\n';
  } else if (intent === 'scholarship_search') {
    prefix += 'Based on canonical scholarship data:\n\n';
  } else if (intent === 'comparison') {
    prefix += 'Comparing the available options using canonical data:\n\n';
  } else {
    prefix += 'Based on available verified evidence:\n\n';
  }

  return prefix + entitySummaries + '\n\n' +
    'This is a deterministic evidence summary. Verify deadlines and requirements with official sources.';
}

function buildMockFollowUps(intent, _contextType) {
  const followUps = {
    test_question: ['Which programs accept this test?', 'What score do I need for my target program?', 'What are the test registration deadlines?'],
    acceptance_question: ['What is the minimum accepted score?', 'Are there exceptions for this program?', 'Which other tests are accepted here?'],
    program_search: ['Am I eligible for this program?', 'What is the application deadline?', 'Are there scholarships available for this program?'],
    scholarship_search: ['Am I eligible for this scholarship?', 'What documents are required?', 'What is the scholarship deadline?'],
    eligibility_question: ['What gaps exist in my profile?', 'What should I do to improve my eligibility?', 'What is my next best action?'],
    journey_question: ['What documents do I still need?', 'What are my upcoming deadlines?', 'What programs match my profile?'],
    institution_question: ['What programs does this institution offer?', 'What tests are accepted here?', 'Is this institution verified on Strideto?'],
    comparison: ['Which option better matches my budget?', 'Which has the earlier deadline?', 'Which has stronger scholarship options?'],
    profile_gap: ['How do I complete my profile?', 'What tests should I take?', 'What is my match score for this program?'],
    general: ['What tests do I need?', 'Which programs fit my goals?', 'What scholarships may I be eligible for?'],
  };
  return (followUps[intent] || followUps.general).slice(0, 3);
}
