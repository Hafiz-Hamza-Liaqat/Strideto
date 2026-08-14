import { isBusinessServicesEnabled } from '../../../shared/gbs/constants.js';
import { projectProviderCatalog } from '../../../shared/gbs/providerCatalogProjection.js';
import {
  resolveAuthorizedProviderSubjects,
  assertAuthorizedProviderSubject,
} from '../services/gbs/providerSubjectContext.js';
import { getProviderWorkspaceSummary } from '../services/gbs/providerWorkspaceSummaryService.js';
import {
  claimProviderCapability,
  listSubjectCapabilities,
  publicCapabilityProjection,
  submitCapabilityEvidenceMetadata,
  updateClaimedCapabilityScope,
} from '../services/gbs/providerCapabilityClaimService.js';
import {
  archiveServiceListing,
  createServiceListingDraft,
  getSubjectListing,
  listSubjectListings,
  publicListingProjection,
  submitServiceListingForReview,
  updateServiceListing,
} from '../services/gbs/serviceListingService.js';

function actorFrom(req) {
  return {
    id: req.agent?.agentAccountId,
    agentAccountId: req.agent?.agentAccountId,
    role: 'agent',
    isStaff: false,
    subjectType: 'agent',
    subjectId: req.agent?.agentAccountId,
  };
}

function sendError(res, err) {
  const status = err.status || 500;
  const payload = { error: err.code || err.message || 'server_error' };
  if (err.errors) payload.details = err.errors;
  return res.status(status).json(payload);
}

async function requireSubject(req) {
  const subjectType = req.query.subjectType || req.body?.subjectType;
  const subjectId = req.query.subjectId || req.body?.subjectId;
  return assertAuthorizedProviderSubject({
    agentAccountId: req.agent.agentAccountId,
    subjectType,
    subjectId,
    actor: actorFrom(req),
  });
}

export async function getEnabled(_req, res) {
  return res.json({ enabled: isBusinessServicesEnabled(process.env) });
}

export async function getContext(req, res) {
  try {
    const { subjects } = await resolveAuthorizedProviderSubjects(req.agent.agentAccountId);
    return res.json({ enabled: true, subjects });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function getOverview(req, res) {
  try {
    const subject = await requireSubject(req);
    const summary = await getProviderWorkspaceSummary(subject);
    return res.json(summary);
  } catch (err) {
    return sendError(res, err);
  }
}

export async function getCatalog(_req, res) {
  try {
    return res.json(projectProviderCatalog());
  } catch (err) {
    return sendError(res, err);
  }
}

export async function listCapabilities(req, res) {
  try {
    const subject = await requireSubject(req);
    const rows = await listSubjectCapabilities(subject);
    return res.json({ items: rows.map(publicCapabilityProjection) });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function claimCapability(req, res) {
  try {
    const subject = await requireSubject(req);
    const { record, created } = await claimProviderCapability({
      ...subject,
      capabilityId: req.body?.capabilityId,
      scope: req.body?.scope,
      actor: actorFrom(req),
    });
    return res.status(created ? 201 : 200).json({ item: publicCapabilityProjection(record), created });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function patchCapabilityScope(req, res) {
  try {
    const subject = await requireSubject(req);
    const record = await updateClaimedCapabilityScope({
      id: req.params.id,
      ...subject,
      expectedVersion: req.body?.expectedVersion,
      scope: req.body?.scope,
      actor: actorFrom(req),
    });
    return res.json({ item: publicCapabilityProjection(record) });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function postCapabilityEvidence(req, res) {
  try {
    const subject = await requireSubject(req);
    const record = await submitCapabilityEvidenceMetadata({
      id: req.params.id,
      ...subject,
      expectedVersion: req.body?.expectedVersion,
      evidence: req.body?.evidence,
      actor: actorFrom(req),
    });
    return res.json({ item: publicCapabilityProjection(record) });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function listListings(req, res) {
  try {
    const subject = await requireSubject(req);
    const result = await listSubjectListings({
      ...subject,
      page: req.query.page,
      limit: req.query.limit,
      moderationStatus: req.query.moderationStatus,
    });
    return res.json({
      ...result,
      items: result.items.map(publicListingProjection),
    });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function getListing(req, res) {
  try {
    const subject = await requireSubject(req);
    const record = await getSubjectListing({ id: req.params.listingId, ...subject });
    return res.json({ item: publicListingProjection(record) });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function createListing(req, res) {
  try {
    const subject = await requireSubject(req);
    const commandId = String(req.body?.creationCommandId || req.get('Idempotency-Key') || '').trim();
    if (!commandId) {
      return res.status(400).json({ error: 'creationCommandId is required' });
    }
    const { listing, replay, risk } = await createServiceListingDraft({
      input: { ...req.body, ...subject },
      actor: actorFrom(req),
      commandId,
    });
    return res.status(replay ? 200 : 201).json({
      item: publicListingProjection(listing),
      replay: Boolean(replay),
      riskFlags: risk.codes,
    });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function patchListing(req, res) {
  try {
    const subject = await requireSubject(req);
    const record = await updateServiceListing({
      id: req.params.listingId,
      ...subject,
      expectedVersion: req.body?.expectedVersion,
      input: req.body,
      actor: actorFrom(req),
    });
    return res.json({ item: publicListingProjection(record) });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function submitListing(req, res) {
  try {
    const subject = await requireSubject(req);
    const record = await submitServiceListingForReview({
      id: req.params.listingId,
      ...subject,
      expectedVersion: req.body?.expectedVersion,
      actor: actorFrom(req),
    });
    return res.json({ item: publicListingProjection(record) });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function archiveListing(req, res) {
  try {
    const subject = await requireSubject(req);
    const record = await archiveServiceListing({
      id: req.params.listingId,
      ...subject,
      expectedVersion: req.body?.expectedVersion,
      actor: actorFrom(req),
    });
    return res.json({ item: publicListingProjection(record) });
  } catch (err) {
    return sendError(res, err);
  }
}
