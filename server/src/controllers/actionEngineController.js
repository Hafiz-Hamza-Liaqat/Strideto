/**
 * Action Engine Controller — Mission 9.
 *
 * All endpoints are authenticated. Server derives userId from req.user.
 * No caller-supplied userId accepted. Cross-user access blocked.
 * No sensitive data in logs.
 */
import {
  listActions,
  createAction,
  getAction,
  updateActionStatus,
  updateAction,
  deleteAction,
  listChecklists,
  createChecklist,
  getChecklist,
  addChecklistItem,
  updateChecklistItem,
  deleteChecklist,
  saveOpportunity,
  unsaveOpportunity,
  listSavedOpportunities,
  isSaved,
  listDeadlines,
  createDeadline,
  updateDeadline,
  deleteDeadline,
  listEducationApplications,
  createEducationApplication,
  getEducationApplication,
  transitionEducationApplicationStatus,
  updateEducationApplication,
  deleteEducationApplication,
  getAlertPreferences,
  upsertAlertPreferences,
  getJourneyPlan,
  getNextBestAction,
  getActionDashboard,
} from '../services/actionEngineService.js';

function parsePageParams(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  return { page, limit };
}

function userId(req) {
  return req.user.userId;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export async function getDashboard(req, res) {
  try {
    const result = await getActionDashboard(userId(req));
    res.json(result);
  } catch (err) {
    console.error('[actionEngine] getDashboard error:', err?.message);
    res.status(500).json({ error: 'dashboard_failed' });
  }
}

// ── Journey plan ──────────────────────────────────────────────────────────────

export async function getJourney(req, res) {
  try {
    const result = await getJourneyPlan(userId(req));
    res.json(result);
  } catch (err) {
    console.error('[actionEngine] getJourney error:', err?.message);
    res.status(500).json({ error: 'journey_failed' });
  }
}

// ── Next Best Action ──────────────────────────────────────────────────────────

export async function getNextAction(req, res) {
  try {
    const result = await getNextBestAction(userId(req));
    res.json({ nextBestAction: result });
  } catch (err) {
    console.error('[actionEngine] getNextAction error:', err?.message);
    res.status(500).json({ error: 'nba_failed' });
  }
}

// ── Actions / Tasks ───────────────────────────────────────────────────────────

export async function getActions(req, res) {
  try {
    const { page, limit } = parsePageParams(req.query);
    const { status, actionType } = req.query;
    const result = await listActions(userId(req), { status, actionType, page, limit });
    res.json(result);
  } catch (err) {
    console.error('[actionEngine] getActions error:', err?.message);
    res.status(500).json({ error: 'list_failed' });
  }
}

export async function postAction(req, res) {
  try {
    const action = await createAction(userId(req), req.body);
    res.status(201).json(action);
  } catch (err) {
    console.error('[actionEngine] postAction error:', err?.message);
    res.status(500).json({ error: 'create_failed' });
  }
}

export async function getActionById(req, res) {
  try {
    const action = await getAction(userId(req), req.params.actionId);
    if (!action) return res.status(404).json({ error: 'not_found' });
    res.json(action);
  } catch (err) {
    console.error('[actionEngine] getActionById error:', err?.message);
    res.status(500).json({ error: 'fetch_failed' });
  }
}

export async function patchAction(req, res) {
  try {
    const action = await updateAction(userId(req), req.params.actionId, req.body);
    if (!action) return res.status(404).json({ error: 'not_found' });
    res.json(action);
  } catch (err) {
    console.error('[actionEngine] patchAction error:', err?.message);
    res.status(500).json({ error: 'update_failed' });
  }
}

export async function patchActionStatus(req, res) {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'status_required' });
    const action = await updateActionStatus(userId(req), req.params.actionId, status);
    if (!action) return res.status(404).json({ error: 'not_found' });
    res.json(action);
  } catch (err) {
    console.error('[actionEngine] patchActionStatus error:', err?.message);
    res.status(500).json({ error: 'update_failed' });
  }
}

export async function removeAction(req, res) {
  try {
    const ok = await deleteAction(userId(req), req.params.actionId);
    if (!ok) return res.status(404).json({ error: 'not_found' });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[actionEngine] removeAction error:', err?.message);
    res.status(500).json({ error: 'delete_failed' });
  }
}

