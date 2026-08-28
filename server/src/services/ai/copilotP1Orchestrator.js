/**
 * COPILOT-P1 — Platform Brain Orchestrator.
 *
 * Routes intent → authorized tools → normalized evidence → structured response.
 * Works with or without AI provider; never treats LLM as source of platform facts.
 */
import {
  COPILOT_P1_INTENT,
  COPILOT_P1_TOOLS,
  COPILOT_P1_BOUNDS,
  classifyP1Intent,
  isP1WriteRequest,
  validateIdList,
  sanitizeConversationRefs,
  sanitizeScholarshipRefs,
} from '../../../../shared/ai/copilotP1.js';
import { PROVIDER_STATES } from '../../../../shared/ai/copilot.js';
import { buildUserCopilotContext } from './copilotUserContextBuilder.js';
import { createCopilotP1ToolRegistry } from './copilotTools.js';
import {
  buildP1ResponseBlocks,
  synthesizeAnswerFromBlocks,
  buildNavigationActions,
} from './copilotP1ResponseBuilder.js';
import { CopilotModelProvider } from './CopilotModelProvider.js';

/** Map P1 intent → tools to invoke (bounded, deterministic) */
const INTENT_TOOL_PLAN = Object.freeze({
  [COPILOT_P1_INTENT.GENERAL_HELP]: [COPILOT_P1_TOOLS.GET_USER_CONTEXT],
  [COPILOT_P1_INTENT.PROFILE]: [COPILOT_P1_TOOLS.GET_USER_CONTEXT],
  [COPILOT_P1_INTENT.JOB_SEARCH]: [COPILOT_P1_TOOLS.GET_USER_CONTEXT, COPILOT_P1_TOOLS.SEARCH_JOBS],
  [COPILOT_P1_INTENT.INTERNSHIP_SEARCH]: [COPILOT_P1_TOOLS.GET_USER_CONTEXT, COPILOT_P1_TOOLS.SEARCH_INTERNSHIPS],
  [COPILOT_P1_INTENT.SCHOLARSHIP_SEARCH]: [COPILOT_P1_TOOLS.GET_USER_CONTEXT, COPILOT_P1_TOOLS.SEARCH_SCHOLARSHIPS],
  [COPILOT_P1_INTENT.INSTITUTION_SEARCH]: [COPILOT_P1_TOOLS.SEARCH_INSTITUTIONS],
  [COPILOT_P1_INTENT.PROGRAM_SEARCH]: [COPILOT_P1_TOOLS.GET_USER_CONTEXT, COPILOT_P1_TOOLS.SEARCH_PROGRAMS],
  [COPILOT_P1_INTENT.APPLICATION_STATUS]: [COPILOT_P1_TOOLS.GET_APPLICATION_SUMMARY],
  [COPILOT_P1_INTENT.SAVED_ITEMS]: [COPILOT_P1_TOOLS.GET_SAVED_ITEMS],
  [COPILOT_P1_INTENT.PLAN]: [COPILOT_P1_TOOLS.GET_USER_CONTEXT, COPILOT_P1_TOOLS.GET_APPLICATION_SUMMARY, COPILOT_P1_TOOLS.GET_SAVED_ITEMS],
  [COPILOT_P1_INTENT.COMPARE]: [COPILOT_P1_TOOLS.COMPARE_OPPORTUNITIES],
  [COPILOT_P1_INTENT.UNKNOWN]: [COPILOT_P1_TOOLS.GET_USER_CONTEXT],
});

function extractSearchTerms(question, userContext) {
  const q = String(question || '');
  const terms = q.replace(/\b(find|show|search|me|my|profile|matching|match|for|the|a|an|please|can you|could you)\b/gi, ' ').trim();
  if (terms.length > 2) return terms.slice(0, 200);

  const skills = userContext?.skills?.slice(0, 2).join(' ');
  return skills || null;
}

function resolveCompareParams(intent, entityRefs, rawConversationRefs) {
  if (intent !== COPILOT_P1_INTENT.COMPARE) return null;

  const conversationRefs = sanitizeConversationRefs(rawConversationRefs);

  if (entityRefs?.jobIds?.length >= 2) {
    const ids = validateIdList(entityRefs.jobIds, 2);
    if (ids.length >= 2) return { type: 'job', ids };
  }
  if (entityRefs?.internshipIds?.length >= 2) {
    const ids = validateIdList(entityRefs.internshipIds, 2);
    if (ids.length >= 2) return { type: 'internship', ids };
  }
  if (entityRefs?.programIds?.length >= 2) {
    const ids = validateIdList(entityRefs.programIds, 2);
    if (ids.length >= 2) return { type: 'program', ids };
  }
  if (entityRefs?.scholarshipRefs?.length >= 2) {
    const refs = sanitizeScholarshipRefs(entityRefs.scholarshipRefs, 2);
    if (refs.length >= 2) return { type: 'scholarship', scholarshipRefs: refs };
  }

  if (conversationRefs.jobIds.length >= 2) {
    return { type: 'job', ids: conversationRefs.jobIds.slice(0, 2) };
  }
  if (conversationRefs.internshipIds.length >= 2) {
    return { type: 'internship', ids: conversationRefs.internshipIds.slice(0, 2) };
  }
  if (conversationRefs.programIds.length >= 2) {
    return { type: 'program', ids: conversationRefs.programIds.slice(0, 2) };
  }
  if (conversationRefs.scholarshipRefs.length >= 2) {
    return { type: 'scholarship', scholarshipRefs: conversationRefs.scholarshipRefs.slice(0, 2) };
  }

  return null;
}

