/**
 * Admin Super Control Center Controller — Mission 21.
 *
 * Permission-aware handlers for the consolidated Admin Super Control Center.
 *
 * Privacy guarantees enforced here:
 *   - reporterUserId: select:false on ProfessionalReport (model level)
 *   - providerReference: select:false on CommerceTransaction, CommerceRefund
 *   - connectedAccountId: select:false on MarketplaceProviderAccount
 *   - password/tokens: select:false on User (model level)
 *   - agentNote/studentNote/meetingMetadata: explicitly excluded from consultation projection
 *   - case summary/relatedRefs: excluded from case metadata projection
 *   - integrityFlags/moderation: select:false on ProfessionalReview (model level)
 *   - No Vault content
 *   - No private messages
 *   - No Student budget plan contents
 *
 * Authorization notes:
 *   - All handlers rely on route-level requirePermission (never trust role from body)
 *   - actorId always derived from req.user (JWT), never from request body
 *   - Privileged investigation gate requires PRIVILEGED_SUPPORT + explicit audit
 */

import { asyncHandler } from '../../utils/asyncHandler.js';
import { listResponse, paginate } from '../../utils/apiResponse.js';
import { logAudit } from '../../services/auditService.js';
import { getAdminOverviewMetrics } from '../../services/admin/adminOverviewService.js';
import mongoose from 'mongoose';
import { Organization } from '../../models/Organization.js';
import { OrganizationVerification } from '../../models/OrganizationVerification.js';
import { ProfessionalReport } from '../../models/trust/ProfessionalReport.js';
import { ProfessionalDispute } from '../../models/trust/ProfessionalDispute.js';
import { ProfessionalReview } from '../../models/trust/ProfessionalReview.js';
import { Consultation } from '../../models/consultation/Consultation.js';
import { ProfessionalCase } from '../../models/case/ProfessionalCase.js';
import { CommerceReconciliation } from '../../models/commerce/CommerceOperations.js';
import { MarketplaceProviderAccount } from '../../models/commerce/MarketplaceProviderAccount.js';
import { CommerceRefund } from '../../models/commerce/CommerceRefund.js';
import { getCopilotProviderStatus } from '../../services/ai/copilotService.js';
import { hasPermission, PERMISSIONS } from '../../config/rbac.js';
import { COUNTRY_READINESS_STATES } from '../../../../shared/international/countryReadiness.js';
import { mapReconciliationOperationalState } from '../../../../shared/commerce/contracts.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

function parsePagination(query, maxLimit = 100) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

function actor(req) {
  return {
    userId: req.user?.userId,
    role: req.user?.role,
    email: req.user?.email,
  };
}

function safeMongoId(val) {
  return val && /^[a-f\d]{24}$/i.test(String(val)) ? String(val) : null;
}

function escapeRegex(val) {
  return String(val).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Overview ───────────────────────────────────────────────────────────────────

export const getOverview = asyncHandler(async (req, res) => {
  const metrics = await getAdminOverviewMetrics({ staffUserId: req.user?.userId });
  res.json(metrics);
});

// ── Organizations ─────────────────────────────────────────────────────────────

export const listOrganizations = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = {};

  if (req.query.organizationType) filter.organizationType = req.query.organizationType;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.countryCode) filter.countryCode = req.query.countryCode.toUpperCase();
  if (req.query.search) {
    const re = new RegExp(escapeRegex(req.query.search.slice(0, 100)), 'i');
    filter.$or = [{ displayName: re }, { legalName: re }];
  }

  const SAFE_SORT = new Set(['createdAt', 'displayName', 'status', 'organizationType', 'countryCode']);
  const sortField = SAFE_SORT.has(req.query.sortBy) ? req.query.sortBy : 'createdAt';
  const sortDir = req.query.sortDir === 'asc' ? 1 : -1;

  if (req.query.verificationStatus) {
    const verMatches = await OrganizationVerification.find({
      status: req.query.verificationStatus,
    }).select('organizationId').lean();
    const ids = verMatches.map((v) => v.organizationId);
    filter._id = { $in: ids };
  }

  const [items, total] = await Promise.all([
    Organization.find(filter)
      .select('_id organizationType displayName legalName slug countryCode status website createdAt updatedAt')
      .sort({ [sortField]: sortDir })
      .skip(skip)
      .limit(limit)
      .lean(),
    Organization.countDocuments(filter),
  ]);

  const orgIds = items.map((o) => o._id);
  const [verifications, claims] = await Promise.all([
    orgIds.length
      ? OrganizationVerification.find({ organizationId: { $in: orgIds } })
        .select('organizationId status submittedAt nextReviewAt riskLevel')
        .lean()
      : [],
    orgIds.length
      ? (await import('../../models/institution/InstitutionClaim.js')).InstitutionClaim.find({
        organizationId: { $in: orgIds },
      }).select('organizationId state submittedAt').sort({ submittedAt: -1 }).lean()
      : [],
  ]);
  const verByOrg = new Map(verifications.map((v) => [String(v.organizationId), v]));
  const claimByOrg = new Map();
  for (const claim of claims) {
    const key = String(claim.organizationId);
    if (!claimByOrg.has(key)) claimByOrg.set(key, claim);
  }

  const enriched = items.map((org) => {
    const ver = verByOrg.get(String(org._id));
    const claim = claimByOrg.get(String(org._id));
    return {
      ...org,
      verificationStatus: ver?.status || null,
      verificationSubmittedAt: ver?.submittedAt || null,
      canonicalClaimState: claim?.state || null,
    };
  });

  res.json(listResponse(enriched, paginate(page, limit, total)));
});

