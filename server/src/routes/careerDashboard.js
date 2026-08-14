import { Router } from 'express';
import { studentProductAuth } from '../middleware/requireUserCapability.js';
import {
  getCareerDashboard,
  getDashboardLayoutPreference,
  putDashboardLayoutPreference,
  clearDashboardLayoutPreference,
  requireCareerDashboardEnabled,
  requireDashboardPersonalization,
} from '../controllers/career/careerDashboardController.js';

export const careerDashboardRouter = Router();

const dashboardAuth = [...studentProductAuth, requireCareerDashboardEnabled];
const personalizationAuth = [...dashboardAuth, requireDashboardPersonalization];

careerDashboardRouter.get('/career/dashboard', ...dashboardAuth, getCareerDashboard);
careerDashboardRouter.get('/career/dashboard/layout', ...personalizationAuth, getDashboardLayoutPreference);
careerDashboardRouter.put('/career/dashboard/layout', ...personalizationAuth, putDashboardLayoutPreference);
careerDashboardRouter.delete('/career/dashboard/layout', ...personalizationAuth, clearDashboardLayoutPreference);
