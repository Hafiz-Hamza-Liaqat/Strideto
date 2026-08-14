import { Router } from 'express';
import { getAdmissions, getAdmissionByIdOrSlug } from '../controllers/admissionsController.js';
import { saveAdmission, unsaveAdmission } from '../controllers/savedController.js';
import { studentProductAuth } from '../middleware/requireUserCapability.js';

export const admissionsRouter = Router();

admissionsRouter.get('/admissions', getAdmissions);
admissionsRouter.get('/admissions/:idOrSlug', getAdmissionByIdOrSlug);
admissionsRouter.post('/admissions/:id/save', ...studentProductAuth, saveAdmission);
admissionsRouter.delete('/admissions/:id/save', ...studentProductAuth, unsaveAdmission);
