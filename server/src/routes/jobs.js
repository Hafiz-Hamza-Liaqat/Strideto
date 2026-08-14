import { Router } from 'express';
import { getJobs, getJobByIdOrSlug, getJobGeoFacets } from '../controllers/jobsController.js';
import { saveJob, unsaveJob } from '../controllers/savedController.js';
import { applyToJob } from '../controllers/applicationsController.js';
import { uploadResume } from '../middleware/upload.js';
import { uploadLimiter } from '../middleware/rateLimit.js';
import { studentProductAuth } from '../middleware/requireUserCapability.js';

export const jobsRouter = Router();

jobsRouter.get('/jobs/geo-facets', getJobGeoFacets);
jobsRouter.get('/jobs', getJobs);
jobsRouter.get('/jobs/:idOrSlug', getJobByIdOrSlug);
jobsRouter.post('/jobs/:id/save', ...studentProductAuth, saveJob);
jobsRouter.delete('/jobs/:id/save', ...studentProductAuth, unsaveJob);
jobsRouter.post('/jobs/:id/apply', ...studentProductAuth, uploadLimiter, (req, res, next) => {
  uploadResume(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'File upload failed' });
    next();
  });
}, applyToJob);