function buildToolArgs(toolName, question, userContext, entityRefs, compareParams) {
  const search = extractSearchTerms(question, userContext);
  const pageSize = COPILOT_P1_BOUNDS.MAX_RESULTS_DEFAULT;

  switch (toolName) {
    case COPILOT_P1_TOOLS.SEARCH_JOBS:
      return {
        search,
        country: userContext?.workPreferences?.preferredCountries?.[0] || entityRefs?.country,
        workMode: userContext?.workPreferences?.workMode || entityRefs?.workMode,
        page: 1,
        pageSize,
      };
    case COPILOT_P1_TOOLS.SEARCH_INTERNSHIPS:
      return { search, country: entityRefs?.country, field: entityRefs?.field, page: 1, pageSize };
    case COPILOT_P1_TOOLS.SEARCH_SCHOLARSHIPS:
      return {
        search,
        country: userContext?.studyPreferences?.destinationCountries?.[0] || entityRefs?.country,
        page: 1,
        pageSize,
      };
    case COPILOT_P1_TOOLS.SEARCH_PROGRAMS:
      return {
        search,
        country: entityRefs?.country,
        field: entityRefs?.field || userContext?.studyPreferences?.fieldsOfStudy?.[0],
        degreeLevel: entityRefs?.degreeLevel,
        page: 1,
        pageSize,
      };
    case COPILOT_P1_TOOLS.SEARCH_INSTITUTIONS:
      return { search, page: 1, pageSize };
    case COPILOT_P1_TOOLS.COMPARE_OPPORTUNITIES:
      return compareParams || { type: 'job', ids: [] };
    default:
      return {};
  }
}

/**
 * Execute P1 platform brain pipeline for an authenticated user.
 */
export async function executeCopilotP1(userId, request) {
  const startMs = Date.now();
  const question = String(request.question || '').trim();
  const contextType = request.contextType ?? null;
  const entityRefs = request.entityRefs ?? {};
  const conversationRefs = sanitizeConversationRefs(request.conversationRefs ?? {});
  const writeRequested = isP1WriteRequest(question);

  const p1Intent = classifyP1Intent(question, contextType);
  const userContext = await buildUserCopilotContext(userId);
  const registry = createCopilotP1ToolRegistry();
  registry.resetCallCount();

  const toolPlan = [...(INTENT_TOOL_PLAN[p1Intent] || INTENT_TOOL_PLAN[COPILOT_P1_INTENT.UNKNOWN])];
  const compareParams = resolveCompareParams(p1Intent, entityRefs, conversationRefs);
  if (p1Intent === COPILOT_P1_INTENT.COMPARE && !compareParams) {
    toolPlan.length = 0;
  }

  const toolResults = [];
  const ctx = { userId, userContext };

  for (const toolName of toolPlan) {
    if (!registry.canInvoke()) break;
    const args = buildToolArgs(toolName, question, userContext, entityRefs, compareParams);
    const result = await registry.invoke(toolName, args, ctx);
    toolResults.push(result);
    if (toolName === COPILOT_P1_TOOLS.GET_USER_CONTEXT && result.ok) {
      ctx.userContext = result.data;
    }
  }

  const providerStatus = CopilotModelProvider.getStatus();
  const providerConfigured = providerStatus.providerState === PROVIDER_STATES.MOCK_TEST
    || providerStatus.providerState === PROVIDER_STATES.CONFIGURED_FUTURE;

  const { blocks, resultRefs } = buildP1ResponseBlocks(p1Intent, toolResults, userContext, { writeRequested });
  const synthesized = synthesizeAnswerFromBlocks(blocks, providerConfigured);
  const navigationActions = buildNavigationActions(blocks);

  return {
    p1Intent,
    blocks,
    resultRefs,
    navigationActions,
    toolResults: toolResults.map((t) => ({ tool: t.tool, ok: t.ok, error: t.error })),
    answer: synthesized.answer,
    answerType: synthesized.answerType,
    groundingStatus: synthesized.groundingStatus,
    writeRequested,
    _observability: {
      p1Intent,
      toolCallCount: toolResults.length,
      latencyMs: Date.now() - startMs,
      providerState: providerStatus.providerState,
    },
  };
}

export function isP1PlatformIntent(question, contextType) {
  const intent = classifyP1Intent(question, contextType);
  return intent !== COPILOT_P1_INTENT.UNKNOWN || [
    'jobs', 'internships', 'applications', 'saved', 'profile', 'planning',
  ].includes(contextType);
}
