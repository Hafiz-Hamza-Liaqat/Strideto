/**
 * Thin employer intelligence controllers (C.8.5).
 * Business logic lives in EmployerIntelligenceService / EmployerDashboardCompositionService.
 */
import { asyncHandler } from '../../utils/asyncHandler.js';
import { isEmployerIntelligenceEnabled } from '../../config/careerFeatureFlags.js';
import { EmployerIntelligenceService } from '../../services/career/EmployerIntelligenceService.js';
import { EmployerDashboardCompositionService } from '../../services/career/EmployerDashboardCompositionService.js';

export function requireEmployerIntelligenceEnabled(_req, res, next) {
  if (!isEmployerIntelligenceEnabled()) {
    return res.status(503).json({ error: 'Employer intelligence is disabled' });
  }
  next();
}

function employerIdFrom(req) {
  return req.employer.hiringOwnerId || req.employer.employerId;
}

export function shouldRecordCandidateView(query = {}) {
  return query.recordView !== 'false';
}

export const getIntelligenceDashboard = asyncHandler(async (req, res) => {
  const data = await EmployerDashboardCompositionService.composeForEmployer(employerIdFrom(req));
  res.json(data);
});

export const listCandidates = asyncHandler(async (req, res) => {
  const data = await EmployerIntelligenceService.listCandidates(employerIdFrom(req), req.query);
  res.json(data);
});

export const getCandidateDetail = asyncHandler(async (req, res) => {
  const data = await EmployerIntelligenceService.getCandidateDetail(employerIdFrom(req), req.params.id, {
    recordView: shouldRecordCandidateView(req.query),
  });
  res.json({ data });
});

export const getPipeline = asyncHandler(async (req, res) => {
  const data = await EmployerIntelligenceService.getPipeline(employerIdFrom(req), req.query);
  res.json(data);
});

export const transitionPipeline = asyncHandler(async (req, res) => {
  const data = await EmployerIntelligenceService.transitionPipeline(
    employerIdFrom(req),
    req.params.id,
    req.body
  );
  res.json({ data });
});

export const addNote = asyncHandler(async (req, res) => {
  const data = await EmployerIntelligenceService.addNote(employerIdFrom(req), req.params.id, req.body);
  res.status(201).json({ data });
});

export const scheduleInterview = asyncHandler(async (req, res) => {
  const data = await EmployerIntelligenceService.scheduleInterview(
    employerIdFrom(req),
    req.params.id,
    req.body
  );
  res.json({ data });
});

export const completeInterview = asyncHandler(async (req, res) => {
  const data = await EmployerIntelligenceService.completeInterview(
    employerIdFrom(req),
    req.params.id,
    req.body
  );
  res.json({ data });
});

export const listSavedFilters = asyncHandler(async (req, res) => {
  const data = await EmployerIntelligenceService.listSavedFilters(employerIdFrom(req));
  res.json({ data });
});

export const saveFilter = asyncHandler(async (req, res) => {
  const data = await EmployerIntelligenceService.saveFilter(employerIdFrom(req), req.body);
  res.status(201).json({ data });
});

export const deleteSavedFilter = asyncHandler(async (req, res) => {
  const data = await EmployerIntelligenceService.deleteSavedFilter(employerIdFrom(req), req.params.id);
  res.json(data);
});

export const getRankingWeights = asyncHandler(async (_req, res) => {
  const data = await EmployerIntelligenceService.getRankingWeights();
  res.json({ data });
});

export const getTimelineViewer = asyncHandler(async (req, res) => {
  const data = await EmployerIntelligenceService.getTimelineViewer(employerIdFrom(req), req.params.id);
  res.json({ data });
});

export const getDocumentViewer = asyncHandler(async (req, res) => {
  const data = await EmployerIntelligenceService.getDocumentViewer(employerIdFrom(req), req.params.id);
  res.json({ data });
});

export const getCredentialViewer = asyncHandler(async (req, res) => {
  const data = await EmployerIntelligenceService.getCredentialViewer(employerIdFrom(req), req.params.id);
  res.json({ data });
});

export const compareCandidates = asyncHandler(async (req, res) => {
  const ids = req.body?.legacyApplicationIds || req.body?.ids || [];
  const data = await EmployerIntelligenceService.compareCandidates(employerIdFrom(req), ids);
  res.json({ data });
});
