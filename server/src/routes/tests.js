import { Router } from 'express';
import * as tests from '../controllers/education/testController.js';
import * as acceptance from '../controllers/education/testAcceptanceController.js';
import * as scholarships from '../controllers/education/scholarshipController.js';
import * as programs from '../controllers/education/programIntelligenceController.js';

export const testsRouter = Router();

// ── Test catalog (public, published only) ─────────────────────────────────────
testsRouter.get('/tests', tests.listTests);
testsRouter.get('/tests/:slug', tests.getTest);
testsRouter.get('/tests/:slug/prep-guide', tests.getTestPrepGuide);
testsRouter.get('/tests/:slug/resources', tests.getTestResources);
testsRouter.get('/tests/:slug/alerts', tests.getTestAlerts);

// ── Test Acceptance Explorer — forward (Mission 6) ────────────────────────────
testsRouter.get('/tests/:slug/acceptance', acceptance.getTestAcceptance);

// ── Providers (public) ────────────────────────────────────────────────────────
testsRouter.get('/education/providers', tests.listProviders);

// ── Country education (public) ────────────────────────────────────────────────
testsRouter.get('/education/countries', tests.listCountryEducation);
testsRouter.get('/education/countries/:code', tests.getCountryEducation);

// ── Canonical Institutions (public) ───────────────────────────────────────────
testsRouter.get('/education/institutions', tests.listInstitutions);
testsRouter.get('/education/institutions/:slug', tests.getInstitution);

// ── Institution acceptance — reverse (Mission 6) ──────────────────────────────
testsRouter.get('/education/institutions/:slug/acceptance', acceptance.getInstitutionAcceptance);

// ── Programs (public, Mission 6 + 7) ─────────────────────────────────────────
testsRouter.get('/education/programs', programs.listPrograms);
testsRouter.get('/education/programs/:slug', programs.getProgramDetail);
testsRouter.get('/education/programs/:slug/acceptance', acceptance.getProgramAcceptance);
testsRouter.get('/education/programs/compare', programs.comparePrograms);

// ── Scholarships (public, Mission 7) ─────────────────────────────────────────
testsRouter.get('/education/scholarships', scholarships.listScholarships);
testsRouter.get('/education/scholarships/compare', scholarships.compareScholarships);
testsRouter.get('/education/scholarships/:slug', scholarships.getScholarship);
