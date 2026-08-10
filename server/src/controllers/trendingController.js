import { Job } from '../models/Job.js';
import { Scholarship } from '../models/Scholarship.js';
import { Admission } from '../models/Admission.js';
import { User } from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { cacheGet, cacheSet } from '../config/redis.js';
import { getTrending, setTrending } from '../utils/trendingCache.js';
import { CACHE_KEYS } from '../utils/cacheKeys.js';

const TRENDING_LIMIT = 10;
const CACHE_TTL = 300;
const TRENDING_CANDIDATE_LIMIT = 5000;
const BOOKMARK_USER_LIMIT = 10000;

async function getBookmarkCounts(collection) {
  const field = collection === 'jobs' ? 'savedJobs' : collection === 'scholarships' ? 'savedScholarships' : 'savedAdmissions';
  const users = await User.find({ [field]: { $exists: true, $ne: [] } }).select(field).limit(BOOKMARK_USER_LIMIT).lean();
  const countMap = {};
  users.forEach((u) => {
    (u[field] || []).forEach((id) => {
      const key = id.toString();
      countMap[key] = (countMap[key] || 0) + 1;
    });
  });
  return countMap;
}

function deadlineScore(deadline) {
  if (!deadline) return 0;
  const d = new Date(deadline).getTime();
  const now = Date.now();
  const daysLeft = (d - now) / (24 * 60 * 60 * 1000);
  if (daysLeft < 0) return 0;
  if (daysLeft <= 7) return 100;
  if (daysLeft <= 30) return 70;
  if (daysLeft <= 90) return 40;
  return 10;
}

export const getTrendingJobs = asyncHandler(async (req, res) => {
  let data = await cacheGet(CACHE_KEYS.TRENDING_JOBS);
  if (!data) data = getTrending('jobs');
  if (!data) {
    const jobs = await Job.find({ status: 'active' }).sort({ views: -1, deadline: 1 }).limit(TRENDING_CANDIDATE_LIMIT).lean();
    const bookmarkCounts = await getBookmarkCounts('jobs');
    const scored = jobs.map((j) => {
      const views = j.views || 0;
      const bookmarks = bookmarkCounts[j._id.toString()] || 0;
      const deadline = deadlineScore(j.deadline);
      const score = views * 1 + bookmarks * 5 + deadline;
      return { ...j, _trendScore: score };
    });
    scored.sort((a, b) => b._trendScore - a._trendScore);
    data = scored.slice(0, TRENDING_LIMIT).map(({ _trendScore, ...j }) => j);
    await cacheSet(CACHE_KEYS.TRENDING_JOBS, data, CACHE_TTL);
    setTrending('jobs', data);
  }
  res.json({ data });
});

export const getTrendingScholarships = asyncHandler(async (req, res) => {
  let data = await cacheGet(CACHE_KEYS.TRENDING_SCHOLARSHIPS);
  if (!data) data = getTrending('scholarships');
  if (!data) {
    const scholarships = await Scholarship.find({ status: 'active' }).sort({ views: -1, deadline: 1 }).limit(TRENDING_CANDIDATE_LIMIT).lean();
    const bookmarkCounts = await getBookmarkCounts('scholarships');
    const scored = scholarships.map((s) => {
      const views = s.views || 0;
      const bookmarks = bookmarkCounts[s._id.toString()] || 0;
      const deadline = deadlineScore(s.deadline);
      const score = views * 1 + bookmarks * 5 + deadline;
      return { ...s, _trendScore: score };
    });
    scored.sort((a, b) => b._trendScore - a._trendScore);
    data = scored.slice(0, TRENDING_LIMIT).map(({ _trendScore, ...s }) => s);
    await cacheSet(CACHE_KEYS.TRENDING_SCHOLARSHIPS, data, CACHE_TTL);
    setTrending('scholarships', data);
  }
  res.json({ data });
});

export const getTrendingAdmissions = asyncHandler(async (req, res) => {
  let data = await cacheGet(CACHE_KEYS.TRENDING_ADMISSIONS);
  if (!data) data = getTrending('admissions');
  if (!data) {
    const admissions = await Admission.find({ status: 'active' }).sort({ views: -1, deadline: 1 }).limit(TRENDING_CANDIDATE_LIMIT).lean();
    const bookmarkCounts = await getBookmarkCounts('admissions');
    const scored = admissions.map((a) => {
      const views = a.views || 0;
      const bookmarks = bookmarkCounts[a._id.toString()] || 0;
      const deadline = deadlineScore(a.deadline);
      const score = views * 1 + bookmarks * 5 + deadline;
      return { ...a, _trendScore: score };
    });
    scored.sort((a, b) => b._trendScore - a._trendScore);
    data = scored.slice(0, TRENDING_LIMIT).map(({ _trendScore, ...a }) => a);
    await cacheSet(CACHE_KEYS.TRENDING_ADMISSIONS, data, CACHE_TTL);
    setTrending('admissions', data);
  }
  res.json({ data });
});

export const getTrendingByType = asyncHandler(async (req, res) => {
  const { type } = req.params;
  if (type === 'jobs') return getTrendingJobs(req, res);
  if (type === 'scholarships') return getTrendingScholarships(req, res);
  if (type === 'admissions') return getTrendingAdmissions(req, res);
  res.status(400).json({ error: 'Invalid type. Use jobs, scholarships, or admissions.' });
});
