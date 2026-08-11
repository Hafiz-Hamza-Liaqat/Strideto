/**
 * Action Engine API client — Mission 9.
 *
 * Uses the SEC-3 User-realm axios client (in-memory access token +
 * HttpOnly refresh). Never reads tokens from localStorage.
 */
import axiosInstance from './axiosBase';

async function apiFetch(path, options = {}) {
  const method = String(options.method || 'GET').toLowerCase();
  let data;
  if (options.body) {
    data = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
  }
  try {
    const res = await axiosInstance.request({ url: path, method, data });
    return res.data;
  } catch (err) {
    const body = err.response?.data || { error: 'request_failed' };
    throw Object.assign(new Error(body.error || body.message || 'request_failed'), {
      status: err.response?.status,
      body,
    });
  }
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const getDashboard = () => apiFetch('/journey/dashboard');

// ── Journey ───────────────────────────────────────────────────────────────────
export const getJourneyPlan = () => apiFetch('/journey/plan');
export const getNextBestAction = () => apiFetch('/journey/next-action');

// ── Actions / Tasks ───────────────────────────────────────────────────────────
export const listActions = (params = {}) => apiFetch(`/journey/actions?${new URLSearchParams(params)}`);
export const createAction = (data) => apiFetch('/journey/actions', { method: 'POST', body: JSON.stringify(data) });
export const getAction = (id) => apiFetch(`/journey/actions/${id}`);
export const updateAction = (id, data) => apiFetch(`/journey/actions/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const updateActionStatus = (id, status) => apiFetch(`/journey/actions/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
export const deleteAction = (id) => apiFetch(`/journey/actions/${id}`, { method: 'DELETE' });

// ── Checklists ────────────────────────────────────────────────────────────────
export const listChecklists = (params = {}) => apiFetch(`/journey/checklists?${new URLSearchParams(params)}`);
export const createChecklist = (data) => apiFetch('/journey/checklists', { method: 'POST', body: JSON.stringify(data) });
export const getChecklist = (id) => apiFetch(`/journey/checklists/${id}`);
export const addChecklistItem = (clId, data) => apiFetch(`/journey/checklists/${clId}/items`, { method: 'POST', body: JSON.stringify(data) });
export const updateChecklistItem = (clId, itemId, data) => apiFetch(`/journey/checklists/${clId}/items/${itemId}`, { method: 'PATCH', body: JSON.stringify(data) });
export const deleteChecklist = (id) => apiFetch(`/journey/checklists/${id}`, { method: 'DELETE' });

// ── Saved opportunities ───────────────────────────────────────────────────────
export const listSaved = (params = {}) => apiFetch(`/journey/saved?${new URLSearchParams(params)}`);
export const saveOpportunity = (data) => apiFetch('/journey/saved', { method: 'POST', body: JSON.stringify(data) });
export const unsaveOpportunity = (entityType, entityId) => apiFetch(`/journey/saved/${entityType}/${entityId}`, { method: 'DELETE' });
export const checkSaved = (entityType, entityId) => apiFetch(`/journey/saved/${entityType}/${entityId}/status`);

// ── Deadlines ─────────────────────────────────────────────────────────────────
export const listDeadlines = (params = {}) => apiFetch(`/journey/deadlines?${new URLSearchParams(params)}`);
export const createDeadline = (data) => apiFetch('/journey/deadlines', { method: 'POST', body: JSON.stringify(data) });
export const updateDeadline = (id, data) => apiFetch(`/journey/deadlines/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const deleteDeadline = (id) => apiFetch(`/journey/deadlines/${id}`, { method: 'DELETE' });

// ── Education Applications ────────────────────────────────────────────────────
export const listEduApplications = (params = {}) => apiFetch(`/journey/edu-applications?${new URLSearchParams(params)}`);
export const createEduApplication = (data) => apiFetch('/journey/edu-applications', { method: 'POST', body: JSON.stringify(data) });
export const getEduApplication = (id) => apiFetch(`/journey/edu-applications/${id}`);
export const updateEduApplicationStatus = (id, status, note = '') => apiFetch(`/journey/edu-applications/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, note }) });
export const updateEduApplication = (id, data) => apiFetch(`/journey/edu-applications/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const deleteEduApplication = (id) => apiFetch(`/journey/edu-applications/${id}`, { method: 'DELETE' });

// ── Alert preferences ─────────────────────────────────────────────────────────
export const getAlertPreferences = () => apiFetch('/journey/alert-preferences');
export const updateAlertPreferences = (data) => apiFetch('/journey/alert-preferences', { method: 'PUT', body: JSON.stringify(data) });
