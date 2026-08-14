import { Router } from 'express';
import { analyzeResume, getScanHistory } from '../controllers/resumeAnalyzerController.js';
import { generateCoverLetter } from '../controllers/coverLetterController.js';
import { getMyApplications } from '../controllers/applicationsController.js';
import { uploadResume } from '../middleware/upload.js';
import { uploadLimiter } from '../middleware/rateLimit.js';
import { studentProductAuth } from '../middleware/requireUserCapability.js';

export const usersRouter = Router();

usersRouter.post('/users/resume-analyze', ...studentProductAuth, uploadLimiter, (req, res, next) => {
  uploadResume(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'File upload failed' });
    next();
  });
}, analyzeResume);
usersRouter.get('/users/resume-scans', ...studentProductAuth, getScanHistory);
usersRouter.post('/users/cover-letter', ...studentProductAuth, generateCoverLetter);
usersRouter.get('/users/applications', ...studentProductAuth, getMyApplications);