export const getOrganizationDetail = asyncHandler(async (req, res) => {
  const id = safeMongoId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid organization id' });

  const { InstitutionClaim } = await import('../../models/institution/InstitutionClaim.js');
  const [org, verification, claim] = await Promise.all([
    Organization.findById(id)
      .select('_id organizationType displayName legalName slug countryCode website officialDomain phone address status legacyEmployerId createdAt updatedAt')
      .lean(),
    OrganizationVerification.findOne({ organizationId: id })
      .select('status riskLevel riskSignals submittedAt slaDeadlineAt verifiedAt nextReviewAt profile')
      .lean(),
    InstitutionClaim.findOne({ organizationId: id })
      .select('state submittedAt canonicalInstitutionId officialDomain countryCode')
      .sort({ submittedAt: -1 })
      .lean(),
  ]);

  if (!org) return res.status(404).json({ error: 'Organization not found' });

  res.json({
    organization: org,
    verificationSummary: verification || null,
    canonicalClaimSummary: claim || null,
  });
});

// ── Trust — Reports ────────────────────────────────────────────────────────────

export const listReports = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = {};

  if (req.query.status) filter.status = req.query.status;
  if (req.query.severity) filter.severity = req.query.severity;
  if (req.query.targetType) filter.targetType = req.query.targetType;
  const orgId = safeMongoId(req.query.organizationId);
  if (orgId) filter.organizationId = orgId;

  const [items, total] = await Promise.all([
    // reporterUserId is select:false — never returned
    ProfessionalReport.find(filter)
      .select('_id targetType targetId organizationId category status severity reviewedAt resolution auditCorrelationId createdAt updatedAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ProfessionalReport.countDocuments(filter),
  ]);

  res.json(listResponse(items, paginate(page, limit, total)));
});

export const updateReport = asyncHandler(async (req, res) => {
  if (!hasPermission(req.user?.role, PERMISSIONS.TRUST_RESOLVE)) {
    return res.status(403).json({ error: 'Insufficient permissions to update reports' });
  }

  const id = safeMongoId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid report id' });

  const report = await ProfessionalReport.findById(id);
  if (!report) return res.status(404).json({ error: 'Report not found' });

  const ALLOWED_STATUS = ['triaged', 'under_review', 'needs_information', 'action_taken', 'dismissed', 'resolved', 'duplicate'];
  const { status, resolution, severity } = req.body ?? {};

  if (!req.body?.reason?.trim()) {
    return res.status(400).json({ error: 'reason is required for report updates' });
  }

  if (status && !ALLOWED_STATUS.includes(status)) {
    return res.status(400).json({ error: 'Invalid status transition' });
  }
  if (severity && !['low', 'medium', 'high', 'critical'].includes(severity)) {
    return res.status(400).json({ error: 'Invalid severity' });
  }

  const before = { status: report.status, severity: report.severity };
  if (status) report.status = status;
  if (resolution) report.resolution = String(resolution).slice(0, 1000);
  if (severity) report.severity = severity;
  if (status === 'resolved' || status === 'dismissed' || status === 'action_taken') {
    report.reviewedAt = new Date();
  }
  await report.save();

  await logAudit({
    actor: actor(req),
    action: 'admin.report.updated',
    targetType: 'ProfessionalReport',
    targetId: String(id),
    reason: req.body?.reason || '',
    before,
    after: { status: report.status, severity: report.severity },
    ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || '',
  });

  res.json({ report: { _id: report._id, status: report.status, severity: report.severity, resolution: report.resolution, reviewedAt: report.reviewedAt } });
});

