/**
 * Admin GBS capability + listing moderation (Phase 17D-4).
 * Staff auth is applied by adminRouter. These handlers enforce exact-subject
 * review commands, bounded queues, and safe projections.
 */
import mongoose from 'mongoose';
import { ProviderCapability } from '../../models/gbs/ProviderCapability.js';
import { GbsServiceListing } from '../../models/gbs/GbsServiceListing.js';
import { AuditLog } from '../../models/AuditLog.js';
import { listResponse, paginate } from '../../utils/apiResponse.js';
import { adminSafeEvidenceProjection } from '../../../../shared/gbs/providerEvidence.js';
import { getBusinessServicesCapability } from '../../../../shared/gbs/businessServicesCapabilities.js';
import { GBS_AUDIT_EVENTS, redactAuditMetadata } from '../../../../shared/security/gbsAuditEvents.js';
import { logAudit } from '../../services/auditService.js';
import { mutateProviderCapabilityRecord } from '../../services/platform/optimisticConcurrency.js';
import {
  createProviderCapabilityReviewService,
} from '../../services/gbs/providerCapabilityReviewService.js';
import {
  approveServiceListing,
  needsInformationServiceListing,
  rejectServiceListing,
  suspendServiceListing,
} from '../../services/gbs/serviceListingReviewService.js';
import {
  approveAppeal,
  listPendingAppeals,
  rejectAppeal,
} from '../../services/gbs/coverageAppealService.js';
import {
  parseAdminGbsReviewBody,
  parseCapabilityQueueQuery,
  parseEvidenceIndex,
  parseListingQueueQuery,
  parseStaffEvidenceReviewAction,
} from '../../services/gbs/gbsAdminModerationValidation.js';
import {
  resolveProviderSubjectLabels,
  subjectKindLabel,
} from '../../services/gbs/providerSubjectLabels.js';
import { evaluateListingPublicationGate } from '../../../../shared/gbs/listingPublicationGate.js';
import { isBusinessServicesPublicMarketplaceEnabled } from '../../../../shared/gbs/constants.js';
import { publicListingProjection } from '../../services/gbs/serviceListingService.js';
import { resolveJurisdictionProductionReadiness } from '../../../../shared/gbs/providerCatalogProjection.js';

const capabilityReview = createProviderCapabilityReviewService({
  readinessResolver: resolveJurisdictionProductionReadiness,
  store: {
    async getById(id) {
      return ProviderCapability.findById(id).lean();
    },
  },
  mutateRecord: mutateProviderCapabilityRecord,
  audit: async (entry) => {
    await logAudit({
      action: entry.action,
      status: entry.status || 'success',
      metadata: entry.metadata,
      targetType: 'ProviderCapability',
    });
  },
});

function staffActor(req) {
  return {
    isStaff: true,
    realm: 'staff',
    id: req.user?.userId,
    userId: req.user?.userId,
    role: req.user?.role,
    email: req.user?.email,
  };
}

function sendError(res, err) {
  const status = err.status || 500;
  const payload = { error: err.code || err.message || 'server_error' };
  if (err.currentVersion != null) payload.currentVersion = err.currentVersion;
  if (err.errors) payload.details = err.errors;
  return res.status(status).json(payload);
}

function isObjectId(id) {
  return mongoose.isValidObjectId(id) && String(new mongoose.Types.ObjectId(id)) === String(id);
}

