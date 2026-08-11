import { asyncHandler } from '../../utils/asyncHandler.js';
import { isOpportunityApplicationEnabled } from '../../config/careerFeatureFlags.js';
import { OpportunityApplicationService } from '../../services/career/OpportunityApplicationService.js';
import { listStageTemplates } from '../../../../shared/career/applicationStageMachine.js';

function requireOpportunityApplicationEnabled(_req, res, next) {
  if (!isOpportunityApplicationEnabled()) {
    return res.status(503).json({ error: 'Opportunity application API is disabled' });
  }
  next();
}

function actorFromReq(req) {
  return { type: 'talent', id: String(req.user.userId) };
}

export const listApplications = asyncHandler(async (req, res) => {
  const data = await OpportunityApplicationService.listForUser(req.user.userId, req.query);
  res.json({ data, total: data.length });
});

export const createApplication = asyncHandler(async (req, res) => {
  const application = await OpportunityApplicationService.create(req.user.userId, req.body, actorFromReq(req));
  res.status(201).json(application);
});

export const getApplication = asyncHandler(async (req, res) => {
  const application = await OpportunityApplicationService.getById(req.user.userId, req.params.id);
  res.json(application);
});

export const updateApplication = asyncHandler(async (req, res) => {
  const application = await OpportunityApplicationService.update(
    req.user.userId,
    req.params.id,
    req.body,
    actorFromReq(req)
  );
  res.json(application);
});

export const archiveApplication = asyncHandler(async (req, res) => {
  const application = await OpportunityApplicationService.archive(
    req.user.userId,
    req.params.id,
    actorFromReq(req)
  );
  res.json(application);
});

export const transitionApplicationStage = asyncHandler(async (req, res) => {
  const application = await OpportunityApplicationService.transitionStage(
    req.user.userId,
    req.params.id,
    req.body,
    actorFromReq(req)
  );
  res.json(application);
});

export const addApplicationNote = asyncHandler(async (req, res) => {
  const application = await OpportunityApplicationService.addNote(
    req.user.userId,
    req.params.id,
    req.body,
    actorFromReq(req)
  );
  res.json(application);
});

export const attachApplicationDocument = asyncHandler(async (req, res) => {
  const application = await OpportunityApplicationService.attachDocument(
    req.user.userId,
    req.params.id,
    req.body,
    actorFromReq(req)
  );
  res.json(application);
});

export const removeApplicationDocument = asyncHandler(async (req, res) => {
  const application = await OpportunityApplicationService.removeDocument(
    req.user.userId,
    req.params.id,
    req.params.documentId
  );
  res.json(application);
});

export const addApplicationReminder = asyncHandler(async (req, res) => {
  const application = await OpportunityApplicationService.addReminder(
    req.user.userId,
    req.params.id,
    req.body,
    actorFromReq(req)
  );
  res.json(application);
});

export const updateApplicationReminder = asyncHandler(async (req, res) => {
  const application = await OpportunityApplicationService.updateReminder(
    req.user.userId,
    req.params.id,
    req.params.reminderId,
    req.body
  );
  res.json(application);
});

export const removeApplicationReminder = asyncHandler(async (req, res) => {
  const application = await OpportunityApplicationService.removeReminder(
    req.user.userId,
    req.params.id,
    req.params.reminderId
  );
  res.json(application);
});

export const listStageTemplatesHandler = asyncHandler(async (_req, res) => {
  res.json({ data: listStageTemplates() });
});

export const getApplicationMetrics = asyncHandler(async (req, res) => {
  const { ApplicationMetricsService } = await import(
    '../../services/career/ApplicationMetricsService.js'
  );
  const metrics = await ApplicationMetricsService.getForUser(req.user.userId);
  res.json(metrics);
});

export const addApplicationContact = asyncHandler(async (req, res) => {
  const application = await OpportunityApplicationService.addContact(
    req.user.userId,
    req.params.id,
    req.body,
    actorFromReq(req)
  );
  res.json(application);
});

export const removeApplicationContact = asyncHandler(async (req, res) => {
  const application = await OpportunityApplicationService.removeContact(
    req.user.userId,
    req.params.id,
    req.params.contactId
  );
  res.json(application);
});

export const upsertApplicationInterview = asyncHandler(async (req, res) => {
  const application = await OpportunityApplicationService.upsertInterview(
    req.user.userId,
    req.params.id,
    req.body,
    actorFromReq(req)
  );
  res.json(application);
});

export { requireOpportunityApplicationEnabled };