// ── Trust — Disputes ────────────────────────────────────────────────────────────

export const listDisputes = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = {};

  if (req.query.status) filter.status = req.query.status;
  if (req.query.category) filter.category = req.query.category;
  const orgId = safeMongoId(req.query.organizationId);
  if (orgId) filter.organizationId = orgId;

  const [items, total] = await Promise.all([
    ProfessionalDispute.find(filter)
      .select('_id organizationId contextType contextId category status resolution createdAt updatedAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ProfessionalDispute.countDocuments(filter),
  ]);

  res.json(listResponse(items, paginate(page, limit, total)));
});

export const resolveDispute = asyncHandler(async (req, res) => {
  if (!hasPermission(req.user?.role, PERMISSIONS.TRUST_RESOLVE)) {
    return res.status(403).json({ error: 'Insufficient permissions to resolve disputes' });
  }

  const id = safeMongoId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid dispute id' });

  const dispute = await ProfessionalDispute.findById(id);
  if (!dispute) return res.status(404).json({ error: 'Dispute not found' });

  const { status, resolution, reason } = req.body ?? {};
  const RESOLVABLE = ['proposed_resolution', 'resolved', 'closed', 'dismissed'];
  if (!status || !RESOLVABLE.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${RESOLVABLE.join(', ')}` });
  }
  if (!reason?.trim()) {
    return res.status(400).json({ error: 'reason is required for dispute resolution' });
  }

  const before = { status: dispute.status };
  dispute.status = status;
  if (resolution) dispute.resolution = String(resolution).slice(0, 1500);
  dispute.events.push({
    type: `admin_${status}`,
    actorType: 'admin',
    actorId: req.user.userId,
    note: String(reason).slice(0, 500),
  });
  await dispute.save();

  await logAudit({
    actor: actor(req),
    action: 'admin.dispute.resolved',
    targetType: 'ProfessionalDispute',
    targetId: String(id),
    reason: reason || '',
    before,
    after: { status: dispute.status },
    ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || '',
  });

  res.json({ dispute: { _id: dispute._id, status: dispute.status, resolution: dispute.resolution } });
});

// ── Trust — Reviews ────────────────────────────────────────────────────────────

export const listReviews = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = {};

  if (req.query.status) filter.status = req.query.status;
  if (req.query.verifiedInteraction !== undefined) {
    filter.verifiedInteraction = req.query.verifiedInteraction === 'true';
  }
  const orgId = safeMongoId(req.query.organizationId);
  if (orgId) filter.organizationId = orgId;

  const [items, total] = await Promise.all([
    // integrityFlags and moderation details are select:false — never returned
    ProfessionalReview.find(filter)
      .select('_id organizationId interactionType rating status verifiedInteraction publishedAt createdAt updatedAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ProfessionalReview.countDocuments(filter),
  ]);

  res.json(listResponse(items, paginate(page, limit, total)));
});

// ── Consultation metadata (safe operational projection) ────────────────────────

const CONSULTATION_SAFE_FIELDS =
  '_id organizationId assignedMembershipId consultationType status requestedWindow confirmedStart durationMinutes timezone meetingMode paymentState commerceOrderId cancellation.actorType cancellation.reason cancellation.cancelledAt completion.completedAt createdAt updatedAt';

export const listConsultations = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = {};

  if (req.query.status) filter.status = req.query.status;
  if (req.query.paymentState) filter.paymentState = req.query.paymentState;
  const orgId = safeMongoId(req.query.organizationId);
  if (orgId) filter.organizationId = orgId;

  const [items, total] = await Promise.all([
    // studentNote, agentNote, meetingMetadata (link/dialIn) deliberately omitted
    Consultation.find(filter)
      .select(CONSULTATION_SAFE_FIELDS)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Consultation.countDocuments(filter),
  ]);

  res.json(listResponse(items, paginate(page, limit, total)));
});

// ── Case metadata (safe operational projection) ────────────────────────────────

const CASE_SAFE_FIELDS =
  '_id organizationId assignedMembershipId caseType workflowId lifecycle currentStage title destinationCountry openedAt closedAt outcome createdAt updatedAt';

export const listCases = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = {};

  if (req.query.lifecycle) filter.lifecycle = req.query.lifecycle;
  const orgId = safeMongoId(req.query.organizationId);
  if (orgId) filter.organizationId = orgId;

  const [items, total] = await Promise.all([
    // summary, relatedRefs, studentUserId deliberately omitted
    ProfessionalCase.find(filter)
      .select(CASE_SAFE_FIELDS)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ProfessionalCase.countDocuments(filter),
  ]);

  res.json(listResponse(items, paginate(page, limit, total)));
});

// ── Privileged Support Investigation Gate ─────────────────────────────────────

export const openPrivilegedInvestigation = asyncHandler(async (req, res) => {
  // Route-level requirePermission(PRIVILEGED_SUPPORT) already enforced.
  // Double-check here for defense-in-depth.
  if (!hasPermission(req.user?.role, PERMISSIONS.PRIVILEGED_SUPPORT)) {
    return res.status(403).json({ error: 'Privileged support access requires SuperAdmin authority' });
  }

  const { contextType, contextId, reason, purpose } = req.body ?? {};
  const ALLOWED_CONTEXT = ['report', 'dispute', 'consultation', 'case'];
  if (!contextType || !ALLOWED_CONTEXT.includes(contextType)) {
    return res.status(400).json({ error: `contextType must be one of: ${ALLOWED_CONTEXT.join(', ')}` });
  }
  const safeContextId = safeMongoId(contextId);
  if (!safeContextId) return res.status(400).json({ error: 'Invalid contextId' });
  if (!reason?.trim() || !purpose?.trim()) {
    return res.status(400).json({ error: 'reason and purpose are required for privileged investigation' });
  }

  // Audit the access grant before returning anything
  await logAudit({
    actor: actor(req),
    action: 'admin.privileged_support.investigation_opened',
    targetType: contextType,
    targetId: safeContextId,
    reason: String(reason).slice(0, 500),
    metadata: { purpose: String(purpose).slice(0, 300) },
    ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || '',
  });

  // Retrieve safe contextual metadata only — no private messages, Vault, or raw notes
  let context = null;
  if (contextType === 'report') {
    context = await ProfessionalReport.findById(safeContextId)
      .select('_id targetType targetId organizationId category status severity evidenceReferences createdAt')
      .lean();
  } else if (contextType === 'dispute') {
    context = await ProfessionalDispute.findById(safeContextId)
      .select('_id organizationId contextType contextId category status events.type events.actorType events.createdAt createdAt')
      .lean();
  } else if (contextType === 'consultation') {
    context = await Consultation.findById(safeContextId)
      .select(CONSULTATION_SAFE_FIELDS)
      .lean();
  } else if (contextType === 'case') {
    context = await ProfessionalCase.findById(safeContextId)
      .select(CASE_SAFE_FIELDS)
      .lean();
  }

  if (!context) return res.status(404).json({ error: 'Context not found' });

  res.json({
    investigationOpened: true,
    contextType,
    contextId: safeContextId,
    context,
    // Explicitly state what is NOT included
    excluded: ['private messages', 'vault documents', 'student notes', 'agent private notes', 'meeting links'],
    auditRecorded: true,
  });
});

// ── Commerce — Reconciliation ─────────────────────────────────────────────────

export const listReconciliation = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = {};

  if (req.query.status) filter.status = req.query.status;

  const [items, total] = await Promise.all([
    CommerceReconciliation.find(filter)
      .select('_id correlationId orderId transactionId expectedAmountMinor expectedCurrency actualAmountMinor actualCurrency status discrepancyReason reconciledAt createdAt updatedAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    CommerceReconciliation.countDocuments(filter),
  ]);

  res.json({
    ...listResponse(
      items.map((row) => ({
        ...row,
        operationalState: mapReconciliationOperationalState(row.status),
      })),
      paginate(page, limit, total)
    ),
    note: 'Ledger history is immutable. Admin may only mark for manual review. Mismatches are never silently repaired.',
  });
});

export const markReconciliationManualReview = asyncHandler(async (req, res) => {
  const id = safeMongoId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid reconciliation id' });

  const rec = await CommerceReconciliation.findById(id);
  if (!rec) return res.status(404).json({ error: 'Reconciliation record not found' });

  const ACTIONABLE = ['mismatch', 'pending_provider'];
  if (!ACTIONABLE.includes(rec.status)) {
    return res.status(409).json({ error: `Cannot mark manual_review from status: ${rec.status}` });
  }
  if (!req.body?.reason?.trim()) {
    return res.status(400).json({ error: 'reason is required' });
  }

  const before = { status: rec.status };
  rec.status = 'manual_review';
  rec.discrepancyReason = String(req.body.reason).slice(0, 1000);
  await rec.save();

  await logAudit({
    actor: actor(req),
    action: 'admin.reconciliation.manual_review',
    targetType: 'CommerceReconciliation',
    targetId: String(id),
    reason: req.body.reason,
    before,
    after: { status: 'manual_review' },
    ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || '',
  });

  res.json({ reconciliation: { _id: rec._id, status: rec.status, discrepancyReason: rec.discrepancyReason } });
});

// ── Commerce — Connect Accounts (safe projection) ─────────────────────────────

export const listConnectAccounts = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = {};

  if (req.query.onboardingStatus) filter.onboardingStatus = req.query.onboardingStatus;
  if (req.query.requirementsState) filter.requirementsState = req.query.requirementsState;

  const [items, total] = await Promise.all([
    // connectedAccountId is select:false — Stripe account reference never returned
    MarketplaceProviderAccount.find(filter)
      .select('_id organizationId provider accountType onboardingStatus chargesCapability transfersCapability payoutsEnabled detailsSubmitted requirementsState requirementsSummary disabledReason lastSynchronizedAt createdAt updatedAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    MarketplaceProviderAccount.countDocuments(filter),
  ]);

  res.json({
    ...listResponse(items, paginate(page, limit, total)),
    excluded: ['connectedAccountId (provider secret)', 'bank account details', 'identity documents', 'KYC raw data'],
  });
});

// ── Commerce — Refunds view (Admin read-only) ──────────────────────────────────

export const listRefunds = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = {};

  if (req.query.status) filter.status = req.query.status;
  if (req.query.currency) filter.currency = req.query.currency;

  const [items, total] = await Promise.all([
    // providerReference is select:false — never returned
    CommerceRefund.find(filter)
      .select('_id orderId originalTransactionId requesterType requesterId amountMinor currency status reason idempotencyKey createdAt updatedAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    CommerceRefund.countDocuments(filter),
  ]);

  res.json({
    ...listResponse(items, paginate(page, limit, total)),
    note: 'Admin cannot mark refund completed. Provider confirmation is authoritative.',
  });
});

// ── AI Operational Status ─────────────────────────────────────────────────────

export const getAiOpsStatus = asyncHandler(async (_req, res) => {
  const providerStatus = (() => {
    try { return getCopilotProviderStatus(); } catch { return { state: 'unknown' }; }
  })();

  res.json({
    generatedAt: new Date().toISOString(),
    source: 'CopilotModelProvider in-process config — no external provider call',
    copilot: {
      providerStatus,
      note: 'No live provider in Mission 19. Counts from AuditLog require separate query.',
    },
    excluded: [
      'individual student copilot conversations',
      'raw prompt/response bodies',
      'private copilot session contents',
    ],
  });
});

// ── System Readiness ──────────────────────────────────────────────────────────

export const getSystemReadiness = asyncHandler(async (req, res) => {
  const [
    verificationBacklog,
    reconciliationMismatches,
    brokenSources,
    refundsPending,
    missingOrganizationCountry,
  ] = await Promise.all([
    OrganizationVerification.countDocuments({
      status: { $in: ['verification_pending', 'enhanced_review'] },
    }).catch(() => null),
    CommerceReconciliation.countDocuments({ status: 'mismatch' }).catch(() => null),
    (async () => {
      const { CanonicalSource } = await import('../../models/trust/CanonicalSource.js');
      return CanonicalSource.countDocuments({ status: { $in: ['broken', 'unavailable'] } }).catch(() => null);
    })(),
    CommerceRefund.countDocuments({ status: 'requested' }).catch(() => null),
    Organization.countDocuments({ $or: [{ countryCode: null }, { countryCode: '' }] }).catch(() => null),
  ]);

  const aiProvider = (() => {
    try { return getCopilotProviderStatus(); } catch { return { state: 'unknown' }; }
  })();

  const dbState = mongoose.connection.readyState === 1
    ? 'ready_for_internal_testing'
    : mongoose.connection.readyState === 2
      ? 'attention_required'
      : 'unavailable';

  res.json({
    generatedAt: new Date().toISOString(),
    source: 'Persisted domain data + in-process config — no external provider calls',
    certification: false,
    components: {
      api: { status: 'ready_for_internal_testing', note: 'This handler executed.' },
      db: { status: dbState, note: 'Derived from mongoose connection readyState. No credentials exposed.' },
      redis: { status: 'attention_required', note: 'Not probed from this surface to avoid secret exposure.' },
      worker: { status: 'unavailable', note: 'Worker remains stopped. Queued jobs are not processed.' },
      email: {
        status: 'configured_delivery_stopped',
        note: 'SMTP may be configured, but delivery is not enabled and the worker is stopped. No email is sent.',
      },
      notifications: { status: 'ready_for_internal_testing', note: 'In-app UserNotification reconciliation. Worker not required for in-app write.' },
      indexes: { status: 'attention_required', note: 'Controlled index provisioning is operational, not certified here.' },
      payments: { status: 'not_configured', note: 'No live Stripe calls from Admin in this phase.' },
      storage: { status: 'attention_required', note: 'Storage credentials are never exposed on this surface.' },
      verifiedData: { status: 'attention_required', note: 'Verified-data launch dry-run is not production certification.' },
      monitoring: { status: 'attention_required', note: 'See Platform Health for infrastructure signals.' },
    },
    queues: {
      verificationBacklog,
      reconciliationMismatches,
      brokenSources,
      refundsPending,
      missingOrganizationCountry,
    },
    ai: {
      copilotProvider: aiProvider,
    },
    internationalReadiness: {
      semantics: Object.values(COUNTRY_READINESS_STATES),
      productionReadyInferred: false,
      note: 'Country readiness requires explicit policy, data, currency, provider, and freshness evidence.',
      diagnosticsAreReadOnly: true,
    },
    notes: [
      'No .env values are read or exposed here.',
      'No external provider calls are made.',
      'For infrastructure health see /admin/platform-health.',
    ],
    excluded: [
      'secrets',
      'environment variable values',
      'Stripe keys',
      'database credentials',
    ],
  });
});

// ── Risk Signals ──────────────────────────────────────────────────────────────

export const getRiskSignals = asyncHandler(async (req, res) => {
  const orgId = safeMongoId(req.query.organizationId);
  if (!orgId) return res.status(400).json({ error: 'organizationId is required' });

  const [verification, reports, disputes, reconciliationMismatches] = await Promise.all([
    OrganizationVerification.findOne({ organizationId: orgId })
      .select('status riskLevel riskSignals')
      .lean()
      .catch(() => null),
    ProfessionalReport.countDocuments({
      organizationId: orgId,
      status: { $nin: ['dismissed', 'duplicate'] },
    }).catch(() => 0),
    ProfessionalDispute.countDocuments({
      organizationId: orgId,
      status: { $nin: ['closed', 'dismissed'] },
    }).catch(() => 0),
    CommerceReconciliation.countDocuments({ status: 'mismatch' }).catch(() => 0),
  ]);

  const signals = [];
  if (verification?.riskLevel === 'high' || verification?.riskLevel === 'critical') {
    signals.push({ signal: 'verification_risk', level: verification.riskLevel, source: 'OrganizationVerification' });
  }
  if (verification?.status === 'enhanced_review') {
    signals.push({ signal: 'enhanced_verification_review', source: 'OrganizationVerification' });
  }
  if (reports > 0) {
    signals.push({ signal: 'open_reports', count: reports, source: 'ProfessionalReport' });
  }
  if (disputes > 0) {
    signals.push({ signal: 'open_disputes', count: disputes, source: 'ProfessionalDispute' });
  }
  if (reconciliationMismatches > 0) {
    signals.push({ signal: 'reconciliation_mismatches', count: reconciliationMismatches, source: 'CommerceReconciliation' });
  }

  const derivedRisk = signals.length === 0 ? 'none'
    : signals.some(s => s.level === 'critical') ? 'critical'
    : signals.some(s => s.level === 'high') ? 'high'
    : signals.length >= 3 ? 'elevated'
    : 'low';

  res.json({
    organizationId: orgId,
    generatedAt: new Date().toISOString(),
    derivedRisk,
    derivedRiskBasis: 'deterministic from explicit signals — not AI-generated',
    signals,
  });
});
