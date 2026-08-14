/**
 * Copilot routes — Mission 19.
 *
 * Security boundaries:
 *   - All routes require authentication as a user (not employer/agent/institution)
 *   - Server derives userId from JWT; client cannot supply a different userId
 *   - No cross-user access
 *   - Vault content: zero access
 *   - No autonomous account mutations
 *   - Agent/Institution/Employer realms cannot invoke Student Copilot
 */
import { Router } from 'express';
import { studentProductAuth } from '../middleware/requireUserCapability.js';
import { searchLimiter } from '../middleware/rateLimit.js';
import {
  submitCopilotRequest,
  getCopilotStatus,
  getCopilotContextTypes,
} from '../controllers/copilotController.js';

export const copilotRouter = Router();

const userAuth = [...studentProductAuth];

// POST /api/copilot/ask — main copilot endpoint, auth + rate limited
copilotRouter.post('/copilot/ask', ...userAuth, searchLimiter, submitCopilotRequest);

// GET /api/copilot/status — provider status, auth required
copilotRouter.get('/copilot/status', ...userAuth, getCopilotStatus);

// GET /api/copilot/context-types — available context types, auth required
copilotRouter.get('/copilot/context-types', ...userAuth, getCopilotContextTypes);
