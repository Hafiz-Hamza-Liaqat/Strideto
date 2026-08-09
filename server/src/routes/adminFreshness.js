/**
 * Admin freshness queue + data quality routes (Mission 5).
 *
 * All routes require Auth + Staff + Admin middleware (enforced by parent
 * adminRouter). This sub-router adds trust/freshness-specific endpoints.
 */
import { Router } from 'express';
import * as fresh from '../controllers/trust/adminFreshnessController.js';

export const adminFreshnessRouter = Router();

// ── Freshness queue (FactProvenance) ──────────────────────────────────────────
adminFreshnessRouter.get('/trust/freshness-queue', fresh.adminListFreshnessQueue);
adminFreshnessRouter.patch('/trust/freshness-queue/:id/verify', fresh.adminVerifyFact);
adminFreshnessRouter.patch('/trust/freshness-queue/:id/status', fresh.adminUpdateVerificationStatus);
adminFreshnessRouter.patch('/trust/freshness-queue/:id/schedule-review', fresh.adminScheduleReview);

// ── Canonical sources ─────────────────────────────────────────────────────────
adminFreshnessRouter.get('/trust/sources', fresh.adminListSources);
adminFreshnessRouter.post('/trust/sources', fresh.adminCreateSource);
adminFreshnessRouter.patch('/trust/sources/:id', fresh.adminUpdateSource);

// ── Corrections (admin view) ──────────────────────────────────────────────────
adminFreshnessRouter.get('/trust/corrections', fresh.adminListCorrections);
adminFreshnessRouter.patch('/trust/corrections/:id/resolve', fresh.adminResolveCorrection);

// ── Data quality metrics ──────────────────────────────────────────────────────
adminFreshnessRouter.get('/trust/metrics', fresh.adminDataQualityMetrics);
