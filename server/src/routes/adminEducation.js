/**
 * Admin education management routes (Missions 4, 6, 7).
 *
 * All routes require Auth + Staff + Admin already enforced by the parent
 * adminRouter middleware. This sub-router adds education-specific endpoints.
 */
import { Router } from 'express';
import * as edu from '../controllers/education/adminEducationController.js';
import * as acc from '../controllers/education/adminAcceptanceController.js';
import * as sch from '../controllers/education/adminScholarshipController.js';

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
adminEducationRouter.get('/education/institutions/:id', edu.adminGetInstitution);
adminEducationRouter.patch('/education/institutions/:id', edu.adminUpdateInstitution);

// ── Programs ──────────────────────────────────────────────────────────────────
adminEducationRouter.get('/education/programs', edu.adminListPrograms);
adminEducationRouter.post('/education/programs', edu.adminCreateProgram);
adminEducationRouter.get('/education/programs/:id', edu.adminGetProgram);
adminEducationRouter.patch('/education/programs/:id', edu.adminUpdateProgram);

// ── Test Acceptance Explorer (Mission 6) ──────────────────────────────────────
adminEducationRouter.get('/education/acceptance', acc.adminListAcceptance);
adminEducationRouter.get('/education/acceptance/:id', acc.adminGetAcceptance);
adminEducationRouter.post('/education/acceptance', acc.adminCreateAcceptance);
adminEducationRouter.patch('/education/acceptance/:id', acc.adminUpdateAcceptance);
adminEducationRouter.post('/education/acceptance/:id/supersede', acc.adminSupersedeAcceptance);

// ── Canonical Scholarships (Mission 7) ───────────────────────────────────────
adminEducationRouter.get('/education/scholarships', sch.adminListScholarships);
adminEducationRouter.get('/education/scholarships/:id', sch.adminGetScholarship);
adminEducationRouter.post('/education/scholarships', sch.adminCreateScholarship);
adminEducationRouter.patch('/education/scholarships/:id', sch.adminUpdateScholarship);

// ── Scholarship Cycles ────────────────────────────────────────────────────────
adminEducationRouter.get('/education/scholarships/:scholarshipId/cycles', sch.adminListCycles);
adminEducationRouter.post('/education/scholarships/:scholarshipId/cycles', sch.adminCreateCycle);
adminEducationRouter.patch('/education/scholarships/:scholarshipId/cycles/:cycleId', sch.adminUpdateCycle);

// ── Scholarship Applicability ─────────────────────────────────────────────────
adminEducationRouter.get('/education/scholarships/:scholarshipId/applicability', sch.adminListApplicability);
adminEducationRouter.post('/education/scholarships/:scholarshipId/applicability', sch.adminCreateApplicability);
adminEducationRouter.patch('/education/scholarships/:scholarshipId/applicability/:applicabilityId', sch.adminUpdateApplicability);

// ── Program Requirements ──────────────────────────────────────────────────────
adminEducationRouter.get('/education/programs/:programId/requirements', sch.adminListProgramRequirements);
adminEducationRouter.post('/education/programs/:programId/requirements', sch.adminCreateProgramRequirement);
adminEducationRouter.patch('/education/programs/:programId/requirements/:requirementId', sch.adminUpdateProgramRequirement);

// ── Program Intelligence (Mission 7 extended fields) ─────────────────────────
adminEducationRouter.patch('/education/programs/:programId/intelligence', sch.adminUpdateProgramIntelligence);
