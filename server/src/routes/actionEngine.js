/**
 * Action Engine routes — Mission 9.
 *
 * All routes require user authentication.
 * Server derives user identity from JWT. No userId param accepted from caller.
 * No cross-user access permitted.
 */
import { Router } from 'express';
import { studentProductAuth } from '../middleware/requireUserCapability.js';
import {
  getDashboard,
  getJourney,
  getNextAction,
  getActions,
  postAction,
  getActionById,
  patchAction,
  patchActionStatus,
  removeAction,
  getChecklists,
  postChecklist,
  getChecklistById,
  postChecklistItem,
  patchChecklistItem,
  removeChecklist,
  getSavedOpportunities,
  postSaveOpportunity,
  deleteSaveOpportunity,
  checkSaved,
  getDeadlines,
  postDeadline,
  patchDeadline,
  removeDeadline,
  getEduApplications,
  postEduApplication,
  getEduApplicationById,
  patchEduApplicationStatus,
  patchEduApplication,
  removeEduApplication,
  getAlerts,
  putAlerts,
} from '../controllers/actionEngineController.js';

export const actionEngineRouter = Router();

const auth = [...studentProductAuth];

// Dashboard
actionEngineRouter.get('/journey/dashboard', ...auth, getDashboard);

// Journey plan
actionEngineRouter.get('/journey/plan', ...auth, getJourney);

// Next Best Action
actionEngineRouter.get('/journey/next-action', ...auth, getNextAction);

// Actions / Tasks
actionEngineRouter.get('/journey/actions', ...auth, getActions);
actionEngineRouter.post('/journey/actions', ...auth, postAction);
actionEngineRouter.get('/journey/actions/:actionId', ...auth, getActionById);
actionEngineRouter.patch('/journey/actions/:actionId', ...auth, patchAction);
actionEngineRouter.patch('/journey/actions/:actionId/status', ...auth, patchActionStatus);
actionEngineRouter.delete('/journey/actions/:actionId', ...auth, removeAction);

// Checklists
actionEngineRouter.get('/journey/checklists', ...auth, getChecklists);
actionEngineRouter.post('/journey/checklists', ...auth, postChecklist);
actionEngineRouter.get('/journey/checklists/:checklistId', ...auth, getChecklistById);
actionEngineRouter.post('/journey/checklists/:checklistId/items', ...auth, postChecklistItem);
actionEngineRouter.patch('/journey/checklists/:checklistId/items/:itemId', ...auth, patchChecklistItem);
actionEngineRouter.delete('/journey/checklists/:checklistId', ...auth, removeChecklist);

// Saved opportunities
actionEngineRouter.get('/journey/saved', ...auth, getSavedOpportunities);
actionEngineRouter.post('/journey/saved', ...auth, postSaveOpportunity);
actionEngineRouter.delete('/journey/saved/:entityType/:entityId', ...auth, deleteSaveOpportunity);
actionEngineRouter.get('/journey/saved/:entityType/:entityId/status', ...auth, checkSaved);

// Deadlines / Calendar
actionEngineRouter.get('/journey/deadlines', ...auth, getDeadlines);
actionEngineRouter.post('/journey/deadlines', ...auth, postDeadline);
actionEngineRouter.patch('/journey/deadlines/:deadlineId', ...auth, patchDeadline);
actionEngineRouter.delete('/journey/deadlines/:deadlineId', ...auth, removeDeadline);

// Education Application Tracker
actionEngineRouter.get('/journey/edu-applications', ...auth, getEduApplications);
actionEngineRouter.post('/journey/edu-applications', ...auth, postEduApplication);
actionEngineRouter.get('/journey/edu-applications/:appId', ...auth, getEduApplicationById);
actionEngineRouter.patch('/journey/edu-applications/:appId/status', ...auth, patchEduApplicationStatus);
actionEngineRouter.patch('/journey/edu-applications/:appId', ...auth, patchEduApplication);
actionEngineRouter.delete('/journey/edu-applications/:appId', ...auth, removeEduApplication);

// Alert preferences
actionEngineRouter.get('/journey/alert-preferences', ...auth, getAlerts);
actionEngineRouter.put('/journey/alert-preferences', ...auth, putAlerts);
