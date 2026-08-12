import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as announcements from '../controllers/announcementsController.js';

export const announcementsRouter = Router();

announcementsRouter.use(requireAuth);

announcementsRouter.get('/feed', announcements.getFeed);
announcementsRouter.get('/:id', announcements.getOne);
announcementsRouter.post('/:id/read', announcements.read);
announcementsRouter.post('/:id/ack', announcements.ack);
announcementsRouter.post('/:id/vote', announcements.vote);