// ── Checklists ────────────────────────────────────────────────────────────────

export async function getChecklists(req, res) {
  try {
    const { targetType, targetId } = req.query;
    const result = await listChecklists(userId(req), { targetType, targetId });
    res.json({ items: result });
  } catch (err) {
    console.error('[actionEngine] getChecklists error:', err?.message);
    res.status(500).json({ error: 'list_failed' });
  }
}

export async function postChecklist(req, res) {
  try {
    const cl = await createChecklist(userId(req), req.body);
    res.status(201).json(cl);
  } catch (err) {
    console.error('[actionEngine] postChecklist error:', err?.message);
    res.status(500).json({ error: 'create_failed' });
  }
}

export async function getChecklistById(req, res) {
  try {
    const cl = await getChecklist(userId(req), req.params.checklistId);
    if (!cl) return res.status(404).json({ error: 'not_found' });
    res.json(cl);
  } catch (err) {
    console.error('[actionEngine] getChecklistById error:', err?.message);
    res.status(500).json({ error: 'fetch_failed' });
  }
}

export async function postChecklistItem(req, res) {
  try {
    const cl = await addChecklistItem(userId(req), req.params.checklistId, req.body);
    if (!cl) return res.status(404).json({ error: 'not_found' });
    res.status(201).json(cl);
  } catch (err) {
    console.error('[actionEngine] postChecklistItem error:', err?.message);
    res.status(500).json({ error: 'create_failed' });
  }
}

export async function patchChecklistItem(req, res) {
  try {
    const cl = await updateChecklistItem(userId(req), req.params.checklistId, req.params.itemId, req.body);
    if (!cl) return res.status(404).json({ error: 'not_found' });
    res.json(cl);
  } catch (err) {
    console.error('[actionEngine] patchChecklistItem error:', err?.message);
    res.status(500).json({ error: 'update_failed' });
  }
}

export async function removeChecklist(req, res) {
  try {
    const ok = await deleteChecklist(userId(req), req.params.checklistId);
    if (!ok) return res.status(404).json({ error: 'not_found' });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[actionEngine] removeChecklist error:', err?.message);
    res.status(500).json({ error: 'delete_failed' });
  }
}

// ── Saved opportunities ───────────────────────────────────────────────────────

export async function getSavedOpportunities(req, res) {
  try {
    const { page, limit } = parsePageParams(req.query);
    const { entityType } = req.query;
    const result = await listSavedOpportunities(userId(req), { entityType, page, limit });
    res.json(result);
  } catch (err) {
    console.error('[actionEngine] getSavedOpportunities error:', err?.message);
    res.status(500).json({ error: 'list_failed' });
  }
}

export async function postSaveOpportunity(req, res) {
  try {
    const { entityType, entityId, notes } = req.body;
    if (!entityType || !entityId) return res.status(400).json({ error: 'entityType_and_entityId_required' });
    const result = await saveOpportunity(userId(req), entityType, entityId, notes);
    if (result.error) return res.status(400).json({ error: result.error });
    res.status(201).json(result);
  } catch (err) {
    console.error('[actionEngine] postSaveOpportunity error:', err?.message);
    res.status(500).json({ error: 'save_failed' });
  }
}

export async function deleteSaveOpportunity(req, res) {
  try {
    const { entityType, entityId } = req.params;
    const result = await unsaveOpportunity(userId(req), entityType, entityId);
    res.json(result);
  } catch (err) {
    console.error('[actionEngine] deleteSaveOpportunity error:', err?.message);
    res.status(500).json({ error: 'unsave_failed' });
  }
}

export async function checkSaved(req, res) {
  try {
    const { entityType, entityId } = req.params;
    const saved = await isSaved(userId(req), entityType, entityId);
    res.json({ saved });
  } catch (err) {
    console.error('[actionEngine] checkSaved error:', err?.message);
    res.status(500).json({ error: 'check_failed' });
  }
}

// ── Deadlines / Calendar ──────────────────────────────────────────────────────

