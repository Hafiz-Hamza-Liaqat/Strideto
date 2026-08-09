/**
 * User correction/report routes (Mission 5).
 *
 * Authenticated users only. No admin-only data is returned here.
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as corrections from '../controllers/trust/correctionController.js';

export const correctionsRouter = Router();

correctionsRouter.post('/corrections', requireAuth, corrections.submitCorrection);
correctionsRouter.get('/corrections/mine', requireAuth, corrections.listMyCorrections);
