import { Router } from 'express';
import {
  getSeoJobsPage,
  getSeoJobsByCategory,
  getSeoJobsBySource,
  getLatestGovernmentJobs,
  getSeoScholarshipsPage,
  getSeoJobBySlug,
} from '../controllers/seoController.js';

export const seoRouter = Router();

seoRouter.get('/seo/jobs-in/:slug', getSeoJobsPage);
seoRouter.get('/seo/jobs-by-category/:slug', getSeoJobsByCategory);
seoRouter.get('/seo/jobs-by-source/:source', getSeoJobsBySource);
seoRouter.get('/seo/latest-government-jobs', getLatestGovernmentJobs);
seoRouter.get('/seo/scholarships-in/:country', getSeoScholarshipsPage);
seoRouter.get('/seo/jobs/:slug', getSeoJobBySlug);
