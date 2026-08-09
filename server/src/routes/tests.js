import { Router } from 'express';
import * as tests from '../controllers/education/testController.js';

export const testsRouter = Router();

// ── Test catalog (public, published only) ─────────────────────────────────────
testsRouter.get('/tests', tests.listTests);
testsRouter.get('/tests/:slug', tests.getTest);
testsRouter.get('/tests/:slug/prep-guide', tests.getTestPrepGuide);
testsRouter.get('/tests/:slug/resources', tests.getTestResources);
testsRouter.get('/tests/:slug/alerts', tests.getTestAlerts);

// ── Providers (public) ────────────────────────────────────────────────────────
testsRouter.get('/education/providers', tests.listProviders);

// ── Country education (public) ────────────────────────────────────────────────
testsRouter.get('/education/countries', tests.listCountryEducation);
testsRouter.get('/education/countries/:code', tests.getCountryEducation);

// ── Canonical Institutions (public) ───────────────────────────────────────────
testsRouter.get('/education/institutions', tests.listInstitutions);
testsRouter.get('/education/institutions/:slug', tests.getInstitution);
