/**
 * SEO-P4 — deterministic related-entity scoring helpers.
 */
import { isJobDetailPubliclyEligible } from './entityDetailSeoPolicy.js';
import { normalizeInternalPath } from './internalLinkSafety.js';

/**
 * @param {object} current
 * @param {object} candidate
 * @returns {number}
 */
export function scoreRelatedJob(current, candidate) {
  if (!isJobDetailPubliclyEligible(candidate)) return -1;
  if (!candidate.slug) return -1;
  if (String(candidate._id) === String(current._id)) return -1;

  let score = 0;
  if (current.specialization && candidate.specialization === current.specialization) score += 40;
  if (current.jobFamily && candidate.jobFamily === current.jobFamily) score += 30;
  if (current.city && candidate.city === current.city) score += 20;
  if (current.countryCode && candidate.countryCode === current.countryCode) score += 20;
  if (current.type && candidate.type === current.type) score += 15;
  if (current.category && candidate.category === current.category) score += 15;
  if (current.province && candidate.province === current.province) score += 10;

  const ts = candidate.updatedAt || candidate.createdAt;
  if (ts) score += Math.max(0, 1 - Math.floor((Date.now() - new Date(ts).getTime()) / (180 * 24 * 60 * 60 * 1000)));

  return score;
}

/**
 * @param {object} current
 * @param {object[]} candidates
 * @param {{ limit?: number }} [options]
 * @returns {object[]}
 */
export function rankRelatedJobs(current, candidates, { limit = 4 } = {}) {
  return (candidates || [])
    .map((candidate) => ({ candidate, score: scoreRelatedJob(current, candidate) }))
    .filter((row) => row.score >= 0)
    .sort((a, b) => b.score - a.score || String(b.candidate.updatedAt || '').localeCompare(String(a.candidate.updatedAt || '')))
    .slice(0, limit)
    .map((row) => row.candidate);
}

/**
 * @param {object} current
 * @param {object} candidate
 * @returns {number}
 */
export function scoreRelatedInternship(current, candidate) {
  if (!candidate?.slug || candidate.status !== 'active') return -1;
  if (String(candidate._id) === String(current._id)) return -1;

  let score = 0;
  if (current.specialization && candidate.specialization === current.specialization) score += 40;
  if (current.field && candidate.field === current.field) score += 30;
  if (current.city && candidate.city === current.city) score += 20;
  if (current.countryCode && candidate.countryCode === current.countryCode) score += 20;
  if (current.workMode && candidate.workMode === current.workMode) score += 10;
  if (current.organization && candidate.organization === current.organization) score += 10;

  const ts = candidate.updatedAt || candidate.createdAt;
  if (ts) score += Math.max(0, 1 - Math.floor((Date.now() - new Date(ts).getTime()) / (180 * 24 * 60 * 60 * 1000)));

  return score;
}

/**
 * @param {object} current
 * @param {object[]} candidates
 * @param {{ limit?: number }} [options]
 * @returns {object[]}
 */
export function rankRelatedInternships(current, candidates, { limit = 4 } = {}) {
  return (candidates || [])
    .map((candidate) => ({ candidate, score: scoreRelatedInternship(current, candidate) }))
    .filter((row) => row.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((row) => row.candidate);
}

/**
 * @param {object} current
 * @param {object} candidate
 * @returns {number}
 */
export function scoreRelatedCmsScholarship(current, candidate) {
  if (!candidate?.slug || candidate.status !== 'active') return -1;
  if (String(candidate._id) === String(current._id)) return -1;

  let score = 0;
  if (current.level && candidate.level === current.level) score += 40;
  if (current.country && candidate.country === current.country) score += 30;
  if (current.countryCode && candidate.countryCode === current.countryCode) score += 30;
  if (current.provider && candidate.provider === current.provider) score += 25;
  if (current.type && candidate.type === current.type) score += 15;

  const deadline = candidate.deadline || candidate.applicationDeadline;
  if (deadline) score += 1;

  return score;
}

/**
 * @param {object} current
 * @param {object[]} candidates
 * @param {{ limit?: number }} [options]
 * @returns {object[]}
 */
export function rankRelatedCmsScholarships(current, candidates, { limit = 4 } = {}) {
  return (candidates || [])
    .map((candidate) => ({ candidate, score: scoreRelatedCmsScholarship(current, candidate) }))
    .filter((row) => row.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((row) => row.candidate);
}

/**
 * @param {object} current
 * @param {object} candidate
 * @returns {number}
 */
export function scoreRelatedProgram(current, candidate) {
  if (!candidate?.slug || candidate.status !== 'published') return -1;
  if (String(candidate._id) === String(current._id)) return -1;

  let score = 0;
  const curInst = String(current.institutionId?._id || current.institutionId || '');
  const candInst = String(candidate.institutionId?._id || candidate.institutionId || '');
  if (curInst && candInst && curInst === candInst) score += 100;
  if (current.field && candidate.field === current.field) score += 40;
  if (current.degreeLevel && candidate.degreeLevel === current.degreeLevel) score += 30;
  if (current.country && candidate.country === current.country) score += 20;

  return score;
}

/**
 * @param {object} current
 * @param {object[]} candidates
 * @param {{ limit?: number }} [options]
 * @returns {object[]}
 */
export function rankRelatedPrograms(current, candidates, { limit = 4 } = {}) {
  return (candidates || [])
    .map((candidate) => ({ candidate, score: scoreRelatedProgram(current, candidate) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((row) => row.candidate);
}

/**
 * @param {object} entity
 * @param {string} prefix
 * @returns {string}
 */
export function entityDetailPath(entity, prefix) {
  if (!entity?.slug) return '';
  return normalizeInternalPath(`${prefix}/${entity.slug}`);
}
