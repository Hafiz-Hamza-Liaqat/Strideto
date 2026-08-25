import { isBusinessServicesProviderEnabled, isBusinessServicesPublicMarketplaceEnabled } from '../../../shared/gbs/constants.js';
import { AgentProfile } from '../models/agent/AgentProfile.js';
import { projectProviderCatalog } from '../../../shared/gbs/providerCatalogProjection.js';
import {
  resolveAuthorizedProviderSubjects,
  assertAuthorizedProviderSubject,
} from '../services/gbs/providerSubjectContext.js';
import {
  assertProviderDomainAccess,
  listEnrollmentsForSubject,
} from '../services/gbs/providerDomainService.js';
import { PROVIDER_DOMAIN_IDS } from '../../../shared/provider/providerDomains.js';
import { PROVIDER_DOMAIN_PERMISSIONS } from '../../../shared/provider/providerDomainPermissions.js';
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
import {
  getBusinessProfessionalProfile,
  updateBusinessProfessionalProfile,
} from '../services/gbs/gbsProviderProfessionalProfileService.js';
import { submitCoverageAppeal } from '../services/gbs/coverageAppealService.js';

async function resolveOrganizationId(agentAccountId) {
  if (!agentAccountId) return null;
  const profile = await AgentProfile.findOne(
    { agentAccountId: String(agentAccountId) },
    { organizationId: 1 }
  ).lean();
  return profile?.organizationId ? String(profile.organizationId) : null;
}

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

async function requireSubject(req, permissionId = PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_VIEW) {
  const subjectType = req.query.subjectType || req.body?.subjectType;
  const subjectId = req.query.subjectId || req.body?.subjectId;
  const subject = await assertAuthorizedProviderSubject({
    agentAccountId: req.agent.agentAccountId,
    subjectType,
    subjectId,
    actor: actorFrom(req),
  });
  await assertProviderDomainAccess({
    agentAccountId: req.agent.agentAccountId,
    subjectType: subject.subjectType,
    subjectId: subject.subjectId,
    domainId: PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES,
    permissionId,
    actor: actorFrom(req),
  });
  return subject;
}

export async function getEnabled(_req, res) {
  return res.json({
    enabled: isBusinessServicesProviderEnabled(process.env),
    publicMarketplaceEnabled: isBusinessServicesPublicMarketplaceEnabled(process.env),
  });
}

export async function getContext(req, res) {
  try {
    const { subjects } = await resolveAuthorizedProviderSubjects(req.agent.agentAccountId);
    const enrolled = [];
    for (const subject of subjects) {
      const rows = await listEnrollmentsForSubject(subject.subjectType, subject.subjectId);
      if (rows.some((row) => row.domainId === PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES)) {
        enrolled.push(subject);
      }
    }
    return res.json({ enabled: isBusinessServicesProviderEnabled(process.env), subjects: enrolled });
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
    const subject = await requireSubject(req, PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_CAPABILITIES_MANAGE);
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
    const subject = await requireSubject(req, PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_CAPABILITIES_MANAGE);
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
    const subject = await requireSubject(req, PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_CAPABILITIES_MANAGE);
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
    const subject = await requireSubject(req, PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_LISTINGS_MANAGE);
    const commandId = String(req.body?.creationCommandId || req.get('Idempotency-Key') || '').trim();
    if (!commandId) {
      return res.status(400).json({ error: 'creationCommandId is required' });
    }
    const organizationId = await resolveOrganizationId(req.agent?.agentAccountId);
    const { listing, replay, risk } = await createServiceListingDraft({
      input: { ...req.body, ...subject },
      actor: actorFrom(req),
      commandId,
      organizationId,
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
    const subject = await requireSubject(req, PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_LISTINGS_MANAGE);
    const organizationId = await resolveOrganizationId(req.agent?.agentAccountId);
    const record = await updateServiceListing({
      id: req.params.listingId,
      ...subject,
      expectedVersion: req.body?.expectedVersion,
      input: req.body,
      actor: actorFrom(req),
      organizationId,
    });
    return res.json({ item: publicListingProjection(record) });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function submitListing(req, res) {
  try {
    const subject = await requireSubject(req, PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_LISTINGS_MANAGE);
    const organizationId = await resolveOrganizationId(req.agent?.agentAccountId);
    const record = await submitServiceListingForReview({
      id: req.params.listingId,
      ...subject,
      expectedVersion: req.body?.expectedVersion,
      actor: actorFrom(req),
      organizationId,
    });
    return res.json({ item: publicListingProjection(record) });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function archiveListing(req, res) {
  try {
    const subject = await requireSubject(req, PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_LISTINGS_MANAGE);
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

export async function submitListingAppeal(req, res) {
  try {
    const subject = await requireSubject(req, PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_LISTINGS_MANAGE);
    const { reason, explanation, evidenceRef, expectedVersion } = req.body || {};
    const updated = await submitCoverageAppeal({
      id: req.params.listingId,
      ...subject,
      expectedVersion,
      actor: actorFrom(req),
      reason,
      explanation,
      evidenceRef,
    });
    return res.json({ item: publicListingProjection(updated) });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function getProfessionalProfile(req, res) {
  try {
    const subject = await requireSubject(req);
    const profile = await getBusinessProfessionalProfile(subject);
    return res.json({ profile });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function patchProfessionalProfile(req, res) {
  try {
    const subject = await requireSubject(req, PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_CAPABILITIES_MANAGE);
    const profile = await updateBusinessProfessionalProfile(subject, req.body || {}, actorFrom(req));
    return res.json({ profile });
  } catch (err) {
    return sendError(res, err);
  }
}
