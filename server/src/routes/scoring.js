import { Router } from 'express';
import { studentProductAuth } from '../middleware/requireUserCapability.js';
import {
  getLatestScore,
  getScoreHistory,
  getScoreExplanation,
  recomputeScore,
  getJobMatch,
  getResumeQuality,
  getSkillGap,
  requireScoringEnabled,
} from '../controllers/career/scoringController.js';

export const scoringRouter = Router();

const scoringAuth = [...studentProductAuth, requireScoringEnabled];

scoringRouter.get('/scoring/latest', ...scoringAuth, getLatestScore);
scoringRouter.get('/scoring/history', ...scoringAuth, getScoreHistory);
scoringRouter.get('/scoring/explanation', ...scoringAuth, getScoreExplanation);
scoringRouter.post('/scoring/recompute', ...scoringAuth, recomputeScore);
scoringRouter.get('/scoring/job-match/:jobId', ...scoringAuth, getJobMatch);
scoringRouter.get('/scoring/resume-quality', ...scoringAuth, getResumeQuality);
scoringRouter.get('/scoring/skill-gap', ...scoringAuth, getSkillGap);
