import { Router } from 'express';
import { listWebinars, getUpcoming, getWebinarById, registerForWebinar, getMyRegistrations, getRecorded } from '../controllers/webinarsController.js';
import { studentProductAuth } from '../middleware/requireUserCapability.js';

export const webinarsRouter = Router();

webinarsRouter.get('/webinars', listWebinars);
webinarsRouter.get('/webinars/upcoming', getUpcoming);
webinarsRouter.get('/webinars/recorded', getRecorded);
webinarsRouter.get('/webinars/my/registrations', ...studentProductAuth, getMyRegistrations);
webinarsRouter.get('/webinars/:id', getWebinarById);
webinarsRouter.post('/webinars/:id/register', ...studentProductAuth, registerForWebinar);