export async function getDeadlines(req, res) {
  try {
    const { page, limit } = parsePageParams(req.query);
    const { from, to, status } = req.query;
    const result = await listDeadlines(userId(req), { from, to, status, page, limit });
    res.json(result);
  } catch (err) {
    console.error('[actionEngine] getDeadlines error:', err?.message);
    res.status(500).json({ error: 'list_failed' });
  }
}

export async function postDeadline(req, res) {
  try {
    const dl = await createDeadline(userId(req), req.body);
    res.status(201).json(dl);
  } catch (err) {
    console.error('[actionEngine] postDeadline error:', err?.message);
    res.status(500).json({ error: 'create_failed' });
  }
}

export async function patchDeadline(req, res) {
  try {
    const dl = await updateDeadline(userId(req), req.params.deadlineId, req.body);
    if (!dl) return res.status(404).json({ error: 'not_found' });
    res.json(dl);
  } catch (err) {
    console.error('[actionEngine] patchDeadline error:', err?.message);
    res.status(500).json({ error: 'update_failed' });
  }
}

export async function removeDeadline(req, res) {
  try {
    const ok = await deleteDeadline(userId(req), req.params.deadlineId);
    if (!ok) return res.status(404).json({ error: 'not_found' });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[actionEngine] removeDeadline error:', err?.message);
    res.status(500).json({ error: 'delete_failed' });
  }
}

// ── Education Applications ────────────────────────────────────────────────────

export async function getEduApplications(req, res) {
  try {
    const { page, limit } = parsePageParams(req.query);
    const { status } = req.query;
    const result = await listEducationApplications(userId(req), { status, page, limit });
    res.json(result);
  } catch (err) {
    console.error('[actionEngine] getEduApplications error:', err?.message);
    res.status(500).json({ error: 'list_failed' });
  }
}

export async function postEduApplication(req, res) {
  try {
    const app = await createEducationApplication(userId(req), req.body);
    res.status(201).json(app);
  } catch (err) {
    console.error('[actionEngine] postEduApplication error:', err?.message);
    res.status(500).json({ error: 'create_failed' });
  }
}

export async function getEduApplicationById(req, res) {
  try {
    const app = await getEducationApplication(userId(req), req.params.appId);
    if (!app) return res.status(404).json({ error: 'not_found' });
    res.json(app);
  } catch (err) {
    console.error('[actionEngine] getEduApplicationById error:', err?.message);
    res.status(500).json({ error: 'fetch_failed' });
  }
}

export async function patchEduApplicationStatus(req, res) {
  try {
    const { status, note } = req.body;
    if (!status) return res.status(400).json({ error: 'status_required' });
    const app = await transitionEducationApplicationStatus(userId(req), req.params.appId, status, note || '');
    if (!app) return res.status(404).json({ error: 'not_found' });
    res.json(app);
  } catch (err) {
    console.error('[actionEngine] patchEduApplicationStatus error:', err?.message);
    res.status(500).json({ error: 'update_failed' });
  }
}

export async function patchEduApplication(req, res) {
  try {
    const app = await updateEducationApplication(userId(req), req.params.appId, req.body);
    if (!app) return res.status(404).json({ error: 'not_found' });
    res.json(app);
  } catch (err) {
    console.error('[actionEngine] patchEduApplication error:', err?.message);
    res.status(500).json({ error: 'update_failed' });
  }
}

export async function removeEduApplication(req, res) {
  try {
    const ok = await deleteEducationApplication(userId(req), req.params.appId);
    if (!ok) return res.status(404).json({ error: 'not_found' });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[actionEngine] removeEduApplication error:', err?.message);
    res.status(500).json({ error: 'delete_failed' });
  }
}

// ── Alert preferences ─────────────────────────────────────────────────────────

export async function getAlerts(req, res) {
  try {
    const prefs = await getAlertPreferences(userId(req));
    res.json(prefs);
  } catch (err) {
    console.error('[actionEngine] getAlerts error:', err?.message);
    res.status(500).json({ error: 'fetch_failed' });
  }
}

export async function putAlerts(req, res) {
  try {
    const prefs = await upsertAlertPreferences(userId(req), req.body);
    res.json(prefs);
  } catch (err) {
    console.error('[actionEngine] putAlerts error:', err?.message);
    res.status(500).json({ error: 'update_failed' });
  }
}
