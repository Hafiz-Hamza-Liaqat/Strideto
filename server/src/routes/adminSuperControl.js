/**
 * Admin Super Control Center routes — Mission 21.
 *
 * Security: All routes rely on the parent adminRouter's
 *   requireAuth + requireStaff gate, then add explicit permission checks.
 *
 * No admin route can forge the actor identity — all actor derivation is
 * from req.user (JWT principal set by middleware/auth.js).
 */
import { Router } from 'express';
import { requirePermission, requireSuperAdmin } from '../middleware/rbac.js';
import { PERMISSIONS } from '../config/rbac.js';
import * as ctrl from '../controllers/admin/adminSuperControlController.js';

export const adminSuperControlRouter = Router();

// ── Overview ───────────────────────────────────────────────────────────────────
adminSuperControlRouter.get(
  '/overview',
  requirePermission(PERMISSIONS.ANALYTICS_READ),
  ctrl.getOverview
);

// ── Organizations ─────────────────────────────────────────────────────────────
adminSuperControlRouter.get(
  '/organizations',
  requirePermission(PERMISSIONS.ORGANIZATIONS_READ),
  ctrl.listOrganizations
);

adminSuperControlRouter.get(
  '/organizations/:id',
  requirePermission(PERMISSIONS.ORGANIZATIONS_READ),
  ctrl.getOrganizationDetail
);

// ── Trust — Reports ────────────────────────────────────────────────────────────
adminSuperControlRouter.get(
  '/trust/reports',
  requirePermission(PERMISSIONS.TRUST_TRIAGE),
  ctrl.listReports
);

adminSuperControlRouter.patch(
  '/trust/reports/:id',
  requirePermission(PERMISSIONS.TRUST_RESOLVE),
  ctrl.updateReport
);

// ── Trust — Disputes ────────────────────────────────────────────────────────────
adminSuperControlRouter.get(
  '/trust/disputes',
  requirePermission(PERMISSIONS.TRUST_TRIAGE),
  ctrl.listDisputes
);

// Dispute resolution requires Admin+
adminSuperControlRouter.patch(
  '/trust/disputes/:id/resolve',
  requirePermission(PERMISSIONS.TRUST_RESOLVE),
  ctrl.resolveDispute
);

// ── Trust — Reviews ────────────────────────────────────────────────────────────
adminSuperControlRouter.get(
  '/trust/reviews',
  requirePermission(PERMISSIONS.TRUST_TRIAGE),
  ctrl.listReviews
);

// ── Consultation metadata (operational, no private content) ───────────────────
adminSuperControlRouter.get(
  '/consultations',
  requirePermission(PERMISSIONS.CONSULTATION_META_READ),
  ctrl.listConsultations
);

// ── Case metadata (operational, no private notes) ─────────────────────────────
adminSuperControlRouter.get(
  '/cases',
  requirePermission(PERMISSIONS.CASE_META_READ),
  ctrl.listCases
);

// ── Privileged Support Investigation Gate (SuperAdmin only) ───────────────────
adminSuperControlRouter.post(
  '/trust/investigations',
  requirePermission(PERMISSIONS.PRIVILEGED_SUPPORT),
  requireSuperAdmin,
  ctrl.openPrivilegedInvestigation
);

// ── Commerce — Reconciliation ─────────────────────────────────────────────────
adminSuperControlRouter.get(
  '/commerce/reconciliation',
  requirePermission(PERMISSIONS.RECONCILIATION_MANAGE),
  ctrl.listReconciliation
);

adminSuperControlRouter.patch(
  '/commerce/reconciliation/:id/manual-review',
  requirePermission(PERMISSIONS.RECONCILIATION_MANAGE),
  ctrl.markReconciliationManualReview
);

// ── Commerce — Connect Accounts (safe projection) ─────────────────────────────
adminSuperControlRouter.get(
  '/commerce/connect-accounts',
  requirePermission(PERMISSIONS.COMMERCE_ADMIN_READ),
  ctrl.listConnectAccounts
);

// ── Commerce — Refunds view ────────────────────────────────────────────────────
adminSuperControlRouter.get(
  '/commerce/refunds',
  requirePermission(PERMISSIONS.COMMERCE_ADMIN_READ),
  ctrl.listRefunds
);

// ── AI Operational Status ─────────────────────────────────────────────────────
adminSuperControlRouter.get(
  '/ai/status',
  requirePermission(PERMISSIONS.AI_OPS_READ),
  ctrl.getAiOpsStatus
);

// ── System Readiness ──────────────────────────────────────────────────────────
adminSuperControlRouter.get(
  '/system/readiness',
  requirePermission(PERMISSIONS.SYSTEM_READ),
  ctrl.getSystemReadiness
);

// ── Risk Signals ──────────────────────────────────────────────────────────────
adminSuperControlRouter.get(
  '/risk-signals',
  requirePermission(PERMISSIONS.ORGANIZATIONS_READ),
  ctrl.getRiskSignals
);
