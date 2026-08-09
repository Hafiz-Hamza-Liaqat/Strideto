/**
 * Personalization Controller — Mission 8.
 *
 * All endpoints operate on the authenticated user's own profile.
 * Server derives userId from req.user — callers cannot supply a different userId.
 * No cross-user access. No private profile leakage in public endpoints.
 */
import {
  evaluateProgramEligibility,
  evaluateScholarshipEligibility,
  recommendPrograms,
  recommendScholarships,
  getProfileGapAnalysis,
  getProfileTestGuidance,
} from '../services/personalizationService.js';

function parsePageParams(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 20));
  return { page, limit };
}

// GET /api/personalization/programs/:programId/eligibility
export async function getProgramEligibility(req, res) {
  try {
    const userId = req.user.userId;
    const { programId } = req.params;
    const result = await evaluateProgramEligibility(userId, programId);
    if (result.error) return res.status(result.error === 'profile_not_found' ? 404 : 404).json({ error: result.error });
    return res.json(result);
  } catch (err) {
    console.error('[personalization] getProgramEligibility error', err?.message);
    return res.status(500).json({ error: 'evaluation_failed' });
  }
}

// GET /api/personalization/scholarships/:scholarshipId/eligibility
export async function getScholarshipEligibility(req, res) {
  try {
    const userId = req.user.userId;
    const { scholarshipId } = req.params;
    const result = await evaluateScholarshipEligibility(userId, scholarshipId);
    if (result.error) return res.status(404).json({ error: result.error });
    return res.json(result);
  } catch (err) {
    console.error('[personalization] getScholarshipEligibility error', err?.message);
    return res.status(500).json({ error: 'evaluation_failed' });
  }
}

// GET /api/personalization/recommendations/programs
export async function getProgramRecommendations(req, res) {
  try {
    const userId = req.user.userId;
    const { page, limit } = parsePageParams(req.query);
    const { country, field, degreeLevel } = req.query;
    const result = await recommendPrograms(userId, { page, limit, country, field, degreeLevel });
    if (result.error) return res.status(404).json({ error: result.error });
    return res.json(result);
  } catch (err) {
    console.error('[personalization] getProgramRecommendations error', err?.message);
    return res.status(500).json({ error: 'recommendations_failed' });
  }
}

// GET /api/personalization/recommendations/scholarships
export async function getScholarshipRecommendations(req, res) {
  try {
    const userId = req.user.userId;
    const { page, limit } = parsePageParams(req.query);
    const { country, field, fundingType } = req.query;
    const result = await recommendScholarships(userId, { page, limit, country, field, fundingType });
    if (result.error) return res.status(404).json({ error: result.error });
    return res.json(result);
  } catch (err) {
    console.error('[personalization] getScholarshipRecommendations error', err?.message);
    return res.status(500).json({ error: 'recommendations_failed' });
  }
}

// GET /api/personalization/gaps
export async function getGapAnalysis(req, res) {
  try {
    const userId = req.user.userId;
    const result = await getProfileGapAnalysis(userId);
    if (result.error) return res.status(404).json({ error: result.error });
    return res.json(result);
  } catch (err) {
    console.error('[personalization] getGapAnalysis error', err?.message);
    return res.status(500).json({ error: 'gap_analysis_failed' });
  }
}

// GET /api/personalization/programs/:programId/test-guidance
export async function getProgramTestGuidance(req, res) {
  try {
    const userId = req.user.userId;
    const { programId } = req.params;
    const result = await getProfileTestGuidance(userId, programId);
    if (result.error) return res.status(404).json({ error: result.error });
    return res.json(result);
  } catch (err) {
    console.error('[personalization] getProgramTestGuidance error', err?.message);
    return res.status(500).json({ error: 'test_guidance_failed' });
  }
}
