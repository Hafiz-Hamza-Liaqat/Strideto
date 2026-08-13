import { Job } from '../models/Job.js';
import { Scholarship } from '../models/Scholarship.js';
import { Admission } from '../models/Admission.js';
import { User } from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { cacheGet, cacheSet } from '../config/redis.js';
import { CACHE_KEYS } from '../utils/cacheKeys.js';
import { TalentProfileReadService } from '../services/career/TalentProfileReadService.js';
import { withFixtureExclusion } from '../../../shared/publicDiscovery/fixtureExclusion.js';
import {
  projectPublicJobListItem,
  projectPublicCmsScholarship,
  projectPublicCmsAdmission,
} from '../../../shared/publicDiscovery/projectPublicDiscovery.js';

const RECOMMEND_LIMIT = 8;
const CANDIDATE_CAP = 80;
const CACHE_TTL = 600; // 10 min

const LAUNCH_ACTIVE = withFixtureExclusion({ status: 'active' });

function safeProject(projectFn, doc) {
  try {
    const item = projectFn(doc);
    return item && item._id ? item : null;
  } catch {
    return null;
  }
}

/**
 * Placeholder scoring: match by province, then interests (category/level), then recency.
 * Replace with ML model in Phase-8.
 */
function scoreJob(job, user) {
  let score = 0;
  if (user.province && job.province && String(job.province).toLowerCase() === String(user.province).toLowerCase()) score += 50;
  if (user.interests?.length && job.category && user.interests.some((i) => String(i).toLowerCase() === String(job.category).toLowerCase())) score += 30;
  if (job.views) score += Math.min(job.views, 20);
  if (job.deadline && new Date(job.deadline) > new Date()) score += 10;
  return score;
}

function scoreScholarship(s, user) {
  let score = 0;
  if (user.interests?.length && s.level && user.interests.some((i) => String(i).toLowerCase().includes(String(s.level).toLowerCase()))) score += 40;
  if (user.interests?.length && s.title && user.interests.some((i) => String(s.title).toLowerCase().includes(String(i).toLowerCase()))) score += 30;
  if (s.views) score += Math.min(s.views, 20);
  if (s.deadline && new Date(s.deadline) > new Date()) score += 10;
  return score;
}

function scoreAdmission(a, user) {
  let score = 0;
  if (user.province && a.province && String(a.province).toLowerCase() === String(user.province).toLowerCase()) score += 50;
  if (user.interests?.length && a.program && user.interests.some((i) => String(a.program).toLowerCase().includes(String(i).toLowerCase()))) score += 30;
  if (a.views) score += Math.min(a.views, 20);
  if (a.deadline && new Date(a.deadline) > new Date()) score += 10;
  return score;
}

export const getRecommendations = asyncHandler(async (req, res) => {
  const userId = req.params.userId === 'me' ? req.user?.userId : req.params.userId;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  if (req.params.userId !== 'me' && req.user?.userId !== userId && req.user?.role !== 'Admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const cacheKey = `${CACHE_KEYS.PREFIX_RECOMMENDATIONS || 'recommendations:'}${userId}`;
  let cached = await cacheGet(cacheKey);
  if (cached) return res.json(cached);

  const user = await User.findById(userId)
    .select('province interests savedJobs savedScholarships savedAdmissions recentlyViewedJobs recentlyViewedScholarships recentlyViewedAdmissions')
    .lean();
  if (!user) return res.status(404).json({ error: 'User not found' });

  const targeting = await TalentProfileReadService.getCareerTargetingContext(userId);
  const scoringUser = {
    ...user,
    province: targeting.province || user.province,
    interests: targeting.interests?.length ? targeting.interests : (user.interests || []),
  };

  const excludeJobs = [...(user.savedJobs || []), ...(user.recentlyViewedJobs || [])].map((id) => id.toString());
  const excludeScholarships = [...(user.savedScholarships || []), ...(user.recentlyViewedScholarships || [])].map((id) => id.toString());
  const excludeAdmissions = [...(user.savedAdmissions || []), ...(user.recentlyViewedAdmissions || [])].map((id) => id.toString());

  const [allJobs, allScholarships, allAdmissions] = await Promise.all([
    Job.find(LAUNCH_ACTIVE).sort({ createdAt: -1 }).limit(CANDIDATE_CAP).lean(),
    Scholarship.find(LAUNCH_ACTIVE).sort({ createdAt: -1 }).limit(CANDIDATE_CAP).lean(),
    Admission.find(LAUNCH_ACTIVE).sort({ createdAt: -1 }).limit(CANDIDATE_CAP).lean(),
  ]);

  const jobs = allJobs
    .filter((j) => !excludeJobs.includes(j._id.toString()))
    .map((j) => ({ ...j, _score: scoreJob(j, scoringUser) }))
    .sort((a, b) => b._score - a._score)
    .slice(0, RECOMMEND_LIMIT)
    .map(({ _score, ...j }) => safeProject(projectPublicJobListItem, j))
    .filter(Boolean);

  const scholarships = allScholarships
    .filter((s) => !excludeScholarships.includes(s._id.toString()))
    .map((s) => ({ ...s, _score: scoreScholarship(s, scoringUser) }))
    .sort((a, b) => b._score - a._score)
    .slice(0, RECOMMEND_LIMIT)
    .map(({ _score, ...s }) => safeProject(projectPublicCmsScholarship, s))
    .filter(Boolean);

  const admissions = allAdmissions
    .filter((a) => !excludeAdmissions.includes(a._id.toString()))
    .map((a) => ({ ...a, _score: scoreAdmission(a, scoringUser) }))
    .sort((a, b) => b._score - a._score)
    .slice(0, RECOMMEND_LIMIT)
    .map(({ _score, ...a }) => safeProject(projectPublicCmsAdmission, a))
    .filter(Boolean);

  const payload = { jobs, scholarships, admissions, careerSource: targeting.source };
  await cacheSet(cacheKey, payload, CACHE_TTL);
  res.json(payload);
});
