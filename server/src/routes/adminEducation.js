/**
 * Admin education management routes (Mission 4).
 *
 * All routes require Auth + Staff + Admin already enforced by the parent
 * adminRouter middleware. This sub-router adds education-specific endpoints.
 */
import { Router } from 'express';
import * as edu from '../controllers/education/adminEducationController.js';

export const adminEducationRouter = Router();

// ── Test Providers ────────────────────────────────────────────────────────────
adminEducationRouter.get('/education/providers', edu.adminListProviders);
adminEducationRouter.post('/education/providers', edu.adminCreateProvider);
adminEducationRouter.patch('/education/providers/:id', edu.adminUpdateProvider);

// ── Tests (canonical catalog) ─────────────────────────────────────────────────
adminEducationRouter.get('/education/tests', edu.adminListTests);
adminEducationRouter.get('/education/tests/:id', edu.adminGetTest);
adminEducationRouter.post('/education/tests', edu.adminCreateTest);
adminEducationRouter.patch('/education/tests/:id', edu.adminUpdateTest);

// ── Preparation Guides ────────────────────────────────────────────────────────
adminEducationRouter.get('/education/prep-guides', edu.adminListPrepGuides);
adminEducationRouter.post('/education/prep-guides', edu.adminCreatePrepGuide);
adminEducationRouter.patch('/education/prep-guides/:id', edu.adminUpdatePrepGuide);

// ── External Resources ────────────────────────────────────────────────────────
adminEducationRouter.get('/education/resources', edu.adminListResources);
adminEducationRouter.post('/education/resources', edu.adminCreateResource);
adminEducationRouter.patch('/education/resources/:id', edu.adminUpdateResource);

// ── Test Alerts ───────────────────────────────────────────────────────────────
adminEducationRouter.get('/education/alerts', edu.adminListAlerts);
adminEducationRouter.post('/education/alerts', edu.adminCreateAlert);
adminEducationRouter.patch('/education/alerts/:id', edu.adminUpdateAlert);

// ── Country Education ─────────────────────────────────────────────────────────
adminEducationRouter.get('/education/countries', edu.adminListCountryEducation);
adminEducationRouter.post('/education/countries', edu.adminCreateCountryEducation);
adminEducationRouter.patch('/education/countries/:id', edu.adminUpdateCountryEducation);

// ── Canonical Institutions ────────────────────────────────────────────────────
adminEducationRouter.get('/education/institutions', edu.adminListInstitutions);
adminEducationRouter.post('/education/institutions', edu.adminCreateInstitution);
adminEducationRouter.patch('/education/institutions/:id', edu.adminUpdateInstitution);

// ── Programs ──────────────────────────────────────────────────────────────────
adminEducationRouter.get('/education/programs', edu.adminListPrograms);
adminEducationRouter.post('/education/programs', edu.adminCreateProgram);
adminEducationRouter.patch('/education/programs/:id', edu.adminUpdateProgram);
