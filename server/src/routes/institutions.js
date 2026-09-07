import { Router } from 'express';
import { getInstitutions, getInstitutionBySlug, getInstitutionFilters } from '../controllers/institutionsController.js';
import { listSchoolsAndColleges, getSchoolOrCollege } from '../controllers/schoolsAndCollegesController.js';
import { searchLimiter } from '../middleware/rateLimit.js';

export const institutionsRouter = Router();

institutionsRouter.get('/institutions/filters', searchLimiter, getInstitutionFilters);
institutionsRouter.get('/institutions', searchLimiter, getInstitutions);
institutionsRouter.get('/institutions/:slugOrId', getInstitutionBySlug);

// Canonical-backed Pakistan school/college bridge. Legacy /institutions routes
// remain unchanged during the migration period.
institutionsRouter.get('/schools-and-colleges', searchLimiter, listSchoolsAndColleges);
institutionsRouter.get('/schools-and-colleges/:slug', getSchoolOrCollege);
