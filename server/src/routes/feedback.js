import { Router } from 'express';
import { submitFeedback } from '../controllers/feedbackController.js';
import { feedbackLimiter } from '../middleware/rateLimit.js';
import { optionalAuth } from '../middleware/auth.js';

export const feedbackRouter = Router();

feedbackRouter.post('/feedback', feedbackLimiter, optionalAuth, submitFeedback);
