/**
 * Agent portal controller — profile, services, team, leads, dashboard (Mission 11).
 *
 * All routes require Agent realm authentication (req.agent).
 * No User or Employer realm can invoke these mutations.
 *
 * VAULT: Agent auth alone grants zero Vault access.
 * Even an approved agent with a lead relationship has zero Vault access
 * without an explicit DocumentAccessGrant from Mission 10.
 */
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  getProfileByAccountId,
  updateProfile,
  getProfileCompleteness,
  advanceOnboardingStep,
  getVerificationStatus,
  getTrustBadges,
  assertApprovedVerification,
  createService,
  updateService,
  getServices,
  getOrgMembers,
  updateMemberRole,
  updateMemberStatus,
  updateMemberDomainAccess,
  getLeads,
  updateLeadStatus,
  getPublicProfileBySlug,
  getPublicDirectory,
  listOrganizationInvites,
  createOrganizationInvite,
  previewOrganizationInvite,
  acceptOrganizationInvite,
  revokeOrganizationInvite,
  listClientsForAgent,
} from '../services/agentProfileService.js';
import { canExercisePrivilegedCapability } from '../../../shared/international/verification.js';
import { resolveCredentialPolicy } from '../services/credentialPolicyService.js';
import { resolveVerificationSources } from '../../../shared/agent/verificationSources.js';
import { marketplaceCounts } from '../services/agentMarketplaceService.js';
import { AgentAvailability } from '../models/consultation/AgentAvailability.js';
import { providerReadiness } from '../services/marketplacePaymentService.js';
import { marketplaceStripeConfiguration } from '../services/payments/StripeConnectProvider.js';
import { getCommissionPolicy } from '../../../shared/commerce/contracts.js';
import { Consultation } from '../models/consultation/Consultation.js';
import { ConsultationThread } from '../models/consultation/ConsultationThread.js';
import { ConsultationMessage } from '../models/consultation/ConsultationMessage.js';
import { ProfessionalCase } from '../models/case/ProfessionalCase.js';
import { CaseThread, CaseMessage, CaseApprovalRequest, CaseTask, CaseDocumentRequest } from '../models/case/CaseRecords.js';
import { ProfessionalCaseApplication } from '../models/case/ProfessionalCaseApplication.js';
import { AgentLead } from '../models/agent/AgentLead.js';
import { AgentService } from '../models/agent/AgentService.js';
import { AgentMembership } from '../models/agent/AgentMembership.js';
import { Organization } from '../models/Organization.js';
import { MarketplaceProviderAccount } from '../models/commerce/MarketplaceProviderAccount.js';
import { CommerceOrder } from '../models/commerce/CommerceOrder.js';
import { CommerceTransaction } from '../models/commerce/CommerceTransaction.js';
import { CommerceRefund } from '../models/commerce/CommerceRefund.js';
import { CommercePayoutReadiness } from '../models/commerce/CommerceOperations.js';
import { UserNotification } from '../models/UserNotification.js';
import { DocumentAccessGrant } from '../models/vault/DocumentAccessGrant.js';
import { AgentAccount } from '../models/agent/AgentAccount.js';

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export const getDashboard = asyncHandler(async (req, res) => {
  const { agentAccountId } = req.agent;

  const profile = await getProfileByAccountId(agentAccountId).catch(() => null);
  if (!profile) {
    return res.status(200).json({
      onboarding: true,
      message: 'Complete your onboarding to access the dashboard.',
    });
  }

  const membership = await AgentMembership.findOne({
    agentAccountId,
    organizationId: profile.organizationId,
    active: true,
  }).lean();

  const verificationStatus = await getVerificationStatus(profile.organizationId);
  const isApproved = canExercisePrivilegedCapability(verificationStatus);
  const orgFilter = { organizationId: profile.organizationId };

  const [
    marketplace,
    consultationCounts,
    leadsCount,
    clientsSnapshot,
    servicesActive,
    casesActive,
    pendingApprovals,
    unreadMessages,
    unreadNotifications,
    providerAccount,
    payoutReadiness,
    availabilityDoc,
  ] = await Promise.all([
    marketplaceCounts(agentAccountId),
    Consultation.aggregate([
      { $match: orgFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    AgentLead.countDocuments(orgFilter),
    listClientsForAgent(agentAccountId, { page: 1, limit: 1 }).catch(() => ({ total: 0 })),
    AgentService.countDocuments({ ...orgFilter, status: 'active' }),
    ProfessionalCase.countDocuments({
      ...orgFilter,
      lifecycle: { $in: ['awaiting_student_acceptance', 'active'] },
      ...(membership ? { authorizedMembershipIds: membership._id } : {}),
    }),
    membership
      ? CaseApprovalRequest.countDocuments({
        status: 'pending',
        caseId: { $in: await ProfessionalCase.find({ ...orgFilter, authorizedMembershipIds: membership._id }).distinct('_id') },
      }).catch(() => 0)
      : 0,
    (async () => {
      if (!membership) return 0;
      const threads = await ConsultationThread.find({
        organizationId: profile.organizationId,
        authorizedMembershipIds: membership._id,
      }).select('_id').lean();
      if (!threads.length) return 0;
      const actorKey = `agent:${membership._id}`;
      return ConsultationMessage.countDocuments({
        threadId: { $in: threads.map((t) => t._id) },
        senderActorType: { $ne: 'agent' },
        'readBy.actorKey': { $ne: actorKey },
      });
    })(),
    UserNotification.countDocuments({
      recipientType: 'agent',
      agentAccountId,
      read: false,
    }),
    MarketplaceProviderAccount.findOne(orgFilter).lean(),
    CommercePayoutReadiness.findOne(orgFilter).lean(),
    membership
      ? AgentAvailability.findOne({
        membershipId: membership._id,
        organizationId: profile.organizationId,
        active: true,
      }).select('windows').lean()
      : null,
  ]);

  const hasAvailability = Boolean(
    availabilityDoc
    && Array.isArray(availabilityDoc.windows)
    && availabilityDoc.windows.length > 0
  );

  const consultations = Object.fromEntries(consultationCounts.map((item) => [item._id, item.count]));
  const attentionCaseMatch = membership ? {
    organizationId: profile.organizationId,
    authorizedMembershipIds: membership._id,
    lifecycle: { $in: ['awaiting_student_acceptance', 'active'] },
  } : null;
  const attentionCases = attentionCaseMatch
    ? await ProfessionalCase.find(attentionCaseMatch).sort({ updatedAt: -1, _id: -1 }).limit(50).select('_id').lean()
    : [];
  const attentionCaseIds = attentionCases.map((row) => row._id);
  const [attentionTasks, attentionApplications, attentionDocuments] = attentionCaseIds.length ? await Promise.all([
    CaseTask.find({ caseId: { $in: attentionCaseIds }, responsibleActor: 'agent', status: { $in: ['pending', 'in_progress'] } })
      .sort({ dueAt: 1, createdAt: -1, _id: -1 }).limit(5).select('caseId title dueAt status').lean(),
    ProfessionalCaseApplication.find({ caseId: { $in: attentionCaseIds }, status: { $in: ['preparing', 'ready_for_review', 'needs_changes'] } })
      .sort({ deadlineAt: 1, updatedAt: -1, _id: -1 }).limit(5).select('caseId institutionSnapshot programSnapshot status deadlineAt').lean(),
    CaseDocumentRequest.find({ caseId: { $in: attentionCaseIds }, status: { $in: ['requested', 'available'] } })
      .sort({ dueAt: 1, createdAt: -1, _id: -1 }).limit(5).select('caseId documentType dueAt status').lean(),
  ]) : [[], [], []];
  const providerState = marketplaceStripeConfiguration();
  const readiness = providerReadiness(providerAccount, isApproved);

  return res.status(200).json({
    onboarding: !profile.onboardingCompletedAt,
    onboardingStep: profile.onboardingStep,
    agentType: profile.agentType,
    profileCompleteness: profile.completenessScore,
    verificationStatus,
    isApproved,
    cards: {
      verification: { value: verificationStatus, source: 'GET /api/agent/verification → OrganizationVerification.status', href: '/agent/education/verification' },
      profileCompleteness: { value: profile.completenessScore || 0, source: 'AgentProfile.completenessScore', href: '/agent/education/profile' },
      activeServices: { value: servicesActive, source: 'AgentService count status=active', href: '/agent/education/services' },
      marketplacePosts: { value: marketplace.publiclyEligible ?? marketplace.approved ?? 0, source: 'agentMarketplaceService.marketplaceCounts publiclyEligible', href: '/agent/education/marketplace' },
      hasAvailability: { value: hasAvailability, source: 'AgentAvailability windows for current membership', href: '/agent/education/availability' },
      newLeads: { value: leadsCount, source: 'AgentLead count by organizationId', href: '/agent/education/leads' },
      upcomingConsultations: { value: consultations.confirmed || 0, source: 'Consultation aggregate status=confirmed', href: '/agent/education/consultations' },
      activeCases: { value: casesActive, source: 'ProfessionalCase lifecycle in awaiting_student_acceptance|active', href: '/agent/education/cases' },
      pendingStudentApprovals: { value: pendingApprovals || 0, source: 'CaseApprovalRequest status=pending', href: '/agent/education/cases' },
      unreadMessages: { value: unreadMessages || 0, source: 'ConsultationMessage unread for membership', href: '/agent/education/messages' },
      unreadNotifications: { value: unreadNotifications || 0, source: 'UserNotification recipientType=agent read=false', href: '/agent/education/notifications' },
      commerceReadiness: {
        value: readiness.ready ? 'ready' : (providerState === 'not_configured' ? 'not_configured' : readiness.providerKycStatus || 'not started'),
        source: 'MarketplaceProviderAccount + marketplaceStripeConfiguration (no live Stripe)',
        href: '/agent/commerce',
      },
      usageBilling: {
        value: providerState === 'not_configured' ? 'not_configured' : 'configured',
        source: 'GET /api/agent/usage-billing',
        href: '/agent/usage-billing',
      },
    },
    leadsCount,
    clientsCount: clientsSnapshot.total || 0,
    consultationsCount: Object.values(consultations).reduce((sum, value) => sum + value, 0),
    casesCount: casesActive,
    earningsTotal: 0,
    earningsNote: 'No wallet. Payout balances are provider-authoritative only when configured.',
    comingSoon: [],
    consultations: {
      incoming: (consultations.requested || 0) + (consultations.pending_confirmation || 0),
      upcoming: consultations.confirmed || 0,
      history: (consultations.completed || 0) + (consultations.cancelled || 0) + (consultations.declined || 0) + (consultations.no_show || 0),
    },
    marketplace: {
      drafts: marketplace.not_submitted || 0,
      pendingReview: (marketplace.pending || 0) + (marketplace.under_review || 0),
      published: marketplace.approved || 0,
      needsChanges: marketplace.needs_changes || 0,
    },
    attention: {
      limit: 5,
      providerTasks: attentionTasks.map((row) => ({ id: String(row._id), caseId: String(row.caseId), title: row.title, status: row.status, dueAt: row.dueAt })),
      applications: attentionApplications.map((row) => ({ id: String(row._id), caseId: String(row.caseId), title: row.programSnapshot?.name || row.institutionSnapshot?.officialName || 'Education application', status: row.status, dueAt: row.deadlineAt })),
      documentRequests: attentionDocuments.map((row) => ({ id: String(row._id), caseId: String(row.caseId), title: row.documentType, status: row.status, dueAt: row.dueAt })),
      unreadMessages: unreadMessages || 0,
    },
    commerce: {
      providerState,
      kycState: readiness.providerKycStatus || 'not_started',
      chargesCapability: readiness.chargesCapability,
      transfersCapability: readiness.transfersCapability,
      payoutState: payoutReadiness?.payoutState || (readiness.payoutsEnabled ? 'eligible_future' : 'pending_kyc'),
    },
  });
});

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export const getProfile = asyncHandler(async (req, res) => {
  const profile = await getProfileByAccountId(req.agent.agentAccountId);
  const organization = await Organization.findById(profile.organizationId)
    .select('legalName displayName organizationType countryCode website phone')
    .lean();
  return res.status(200).json({
    profile,
    organization: organization || null,
    accountType: profile.agentType === 'agency' ? 'agency' : 'professional',
    identityNote: profile.agentType === 'agency'
      ? 'Agency / organization identity. Legal entity fields apply.'
      : 'Individual professional identity. A company registration number is not forced where it is not applicable.',
  });
});

export const patchProfile = asyncHandler(async (req, res) => {
  const profile = await updateProfile(req.agent.agentAccountId, req.body);
  return res.status(200).json({ profile });
});

export const getCompleteness = asyncHandler(async (req, res) => {
  const completeness = await getProfileCompleteness(req.agent.agentAccountId);
  return res.status(200).json({ completeness });
});

// ---------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------

export const submitOnboardingStep = asyncHandler(async (req, res) => {
  const { step, skip } = req.body || {};
  const profile = await advanceOnboardingStep(req.agent.agentAccountId, step, { skip: Boolean(skip) });
  return res.status(200).json({ profile });
});

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

export const getVerification = asyncHandler(async (req, res) => {
  const profile = await getProfileByAccountId(req.agent.agentAccountId);
  const status = await getVerificationStatus(profile.organizationId);
  const badges = await getTrustBadges(profile.organizationId);

  const org = await Organization.findById(profile.organizationId)
    .select('organizationType countryCode legalName displayName')
    .lean();
  const credentialPolicy = resolveCredentialPolicy({
    organizationType: org?.organizationType || profile.agentType,
    countryCode: org?.countryCode || profile.countryCode,
  });
  const sources = resolveVerificationSources({
    countryCode: org?.countryCode || profile.countryCode,
    organizationType: org?.organizationType || profile.agentType,
  });

  return res.status(200).json({
    organizationId: profile.organizationId,
    agentType: profile.agentType,
    accountType: profile.agentType === 'agency' ? 'agency' : 'professional',
    verificationStatus: status,
    isApproved: canExercisePrivilegedCapability(status),
    trustBadges: badges,
    credentialPolicy,
    verificationSources: sources,
    mapsSupportingOnly: true,
    mapsCannotAloneResultInVerified: true,
    selfApprovalDenied: true,
    note: 'Verification is managed through the organization verification system. Registration or license numbers alone are not proof. Maps/Business is supporting evidence only.',
  });
});

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------

export const listServices = asyncHandler(async (req, res) => {
  return res.status(200).json(await getServices(req.agent.agentAccountId, req.query));
});

export const addService = asyncHandler(async (req, res) => {
  const service = await createService(req.agent.agentAccountId, req.body);
  return res.status(201).json({ service });
});

export const editService = asyncHandler(async (req, res) => {
  const service = await updateService(req.agent.agentAccountId, req.params.serviceId, req.body);
  return res.status(200).json({ service });
});

// ---------------------------------------------------------------------------
// Team (Agency only)
// ---------------------------------------------------------------------------

export const listTeamMembers = asyncHandler(async (req, res) => {
  return res.status(200).json(await getOrgMembers(req.agent.agentAccountId, req.query));
});

export const changeMemberRole = asyncHandler(async (req, res) => {
  const { targetAgentAccountId, role } = req.body || {};
  if (!targetAgentAccountId || !role) {
    return res.status(400).json({ error: 'targetAgentAccountId and role are required' });
  }
  const updated = await updateMemberRole(req.agent.agentAccountId, targetAgentAccountId, role);
  return res.status(200).json({ membership: updated });
});

export const changeMemberStatus = asyncHandler(async (req, res) => {
  const { targetAgentAccountId, active } = req.body || {};
  if (!targetAgentAccountId || typeof active !== 'boolean') {
    return res.status(400).json({ error: 'targetAgentAccountId and boolean active are required' });
  }
  const updated = await updateMemberStatus(req.agent.agentAccountId, targetAgentAccountId, active);
  return res.status(200).json({ membership: updated });
});

export const changeMemberDomainAccess = asyncHandler(async (req, res) => {
  try {
    const updated = await updateMemberDomainAccess({
      agentAccountId: req.agent.agentAccountId,
      targetAgentAccountId: req.body?.targetAgentAccountId,
      domainAccess: req.body?.domainAccess,
      expectedVersion: req.body?.expectedVersion,
    });
    return res.status(200).json({ membership: updated });
  } catch (err) {
    return inviteError(res, err);
  }
});

// ---------------------------------------------------------------------------
// Leads (foundation — Mission 12+ will expand)
// ---------------------------------------------------------------------------

export const listLeads = asyncHandler(async (req, res) => {
  const result = await getLeads(req.agent.agentAccountId, req.query);
  return res.status(200).json({
    ...result,
    note: 'Leads arise only through explicit user actions. Agent cannot browse all users.',
  });
});

export const patchLeadStatus = asyncHandler(async (req, res) => {
  const { status } = req.body || {};
  if (!status) return res.status(400).json({ error: 'status is required' });
  const lead = await updateLeadStatus(req.agent.agentAccountId, req.params.leadId, status);
  return res.status(200).json({ lead });
});

// Clients — relationship foundation only; no Student profile exposure
export const listClients = asyncHandler(async (req, res) => {
  const result = await listClientsForAgent(req.agent.agentAccountId, req.query);
  return res.status(200).json(result);
});

export const getVerificationSources = asyncHandler(async (req, res) => {
  const profile = await getProfileByAccountId(req.agent.agentAccountId);
  const org = await Organization.findById(profile.organizationId).select('organizationType countryCode').lean();
  const countryCode = req.query.countryCode || org?.countryCode || profile.countryCode;
  const organizationType = req.query.organizationType || org?.organizationType || profile.agentType;
  const sources = resolveVerificationSources({ countryCode, organizationType });
  const credentialPolicy = resolveCredentialPolicy({ organizationType, countryCode });
  return res.status(200).json({ ...sources, credentialPolicy });
});

export const getUsageBilling = asyncHandler(async (req, res) => {
  const profile = await getProfileByAccountId(req.agent.agentAccountId);
  const orgFilter = { organizationId: profile.organizationId };
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const providerState = marketplaceStripeConfiguration();
  const [services, marketplace, account, orders, transactions, refunds, payout] = await Promise.all([
    AgentService.countDocuments(orgFilter),
    marketplaceCounts(req.agent.agentAccountId),
    MarketplaceProviderAccount.findOne(orgFilter).lean(),
    CommerceOrder.find({ sellerOrganizationId: profile.organizationId })
      .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)
      .select('orderNumber status amountMinor currency createdAt paymentAvailability')
      .lean(),
    CommerceTransaction.find({ 'payee.ownerType': 'organization', 'payee.ownerId': profile.organizationId })
      .sort({ createdAt: -1 }).limit(limit)
      .select('type status amountMinor currency createdAt providerReference')
      .lean(),
    CommerceRefund.find({ orderId: { $in: await CommerceOrder.find({ sellerOrganizationId: profile.organizationId }).distinct('_id') } })
      .sort({ createdAt: -1 }).limit(limit).select('status amountMinor currency createdAt orderId').lean(),
    CommercePayoutReadiness.findOne(orgFilter).lean(),
  ]);
  const verificationStatus = await getVerificationStatus(profile.organizationId);
  const readiness = providerReadiness(account, canExercisePrivilegedCapability(verificationStatus));
  return res.status(200).json({
    policy: {
      code: 'configured_only',
      note: 'No invented commercial pricing. Only actual configured policy is shown.',
    },
    commission: getCommissionPolicy(), // Commission not configured unless an approved policy exists
    provider: {
      configured: providerState !== 'not_configured',
      state: providerState,
    },
    kyc: {
      state: readiness.providerKycStatus || 'not_started',
      chargesCapability: readiness.chargesCapability,
      transfersCapability: readiness.transfersCapability,
      payoutsEnabled: readiness.payoutsEnabled,
      ready: readiness.ready,
    },
    payout: {
      state: payout?.payoutState || (readiness.payoutsEnabled ? 'eligible_future' : 'not_configured'),
      note: 'Payout paid is provider-authoritative only. Agents cannot mark payout paid.',
    },
    usage: {
      activeServices: services,
      marketplaceDrafts: marketplace.not_submitted || 0,
      marketplacePublished: marketplace.approved || 0,
      marketplacePendingReview: (marketplace.pending || 0) + (marketplace.under_review || 0),
    },
    orders,
    transactions: transactions.map((tx) => ({
      _id: tx._id,
      type: tx.type,
      status: tx.status,
      amountMinor: tx.amountMinor,
      currency: tx.currency,
      createdAt: tx.createdAt,
    })),
    refunds: refunds.map((r) => ({
      _id: r._id,
      status: r.status,
      amountMinor: r.amountMinor,
      currency: r.currency,
      createdAt: r.createdAt,
    })),
    wallet: { present: false, note: 'No fake wallet. No homemade escrow.' },
    pagination: { page, limit },
  });
});

export const getCommerceReadiness = asyncHandler(async (req, res) => {
  const profile = await getProfileByAccountId(req.agent.agentAccountId);
  const providerState = marketplaceStripeConfiguration();
  const account = await MarketplaceProviderAccount.findOne({ organizationId: profile.organizationId }).lean();
  const verificationStatus = await getVerificationStatus(profile.organizationId);
  const readiness = providerReadiness(account, canExercisePrivilegedCapability(verificationStatus));
  const payout = await CommercePayoutReadiness.findOne({ organizationId: profile.organizationId }).lean();
  return res.status(200).json({
    providerState,
    ...readiness,
    payoutState: payout?.payoutState || (readiness.payoutsEnabled ? 'eligible_future' : 'pending_kyc'),
    liveStripeCalled: false,
    secretsExposed: false,
  });
});

export const listMessageHub = asyncHandler(async (req, res) => {
  const profile = await getProfileByAccountId(req.agent.agentAccountId);
  const membership = await AgentMembership.findOne({
    agentAccountId: req.agent.agentAccountId,
    organizationId: profile.organizationId,
    active: true,
  }).lean();
  if (!membership) return res.status(403).json({ error: 'Organization membership is inactive' });
  const actorKey = `agent:${membership._id}`;
  const [consultThreads, caseThreads] = await Promise.all([
    ConsultationThread.find({ organizationId: profile.organizationId, authorizedMembershipIds: membership._id })
      .sort({ updatedAt: -1 }).limit(50).lean(),
    CaseThread.find({ organizationId: profile.organizationId, authorizedMembershipIds: membership._id })
      .sort({ updatedAt: -1 }).limit(50).lean(),
  ]);
  const consultItems = await Promise.all(consultThreads.map(async (thread) => {
    const unread = await ConsultationMessage.countDocuments({
      threadId: thread._id,
      senderActorType: { $ne: 'agent' },
      'readBy.actorKey': { $ne: actorKey },
    });
    return {
      context: 'consultation',
      threadId: String(thread._id),
      consultationId: String(thread.consultationId),
      href: `/agent/education/consultations/${thread.consultationId}`,
      status: thread.status,
      unread,
      updatedAt: thread.updatedAt,
    };
  }));
  const caseItems = await Promise.all(caseThreads.map(async (thread) => {
    const last = await CaseMessage.findOne({ threadId: thread._id }).sort({ createdAt: -1 }).lean();
    return {
      context: 'case',
      threadId: String(thread._id),
      caseId: String(thread.caseId),
      href: `/agent/education/cases/${thread.caseId}`,
      status: thread.status,
      unread: last && last.senderActorType === 'student' ? 1 : 0,
      updatedAt: thread.updatedAt,
    };
  }));
  const threads = [...consultItems, ...caseItems].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  const unreadTotal = threads.reduce((sum, row) => sum + (row.unread || 0), 0);
  return res.status(200).json({
    threads,
    unreadTotal,
    note: 'Contextual messaging only. No universal DM. Participants are server-derived.',
  });
});

export const listVaultGrants = asyncHandler(async (req, res) => {
  const profile = await getProfileByAccountId(req.agent.agentAccountId);
  const membership = await AgentMembership.findOne({
    agentAccountId: req.agent.agentAccountId,
    organizationId: profile.organizationId,
    active: true,
  }).lean();
  if (!membership) return res.status(403).json({ error: 'Organization membership is inactive' });
  const grants = await DocumentAccessGrant.find({
    granteeType: 'agent',
    granteeId: String(membership._id),
  }).select('documentId purpose caseRef consultationRef permissions status expiresAt revokedAt createdAt').lean();
  return res.status(200).json({
    grants: grants.map((g) => ({
      grantId: g._id,
      documentId: g.documentId,
      purpose: g.purpose,
      caseRef: g.caseRef,
      consultationRef: g.consultationRef,
      permissions: g.permissions,
      status: g.status,
      expiresAt: g.expiresAt,
      revoked: Boolean(g.revokedAt) || g.status === 'revoked',
      expired: Boolean(g.expiresAt && new Date(g.expiresAt) < new Date()),
    })),
    note: 'Client, consultation, and case relationships grant zero Vault access without an exact active grant. Storage keys and public URLs are never returned.',
  });
});

function inviteError(res, err) {
  return res.status(err.status || 500).json({ error: err.message, code: err.code });
}

export const listInvites = asyncHandler(async (req, res) => {
  try {
    const invites = await listOrganizationInvites(req.agent.agentAccountId);
    return res.status(200).json({ data: invites });
  } catch (err) {
    return inviteError(res, err);
  }
});

export const createInvite = asyncHandler(async (req, res) => {
  try {
    const result = await createOrganizationInvite({
      agentAccountId: req.agent.agentAccountId,
      email: req.body?.email,
      role: req.body?.role,
      domainAccess: req.body?.domainAccess,
    });
    return res.status(201).json(result);
  } catch (err) {
    return inviteError(res, err);
  }
});

export const revokeInvite = asyncHandler(async (req, res) => {
  try {
    const result = await revokeOrganizationInvite({
      agentAccountId: req.agent.agentAccountId,
      invitationId: req.params.invitationId,
    });
    return res.status(200).json(result);
  } catch (err) {
    return inviteError(res, err);
  }
});

export const previewInvite = asyncHandler(async (req, res) => {
  try {
    const result = await previewOrganizationInvite(req.query.token);
    return res.status(200).json(result);
  } catch (err) {
    return inviteError(res, err);
  }
});

export const acceptInvite = asyncHandler(async (req, res) => {
  try {
    const account = await AgentAccount.findById(req.agent.agentAccountId).select('email');
    const result = await acceptOrganizationInvite({
      token: req.body?.token,
      agentAccount: account,
      acceptedDomainIds: req.body?.acceptedDomainIds,
    });
    return res.status(200).json(result);
  } catch (err) {
    return inviteError(res, err);
  }
});

// ---------------------------------------------------------------------------
// Public profile (approved-only, no auth required)
// ---------------------------------------------------------------------------

export const getPublicProfile = asyncHandler(async (req, res) => {
  const profile = await getPublicProfileBySlug(req.params.slug);
  return res.status(200).json({ profile });
});

// Public directory
export const listPublicAgents = asyncHandler(async (req, res) => {
  const {
    agentType,
    countryCode,
    destinationCountry,
    language,
    serviceCategory,
    page,
    limit,
  } = req.query;

  const result = await getPublicDirectory({
    agentType,
    countryCode,
    destinationCountry,
    language,
    serviceCategory,
    page,
    limit,
  });

  return res.status(200).json(result);
});

// ---------------------------------------------------------------------------
// Privileged capability guard example
// ---------------------------------------------------------------------------

export const checkPrivilegedAccess = asyncHandler(async (req, res) => {
  const profile = await getProfileByAccountId(req.agent.agentAccountId);
  await assertApprovedVerification(profile.organizationId);
  return res.status(200).json({ privileged: true });
});