function capabilityProjection(record, subject = null) {
  const def = getBusinessServicesCapability(record.capabilityId);
  const jurisdictionReadiness = (record.scope?.jurisdictionIds || []).map((jurisdictionId) => {
    const resolved = resolveJurisdictionProductionReadiness(jurisdictionId);
    return {
      jurisdictionId,
      name: resolved.jurisdiction?.name || '',
      productionReady: resolved.productionReady,
      state: resolved.state,
      reason: resolved.reason,
    };
  });
  return {
    id: String(record._id || record.id),
    subjectType: record.subjectType,
    subjectId: String(record.subjectId),
    subjectKind: subject?.subjectKind || subjectKindLabel(record.subjectType),
    subjectLabel: subject?.subjectLabel || '',
    capabilityId: record.capabilityId,
    publicName: def?.publicName || record.capabilityId,
    status: record.status,
    trustStatus: record.trustStatus,
    scope: record.scope || {},
    jurisdictionReadiness,
    evidenceRequired: def?.evidenceRequired === true,
    evidence: (record.evidenceRefs || []).map((row, index) => adminSafeEvidenceProjection(row, index)),
    review: {
      decision: record.review?.decision || null,
      reasonCode: record.review?.reasonCode || null,
    },
    recordVersion: record.recordVersion,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function listingProjection(record, subject = null, extras = {}) {
  const base = publicListingProjection(record);
  return {
    ...base,
    subjectKind: subject?.subjectKind || subjectKindLabel(record.subjectType),
    subjectLabel: subject?.subjectLabel || '',
    reviewedBy: record.reviewedBy || null,
    reviewedAt: record.reviewedAt || null,
    reviewReason: record.reviewReason || '',
    marketplaceEnabled: isBusinessServicesPublicMarketplaceEnabled(process.env),
    publicPublication: 'denied',
    publicationStatus: record.publicationStatus || 'private',
    ...extras,
  };
}

async function attachSubjectLabels(rows) {
  const labels = await resolveProviderSubjectLabels(rows);
  const byKey = new Map(labels.map((row) => [`${row.subjectType}:${row.subjectId}`, row]));
  return rows.map((row) => byKey.get(`${row.subjectType}:${row.subjectId}`) || {
    subjectType: row.subjectType,
    subjectId: String(row.subjectId),
    subjectKind: subjectKindLabel(row.subjectType),
    subjectLabel: '',
  });
}

async function reviewHistory(targetType, targetId) {
  const events = await AuditLog.find({ targetType, targetId: String(targetId) })
    .select('action status createdAt actorRole metadata reason')
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();
  return events.map((row) => ({
    action: row.action,
    status: row.status,
    createdAt: row.createdAt,
    actorRole: row.actorRole,
    reason: row.reason || '',
    metadata: redactAuditMetadata(row.metadata || {}),
  }));
}

function alreadyEvidenceState(record, evidenceIndex, decision) {
  const row = (record.evidenceRefs || [])[evidenceIndex];
  return Boolean(row) && (row.decision || 'pending') === decision;
}

function alreadyCapabilityState(record, action) {
  if (action === 'verify') {
    return record.trustStatus === 'verified' && record.status === 'active';
  }
  if (action === 'mark-evidence-backed') {
    return record.trustStatus === 'evidence_backed' || record.trustStatus === 'verified';
  }
  if (action === 'needs-information') {
    return record.review?.decision === 'needs_information';
  }
  if (action === 'reject') {
    return record.review?.decision === 'rejected';
  }
  if (action === 'suspend') {
    return record.trustStatus === 'suspended' || record.status === 'suspended';
  }
  if (action === 'revoke') {
    return record.trustStatus === 'revoked' || record.status === 'revoked';
  }
  return false;
}

export async function listCapabilityQueue(req, res) {
  try {
    const parsed = parseCapabilityQueueQuery(req.query);
    const skip = (parsed.page - 1) * parsed.limit;
    const [total, rows] = await Promise.all([
      ProviderCapability.countDocuments(parsed.filter),
      ProviderCapability.find(parsed.filter)
        .sort(parsed.sort)
        .skip(skip)
        .limit(parsed.limit)
        .lean(),
    ]);
    const labels = await attachSubjectLabels(rows);
    const data = rows.map((row, i) => capabilityProjection(row, labels[i]));
    const pagination = paginate(parsed.page, parsed.limit, total);
    return res.json({
      ...listResponse(data, pagination),
      pagination: { ...pagination, pages: pagination.totalPages },
    });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function getCapabilityDetail(req, res) {
  try {
    if (!isObjectId(req.params.id)) return res.status(400).json({ error: 'invalid_id' });
    const record = await ProviderCapability.findById(req.params.id).lean();
    if (!record) return res.status(404).json({ error: 'provider_capability_not_found' });
    const [label] = await attachSubjectLabels([record]);
    return res.json({
      capability: capabilityProjection(record, label),
      history: await reviewHistory('ProviderCapability', record._id),
    });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function reviewCapability(req, res) {
  try {
    if (!isObjectId(req.params.id)) return res.status(400).json({ error: 'invalid_id' });
    const action = req.params.action;
    const body = parseAdminGbsReviewBody(req.body, { action });
    const current = await ProviderCapability.findOne({
      _id: req.params.id,
      subjectType: body.subjectType,
      subjectId: body.subjectId,
    }).lean();
    if (!current) return res.status(404).json({ error: 'provider_capability_not_found' });

    const actor = staffActor(req);
    const args = {
      id: req.params.id,
      subjectType: body.subjectType,
      subjectId: body.subjectId,
      expectedVersion: body.expectedVersion,
      actor,
      reasonCode: body.reasonCode,
    };
    let record;
    if (action === 'mark-evidence-backed') record = await capabilityReview.markEvidenceBacked(args);
    else if (action === 'verify') record = await capabilityReview.verify(args);
    else if (action === 'needs-information') record = await capabilityReview.needsInformation(args);
    else if (action === 'reject') record = await capabilityReview.reject(args);
    else if (action === 'suspend') record = await capabilityReview.suspend(args);
    else if (action === 'revoke') record = await capabilityReview.revoke(args);
    else return res.status(400).json({ error: 'unknown_review_action' });

    const plain = record.toObject ? record.toObject() : record;
    const replay =
      alreadyCapabilityState(current, action) && Number(current.recordVersion) === Number(plain.recordVersion);
    const [label] = await attachSubjectLabels([plain]);
    if (!replay) {
      await logAudit({
        actor,
        action: GBS_AUDIT_EVENTS.PROVIDER_CAPABILITY_REVIEWED,
        targetType: 'ProviderCapability',
        targetId: String(plain._id || req.params.id),
        metadata: redactAuditMetadata({
          reviewAction: action,
          subjectType: plain.subjectType,
          subjectId: plain.subjectId,
          capabilityId: plain.capabilityId,
          trustStatus: plain.trustStatus,
        }),
        reason: body.reason,
      });
    }
    return res.json({ capability: capabilityProjection(plain, label), replay });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function reviewCapabilityEvidence(req, res) {
  try {
    if (!isObjectId(req.params.id)) return res.status(400).json({ error: 'invalid_id' });
    const action = req.params.action;
    const evidenceIndex = parseEvidenceIndex(req.params.evidenceIndex);
    const decision = parseStaffEvidenceReviewAction(action);
    const body = parseAdminGbsReviewBody(req.body, { action });
    const current = await ProviderCapability.findOne({
      _id: req.params.id,
      subjectType: body.subjectType,
      subjectId: body.subjectId,
    }).lean();
    if (!current) return res.status(404).json({ error: 'provider_capability_not_found' });

    const actor = staffActor(req);
    const record = await capabilityReview.reviewEvidence({
      id: req.params.id,
      subjectType: body.subjectType,
      subjectId: body.subjectId,
      expectedVersion: body.expectedVersion,
      actor,
      evidenceIndex,
      decision,
      reasonCode: body.reasonCode,
    });

    const plain = record.toObject ? record.toObject() : record;
    const replay =
      alreadyEvidenceState(current, evidenceIndex, decision) &&
      Number(current.recordVersion) === Number(plain.recordVersion);
    const [label] = await attachSubjectLabels([plain]);
    if (!replay) {
      await logAudit({
        actor,
        action: GBS_AUDIT_EVENTS.PROVIDER_CAPABILITY_REVIEWED,
        targetType: 'ProviderCapability',
        targetId: String(plain._id || req.params.id),
        metadata: redactAuditMetadata({
          reviewAction: action,
          evidenceIndex,
          evidenceType: (plain.evidenceRefs || [])[evidenceIndex]?.evidenceType || null,
          oldDecision: (current.evidenceRefs || [])[evidenceIndex]?.decision || null,
          newDecision: decision,
          subjectType: plain.subjectType,
          subjectId: plain.subjectId,
          capabilityId: plain.capabilityId,
          trustStatus: plain.trustStatus,
        }),
        reason: body.reason,
      });
    }
    return res.json({ capability: capabilityProjection(plain, label), replay });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function listListingQueue(req, res) {
  try {
    const parsed = parseListingQueueQuery(req.query);
    const skip = (parsed.page - 1) * parsed.limit;
    const [total, rows] = await Promise.all([
      GbsServiceListing.countDocuments(parsed.filter),
      GbsServiceListing.find(parsed.filter)
        .sort(parsed.sort)
        .skip(skip)
        .limit(parsed.limit)
        .lean(),
    ]);
    const labels = await attachSubjectLabels(rows);
    const data = rows.map((row, i) => listingProjection(row, labels[i]));
    const pagination = paginate(parsed.page, parsed.limit, total);
    return res.json({
      ...listResponse(data, pagination),
      pagination: { ...pagination, pages: pagination.totalPages },
    });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function getListingDetail(req, res) {
  try {
    if (!isObjectId(req.params.id)) return res.status(400).json({ error: 'invalid_id' });
    const record = await GbsServiceListing.findById(req.params.id).lean();
    if (!record) return res.status(404).json({ error: 'listing_not_found' });
    const capability = await ProviderCapability.findOne({
      subjectType: record.subjectType,
      subjectId: String(record.subjectId),
      capabilityId: record.capabilityId,
    }).lean();
    const publication = evaluateListingPublicationGate({
      env: process.env,
      listing: record,
      capability,
      jurisdictionReadiness: resolveJurisdictionProductionReadiness(record.jurisdictionId),
    });
    const [label] = await attachSubjectLabels([record]);
    return res.json({
      listing: listingProjection(record, label, {
        publicationGate: {
          allowed: publication.allowed === true,
          reason: publication.reason,
          eligible: publication.allowed === true,
          publiclyDiscoverable: false,
        },
        capability: capability
          ? {
              id: String(capability._id),
              capabilityId: capability.capabilityId,
              trustStatus: capability.trustStatus,
              status: capability.status,
              subjectType: capability.subjectType,
              subjectId: String(capability.subjectId),
            }
          : null,
      }),
      history: await reviewHistory('GbsServiceListing', record._id),
    });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function reviewListing(req, res) {
  try {
    if (!isObjectId(req.params.id)) return res.status(400).json({ error: 'invalid_id' });
    const action = req.params.action;
    const body = parseAdminGbsReviewBody(req.body, { action });
    const actor = staffActor(req);
    const args = {
      id: req.params.id,
      subjectType: body.subjectType,
      subjectId: body.subjectId,
      expectedVersion: body.expectedVersion,
      actor,
      reason: body.reason,
    };
    let result;
    if (action === 'approve') result = await approveServiceListing(args);
    else if (action === 'needs-information') result = await needsInformationServiceListing(args);
    else if (action === 'reject') result = await rejectServiceListing(args);
    else if (action === 'suspend') result = await suspendServiceListing(args);
    else return res.status(400).json({ error: 'unknown_review_action' });

    const listing = result.listing.toObject ? result.listing.toObject() : result.listing;
    const [label] = await attachSubjectLabels([listing]);
    return res.json({
      listing: listingProjection(listing, label, {
        publicationGate: result.publication
          ? {
              allowed: result.publication.allowed === true,
              reason: result.publication.reason,
              eligible: result.publication.allowed === true,
              publiclyDiscoverable: false,
            }
          : { allowed: false, publiclyDiscoverable: false },
      }),
      replay: Boolean(result.replay),
    });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function listAppealQueue(req, res) {
  try {
    const { parseBoundedPage } = await import('../../services/gbs/gbsAdminModerationValidation.js');
    const parsed = parseBoundedPage(req.query);
    const { items, total } = await listPendingAppeals({ page: parsed.page, limit: parsed.limit });
    const labels = await attachSubjectLabels(items);
    const data = items.map((row, i) => ({
      ...listingProjection(row, labels[i]),
      appeal: row.appeal || null,
    }));
    return res.json({ items: data, total, page: parsed.page, limit: parsed.limit });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function reviewAppeal(req, res) {
  try {
    if (!isObjectId(req.params.id)) return res.status(400).json({ error: 'invalid_id' });
    const action = req.params.action;
    const body = parseAdminGbsReviewBody(req.body, { action: 'reject' });
    const actor = staffActor(req);
    const args = {
      id: req.params.id,
      subjectType: body.subjectType,
      subjectId: body.subjectId,
      expectedVersion: body.expectedVersion,
      actor,
      reason: body.reason,
    };
    let updated;
    if (action === 'approve') updated = await approveAppeal(args);
    else if (action === 'reject') updated = await rejectAppeal(args);
    else return res.status(400).json({ error: 'unknown_appeal_action' });

    const plain = updated.toObject ? updated.toObject() : updated;
    const [label] = await attachSubjectLabels([plain]);
    return res.json({ listing: listingProjection(plain, label, { appeal: plain.appeal || null }) });
  } catch (err) {
    return sendError(res, err);
  }
}
