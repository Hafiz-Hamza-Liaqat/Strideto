import { Router } from 'express';
import { studentProductAuth } from '../middleware/requireUserCapability.js';
import {
  listMyTimeline,
  listApplicationTimeline,
  requireTimelineEnabled,
} from '../controllers/career/timelineController.js';

export const timelineRouter = Router();

const timelineAuth = [...studentProductAuth, requireTimelineEnabled];

timelineRouter.get('/timeline', ...timelineAuth, listMyTimeline);
timelineRouter.get('/timeline/applications/:applicationId', ...timelineAuth, listApplicationTimeline);
