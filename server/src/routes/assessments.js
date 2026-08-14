import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { studentProductAuth } from '../middleware/requireUserCapability.js';
import {
  listAssessmentCategories,
  listAssessments,
  getAssessmentBySlug,
  startAssessmentAttempt,
  submitAssessmentAttempt,
  listMyAssessmentAttempts,
  getAssessmentAttempt,
  getEmployerVisibleSkills,
  createAssessment,
  publishAssessment,
  createQuestionBank,
  addQuestion,
  requireAssessmentsEnabled,
} from '../controllers/career/assessmentController.js';

export const assessmentsRouter = Router();

const talentAuth = [...studentProductAuth, requireAssessmentsEnabled];
const staffAuth = [requireAuth, requireAdmin, requireAssessmentsEnabled];

assessmentsRouter.get('/assessments/categories', ...talentAuth, listAssessmentCategories);
assessmentsRouter.get('/assessments', ...talentAuth, listAssessments);
assessmentsRouter.get('/assessments/attempts/mine', ...talentAuth, listMyAssessmentAttempts);
assessmentsRouter.get('/assessments/employer-skills', ...talentAuth, getEmployerVisibleSkills);
assessmentsRouter.get('/assessments/attempts/:attemptId', ...talentAuth, getAssessmentAttempt);
assessmentsRouter.get('/assessments/:slug', ...talentAuth, getAssessmentBySlug);
assessmentsRouter.post('/assessments/attempts', ...talentAuth, startAssessmentAttempt);
assessmentsRouter.post('/assessments/attempts/:attemptId/submit', ...talentAuth, submitAssessmentAttempt);

// Catalog authoring — Admin/SuperAdmin only (C.8.5A)
assessmentsRouter.post('/assessments', ...staffAuth, createAssessment);
assessmentsRouter.post('/assessments/:id/publish', ...staffAuth, publishAssessment);
assessmentsRouter.post('/assessments/question-banks', ...staffAuth, createQuestionBank);
assessmentsRouter.post('/assessments/question-banks/:bankId/questions', ...staffAuth, addQuestion);
