import { Router } from 'express';
import { getMyBadges, getLeaderboard, getMyRank } from '../controllers/badgesController.js';
import { studentProductAuth } from '../middleware/requireUserCapability.js';

export const badgesRouter = Router();

badgesRouter.get('/badges/me', ...studentProductAuth, getMyBadges);
badgesRouter.get('/badges/leaderboard', getLeaderboard);
badgesRouter.get('/badges/rank', ...studentProductAuth, getMyRank);
