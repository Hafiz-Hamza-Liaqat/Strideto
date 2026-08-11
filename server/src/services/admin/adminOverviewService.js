/**
 * AdminOverviewService — Mission 21.
 *
 * Aggregates safe operational counts from domain models for the Admin
 * Super Control Center overview dashboard.
 *
 * Rules:
 *   - countDocuments only — no unbounded collection loads
 *   - No private message/Vault/note contents
 *   - No fake metrics, no trend fabrication
 *   - Every metric annotated with source, scope, and generatedAt
 *   - AI provider status from in-process config — no external call
 */

import { User } from '../../models/User.js';
import { Organization } from '../../models/Organization.js';
import { OrganizationVerification } from '../../models/OrganizationVerification.js';
import { AuditLog } from '../../models/AuditLog.js';
import { AgentMarketplacePost } from '../../models/agent/AgentMarketplacePost.js';
import { Consultation } from '../../models/consultation/Consultation.js';
import { ProfessionalCase } from '../../models/case/ProfessionalCase.js';
import { ProfessionalReport } from '../../models/trust/ProfessionalReport.js';
import { ProfessionalDispute } from '../../models/trust/ProfessionalDispute.js';
import { CommerceRefund } from '../../models/commerce/CommerceRefund.js';
import { CommerceReconciliation } from '../../models/commerce/CommerceOperations.js';
import { InstitutionClaim } from '../../models/institution/InstitutionClaim.js';
import { InstitutionDataConflict } from '../../models/institution/InstitutionDataConflict.js';
import { FactProvenance } from '../../models/trust/FactProvenance.js';
import { CanonicalSource } from '../../models/trust/CanonicalSource.js';
import { getCopilotProviderStatus } from '../ai/copilotService.js';
import { UserNotification } from '../../models/UserNotification.js';

async function safeCount(fn) {
  try {
    return await fn();
  } catch {
    return null;
  }
}

export async function getAdminOverviewMetrics({ staffUserId } = {}) {
  const generatedAt = new Date().toISOString();

  const [
    totalStudents,
    activeStudents,
    suspendedStudents,
    totalOrganizations,
    verificationPending,
    verificationNeedsInfo,
    verificationEnhancedReview,
    verificationUnderReview,
    openReports,
    openDisputes,
    activeConsultations,
    activeCases,
    refundRequests,
    reconciliationMismatches,
    institutionClaimsPending,
    marketplacePending,
    staleFacts,
    reviewDueFacts,
    brokenSources,
    openConflicts,
    unreadStaffNotifications,
    recentAudit,
  ] = await Promise.all([
    safeCount(() => User.countDocuments({ role: 'User' })),
    safeCount(() => User.countDocuments({ role: 'User', accountStatus: 'active' })),
    safeCount(() => User.countDocuments({ role: 'User', accountStatus: 'suspended' })),
    safeCount(() => Organization.countDocuments()),
    safeCount(() => OrganizationVerification.countDocuments({ status: 'verification_pending' })),
    safeCount(() => OrganizationVerification.countDocuments({ status: 'needs_information' })),
    safeCount(() => OrganizationVerification.countDocuments({ status: 'enhanced_review' })),
    safeCount(() => OrganizationVerification.countDocuments({ status: 'under_review' })),
    safeCount(() => ProfessionalReport.countDocuments({
      status: { $in: ['submitted', 'triaged', 'under_review'] },
    })),
    safeCount(() => ProfessionalDispute.countDocuments({
      status: { $in: ['opened', 'awaiting_response', 'under_review', 'escalated'] },
    })),
    safeCount(() => Consultation.countDocuments({
      status: { $in: ['requested', 'confirmed', 'pending_confirmation'] },
    })),
    safeCount(() => ProfessionalCase.countDocuments({
      lifecycle: { $in: ['awaiting_student_acceptance', 'active', 'paused'] },
    })),
    safeCount(() => CommerceRefund.countDocuments({ status: 'requested' })),
    safeCount(() => CommerceReconciliation.countDocuments({ status: 'mismatch' })),
    safeCount(() => InstitutionClaim.countDocuments({
      state: { $in: ['submitted', 'under_review'] },
    })),
    safeCount(() => AgentMarketplacePost.countDocuments({
      moderationStatus: { $in: ['pending', 'under_review'] },
    })),
    safeCount(() => FactProvenance.countDocuments({ freshnessState: 'stale' })),
    safeCount(() => FactProvenance.countDocuments({ freshnessState: 'review_due' })),
    safeCount(() => CanonicalSource.countDocuments({
      status: { $in: ['broken', 'unavailable'] },
    })),
    safeCount(() => InstitutionDataConflict.countDocuments({ state: 'open' })),
    staffUserId
      ? safeCount(() => UserNotification.countDocuments({
        recipientType: 'staff',
        userId: staffUserId,
        read: false,
      }))
      : Promise.resolve(null),
    AuditLog.find()
      .select('actorEmail actorRole action targetType targetLabel status createdAt')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean()
      .catch(() => []),
  ]);

  const aiProviderStatus = (() => {
    try {
      return getCopilotProviderStatus();
    } catch {
      return { state: 'unknown' };
    }
  })();

  return {
    generatedAt,
    scope: 'platform-wide operational counts',
    users: {
      source: 'User collection',
      totalStudents,
      activeStudents,
      suspendedStudents,
    },
    organizations: {
      source: 'Organization collection',
      total: totalOrganizations,
    },
    verification: {
      source: 'OrganizationVerification collection',
      pending: verificationPending,
      needsInformation: verificationNeedsInfo,
      enhancedReview: verificationEnhancedReview,
      underReview: verificationUnderReview,
    },
    notifications: {
      source: 'UserNotification collection',
      unreadStaff: unreadStaffNotifications,
    },
    trustOperations: {
      source: 'ProfessionalReport / ProfessionalDispute collections',
      openReports,
      openDisputes,
    },
    services: {
      source: 'Consultation / ProfessionalCase collections',
      activeConsultations,
      activeCases,
    },
    commerce: {
      source: 'CommerceRefund / CommerceReconciliation collections',
      refundRequests,
      reconciliationMismatches,
    },
    institutions: {
      source: 'InstitutionClaim collection',
      claimsPending: institutionClaimsPending,
    },
    marketplace: {
      source: 'AgentMarketplacePost collection',
      pendingModeration: marketplacePending,
    },
    dataQuality: {
      source: 'FactProvenance / CanonicalSource / InstitutionDataConflict collections',
      staleFacts,
      reviewDueFacts,
      brokenSources,
      openConflicts,
    },
    ai: {
      source: 'CopilotModelProvider in-process config',
      providerStatus: aiProviderStatus,
    },
    recentAuditActivity: {
      source: 'AuditLog collection',
      scope: 'last 5 entries (safe metadata only)',
      entries: recentAudit,
    },
  };
}
