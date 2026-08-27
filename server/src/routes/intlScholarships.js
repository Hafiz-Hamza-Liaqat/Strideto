import { Router } from 'express';
import { listIntlScholarships, getIntlScholarshipByIdOrSlug, listUniversities } from '../controllers/intlScholarshipsController.js';
import { saveIntlScholarship, unsaveIntlScholarship } from '../controllers/savedController.js';
import { studentProductAuth } from '../middleware/requireUserCapability.js';

export const intlScholarshipsRouter = Router();

intlScholarshipsRouter.get('/intl-scholarships', listIntlScholarships);
intlScholarshipsRouter.get('/intl-scholarships/universities', listUniversities);
intlScholarshipsRouter.get('/intl-scholarships/:idOrSlug', getIntlScholarshipByIdOrSlug);
intlScholarshipsRouter.post('/intl-scholarships/:id/save', ...studentProductAuth, saveIntlScholarship);
intlScholarshipsRouter.delete('/intl-scholarships/:id/save', ...studentProductAuth, unsaveIntlScholarship);
