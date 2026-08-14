import { Router } from 'express';
import { listInternships, getInternshipByIdOrSlug, applyToInternship, getMyApplications } from '../controllers/internshipsController.js';
import { saveInternship, unsaveInternship } from '../controllers/savedController.js';
import { studentProductAuth } from '../middleware/requireUserCapability.js';

export const internshipsRouter = Router();

internshipsRouter.get('/internships', listInternships);
internshipsRouter.get('/internships/:idOrSlug', getInternshipByIdOrSlug);
internshipsRouter.post('/internships/:idOrSlug/apply', ...studentProductAuth, applyToInternship);
internshipsRouter.get('/internships/my/applications', ...studentProductAuth, getMyApplications);
internshipsRouter.post('/internships/:id/save', ...studentProductAuth, saveInternship);
internshipsRouter.delete('/internships/:id/save', ...studentProductAuth, unsaveInternship);
