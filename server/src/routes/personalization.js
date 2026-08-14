/**
 * Personalization routes — Mission 8.
 *
 * All routes require authentication as a user (not employer).
 * Server derives user identity from JWT; no userId param accepted from caller.
 * No cross-user access permitted.
 */
import { Router } from 'express';
import { studentProductAuth } from '../middleware/requireUserCapability.js';
import {
  getProgramEligibility,
  getScholarshipEligibility,
  getProgramRecommendations,
  getScholarshipRecommendations,
  getGapAnalysis,
  getProgramTestGuidance,
} from '../controllers/personalizationController.js';

export const personalizationRouter = Router();

const auth = [...studentProductAuth];

// Recommendations
personalizationRouter.get('/personalization/recommendations/programs', ...auth, getProgramRecommendations);
personalizationRouter.get('/personalization/recommendations/scholarships', ...auth, getScholarshipRecommendations);

// Eligibility detail
personalizationRouter.get('/personalization/programs/:programId/eligibility', ...auth, getProgramEligibility);
personalizationRouter.get('/personalization/scholarships/:scholarshipId/eligibility', ...auth, getScholarshipEligibility);

// Gap analysis
personalizationRouter.get('/personalization/gaps', ...auth, getGapAnalysis);

// Profile-aware test guidance
personalizationRouter.get('/personalization/programs/:programId/test-guidance', ...auth, getProgramTestGuidance);
