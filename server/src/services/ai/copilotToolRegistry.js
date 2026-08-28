/**
 * COPILOT-P1 — Tool Registry.
 *
 * Strict allowlist; unknown tools rejected.
 * Validates arguments; enforces max tool calls per turn.
 * userId always from authenticated requester — never from tool args.
 */
import {
  COPILOT_P1_TOOLS,
  COPILOT_P1_BOUNDS,
  isAllowedCopilotTool,
  validateToolPagination,
  validateIdList,
  validateSearchString,
  rejectClientUserId,
  sanitizeScholarshipRefs,
} from '../../../../shared/ai/copilotP1.js';

export class CopilotToolRegistry {
  constructor(tools = {}) {
    this.tools = tools;
    this.callCount = 0;
  }

  resetCallCount() {
    this.callCount = 0;
  }

  canInvoke() {
    return this.callCount < COPILOT_P1_BOUNDS.MAX_TOOL_CALLS_PER_TURN;
  }

  /**
   * Invoke a registered tool.
   * @param {string} toolName
   * @param {object} args - validated tool arguments (no userId from client)
   * @param {object} ctx - { userId, userContext }
   */
  async invoke(toolName, args, ctx) {
    if (!isAllowedCopilotTool(toolName)) {
      return { ok: false, error: 'unknown_tool', tool: toolName };
    }
    if (!this.canInvoke()) {
      return { ok: false, error: 'max_tool_calls_exceeded' };
    }
    const userIdReject = rejectClientUserId(args);
    if (!userIdReject.valid) {
      return { ok: false, error: 'authorization_denied', details: userIdReject.error };
    }
    const handler = this.tools[toolName];
    if (!handler) {
      return { ok: false, error: 'tool_not_implemented', tool: toolName };
    }

    const validated = validateToolArgs(toolName, args);
    if (!validated.valid) {
      return { ok: false, error: 'invalid_arguments', details: validated.errors };
    }

    this.callCount += 1;
    try {
      const result = await handler(validated.args, ctx);
      return { ok: true, tool: toolName, ...result };
    } catch (err) {
      return { ok: false, error: 'tool_failed', tool: toolName, message: err?.message ?? 'unknown' };
    }
  }
}

export function validateToolArgs(toolName, args = {}) {
  const errors = [];
  const clean = { ...args };

  switch (toolName) {
    case COPILOT_P1_TOOLS.SEARCH_JOBS:
    case COPILOT_P1_TOOLS.SEARCH_INTERNSHIPS:
    case COPILOT_P1_TOOLS.SEARCH_SCHOLARSHIPS:
    case COPILOT_P1_TOOLS.SEARCH_PROGRAMS:
    case COPILOT_P1_TOOLS.SEARCH_INSTITUTIONS: {
      const { page, pageSize } = validateToolPagination(args);
      clean.page = page;
      clean.pageSize = pageSize;
      clean.search = validateSearchString(args.search);
      clean.country = validateSearchString(args.country, 10);
      clean.workMode = ['remote', 'hybrid', 'on_site', 'unspecified'].includes(args.workMode) ? args.workMode : null;
      clean.field = validateSearchString(args.field, 100);
      break;
    }
    case COPILOT_P1_TOOLS.GET_JOB_DETAIL:
    case COPILOT_P1_TOOLS.GET_INTERNSHIP_DETAIL: {
      const ids = validateIdList([args.id].filter(Boolean), 1);
      if (ids.length === 0) errors.push('id is required');
      clean.id = ids[0] ?? null;
      break;
    }
    case COPILOT_P1_TOOLS.GET_SCHOLARSHIP_DETAIL:
    case COPILOT_P1_TOOLS.GET_INSTITUTION_DETAIL:
    case COPILOT_P1_TOOLS.GET_PROGRAM_DETAIL: {
      const ids = validateIdList([args.id].filter(Boolean), 1);
      if (ids.length === 0) errors.push('id is required');
      clean.id = ids[0] ?? null;
      if (toolName === COPILOT_P1_TOOLS.GET_SCHOLARSHIP_DETAIL) {
        clean.system = ['cms', 'intl', 'canonical'].includes(args.system) ? args.system : null;
        if (!clean.system) errors.push('system is required for scholarship detail');
      }
      break;
    }
    case COPILOT_P1_TOOLS.COMPARE_OPPORTUNITIES: {
      clean.type = ['job', 'internship', 'scholarship', 'program'].includes(args.type) ? args.type : 'job';
      clean.ids = validateIdList(args.ids, COPILOT_P1_BOUNDS.MAX_COMPARE_ENTITIES);
      clean.scholarshipRefs = sanitizeScholarshipRefs(args.scholarshipRefs, COPILOT_P1_BOUNDS.MAX_COMPARE_ENTITIES);
      if (clean.type === 'scholarship') {
        if (clean.scholarshipRefs.length < 2) errors.push('at least 2 scholarshipRefs with valid system required');
      } else if (clean.ids.length < 2) {
        errors.push('at least 2 ids required for comparison');
      }
      break;
    }
    case COPILOT_P1_TOOLS.GET_SAVED_ITEMS:
    case COPILOT_P1_TOOLS.GET_APPLICATION_SUMMARY:
    case COPILOT_P1_TOOLS.GET_USER_CONTEXT:
      break;
    default:
      errors.push('unknown tool');
  }

  return errors.length ? { valid: false, errors } : { valid: true, args: clean };
}

export function createDefaultToolRegistry(toolHandlers) {
  return new CopilotToolRegistry(toolHandlers);
}
