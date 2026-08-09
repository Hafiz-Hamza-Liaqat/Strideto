/**
 * Admin Super Control Center API client — Mission 21.
 *
 * All requests go through the authenticated admin API.
 * No client-side secrets. No bearer token construction here — handled by axios interceptors.
 */
import axios from 'axios';

const BASE = '/api/admin';

function params(obj) {
  return { params: Object.fromEntries(Object.entries(obj || {}).filter(([, v]) => v !== undefined && v !== '')) };
}

// ── Overview ───────────────────────────────────────────────────────────────────
export async function getAdminOverview() {
  const r = await axios.get(`${BASE}/overview`);
  return r.data;
}

// ── Organizations ─────────────────────────────────────────────────────────────
export async function listAdminOrganizations(query = {}) {
  const r = await axios.get(`${BASE}/organizations`, params(query));
  return r.data;
}

export async function getAdminOrganization(id) {
  const r = await axios.get(`${BASE}/organizations/${id}`);
  return r.data;
}

// ── Trust — Reports ────────────────────────────────────────────────────────────
export async function listAdminReports(query = {}) {
  const r = await axios.get(`${BASE}/trust/reports`, params(query));
  return r.data;
}

export async function updateAdminReport(id, body) {
  const r = await axios.patch(`${BASE}/trust/reports/${id}`, body);
  return r.data;
}

// ── Trust — Disputes ────────────────────────────────────────────────────────────
export async function listAdminDisputes(query = {}) {
  const r = await axios.get(`${BASE}/trust/disputes`, params(query));
  return r.data;
}

export async function resolveAdminDispute(id, body) {
  const r = await axios.patch(`${BASE}/trust/disputes/${id}/resolve`, body);
  return r.data;
}

// ── Trust — Reviews ────────────────────────────────────────────────────────────
export async function listAdminReviews(query = {}) {
  const r = await axios.get(`${BASE}/trust/reviews`, params(query));
  return r.data;
}

// ── Consultations / Cases ──────────────────────────────────────────────────────
export async function listAdminConsultations(query = {}) {
  const r = await axios.get(`${BASE}/consultations`, params(query));
  return r.data;
}

export async function listAdminCases(query = {}) {
  const r = await axios.get(`${BASE}/cases`, params(query));
  return r.data;
}

// ── Privileged Investigation ───────────────────────────────────────────────────
export async function openPrivilegedInvestigation(body) {
  const r = await axios.post(`${BASE}/trust/investigations`, body);
  return r.data;
}

// ── Commerce ──────────────────────────────────────────────────────────────────
export async function listAdminReconciliation(query = {}) {
  const r = await axios.get(`${BASE}/commerce/reconciliation`, params(query));
  return r.data;
}

export async function markReconciliationManualReview(id, body) {
  const r = await axios.patch(`${BASE}/commerce/reconciliation/${id}/manual-review`, body);
  return r.data;
}

export async function listAdminConnectAccounts(query = {}) {
  const r = await axios.get(`${BASE}/commerce/connect-accounts`, params(query));
  return r.data;
}

export async function listAdminRefunds(query = {}) {
  const r = await axios.get(`${BASE}/commerce/refunds`, params(query));
  return r.data;
}

// ── AI / System ───────────────────────────────────────────────────────────────
export async function getAdminAiStatus() {
  const r = await axios.get(`${BASE}/ai/status`);
  return r.data;
}

export async function getAdminSystemReadiness() {
  const r = await axios.get(`${BASE}/system/readiness`);
  return r.data;
}

export async function getAdminRiskSignals(organizationId) {
  const r = await axios.get(`${BASE}/risk-signals`, { params: { organizationId } });
  return r.data;
}
