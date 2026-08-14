import { Router } from 'express';
import { studentProductAuth } from '../middleware/requireUserCapability.js';
import {
  createResume,
  getMyResumes,
  getResumeById,
  updateResume,
  deleteResume,
  aiSuggest,
  optimizeForJob,
} from '../controllers/resumesController.js';

export const resumesRouter = Router();

resumesRouter.post('/resumes', ...studentProductAuth, createResume);
resumesRouter.get('/resumes/user', ...studentProductAuth, getMyResumes);
resumesRouter.post('/resumes/ai-suggest', ...studentProductAuth, aiSuggest);
resumesRouter.post('/resumes/optimize-for-job', ...studentProductAuth, optimizeForJob);
resumesRouter.get('/resumes/:id', ...studentProductAuth, getResumeById);
resumesRouter.put('/resumes/:id', ...studentProductAuth, updateResume);
resumesRouter.delete('/resumes/:id', ...studentProductAuth, deleteResume);
