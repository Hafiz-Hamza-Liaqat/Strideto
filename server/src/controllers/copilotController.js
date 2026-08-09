/**
 * Copilot Controller — Mission 19.
 *
 * Authenticated Student Copilot endpoints.
 *
 * Security boundaries:
 *   - userId always derived from req.user (JWT) — never from client body
 *   - requireUserAuth: only user realm (not employer/agent/institution)
 *   - No cross-user access
 *   - Vault content: zero access
 *   - No autonomous account mutations
 *   - Agent/Institution/Employer cannot invoke these endpoints
 */
import { handleCopilotRequest, getCopilotProviderStatus } from '../services/ai/copilotService.js';
import { COPILOT_CONTEXT_TYPES } from '../../../shared/ai/copilot.js';

function getActorMeta(req) {
  return {
    role: req.user?.role ?? 'user',
    email: req.user?.email ?? '',
    ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() ?? req.socket?.remoteAddress ?? '',
  };
}

// POST /api/copilot/ask
export async function submitCopilotRequest(req, res) {
  try {
    const userId = req.user.userId;

    const {
      question,
      contextType,
      entityRefs,
      locale,
      conversationId,
      history,
    } = req.body ?? {};

    const result = await handleCopilotRequest(
      userId,
      { question, contextType, entityRefs, locale, conversationId, history },
      getActorMeta(req)
    );

    if (result.error === 'validation_error') {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (err) {
    console.error('[copilot] submitCopilotRequest error', err?.message);
    return res.status(500).json({ error: 'copilot_unavailable' });
  }
}

// GET /api/copilot/status
export async function getCopilotStatus(req, res) {
  try {
    const status = getCopilotProviderStatus();
    return res.json({
      status: 'ok',
      provider: status,
    });
  } catch (err) {
    console.error('[copilot] getCopilotStatus error', err?.message);
    return res.status(500).json({ error: 'status_unavailable' });
  }
}

// GET /api/copilot/context-types
export async function getCopilotContextTypes(_req, res) {
  return res.json({
    contextTypes: Object.values(COPILOT_CONTEXT_TYPES),
  });
}
