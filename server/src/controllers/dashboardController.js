import { User } from '../models/User.js';
import { Notification } from '../models/Notification.js';
import { Job } from '../models/Job.js';
import { Scholarship } from '../models/Scholarship.js';
import { Admission } from '../models/Admission.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { TalentProfileReadService } from '../services/career/TalentProfileReadService.js';
import { buildPublicJobMongoFilter } from '../../../shared/publicDiscovery/publicTruth.js';

const TRENDING_LIMIT = 6;
const NOTIFICATIONS_LIMIT = 10;

export const getDashboard = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const user = await User.findById(userId)
    .populate('savedJobs')
    .populate('savedScholarships')
    .populate('savedAdmissions')
    .populate('savedInternships')
    .populate('savedIntlScholarships')
    .populate('recentlyViewedJobs')
    .populate('recentlyViewedScholarships')
    .populate('recentlyViewedAdmissions')
    .lean();
  if (!user) return res.status(404).json({ error: 'User not found' });

  const [careerTargeting, profileSummary] = await Promise.all([
    TalentProfileReadService.getCareerTargetingContext(userId),
    TalentProfileReadService.getDashboardSummary(userId),
  ]);
  const targetingProvince = careerTargeting.province || user.province;
  const targetingInterests = careerTargeting.interests?.length ? careerTargeting.interests : (user.interests || []);

  const savedJobs = (user.savedJobs || []).filter((j) => j && j.status === 'active');
  const savedScholarships = (user.savedScholarships || []).filter((s) => s && s.status === 'active');
  const savedAdmissions = (user.savedAdmissions || []).filter((a) => a && a.status === 'active');
  const savedInternships = (user.savedInternships || []).filter((i) => i && i.status === 'active');
  const savedIntlScholarships = (user.savedIntlScholarships || []).filter((s) => s && s.status === 'active');
  const recentlyViewedJobs = (user.recentlyViewedJobs || []).filter((j) => j && j.status === 'active').slice(-10).reverse();
  const recentlyViewedScholarships = (user.recentlyViewedScholarships || []).filter((s) => s && s.status === 'active').slice(-10).reverse();
  const recentlyViewedAdmissions = (user.recentlyViewedAdmissions || []).filter((a) => a && a.status === 'active').slice(-10).reverse();

  const [trendingJobs, trendingScholarships, trendingAdmissions, notifications] = await Promise.all([
    Job.find(buildPublicJobMongoFilter()).sort({ views: -1, createdAt: -1 }).limit(TRENDING_LIMIT).lean(),
    Scholarship.find({ status: 'active' }).sort({ views: -1, deadline: 1 }).limit(TRENDING_LIMIT).lean(),
    Admission.find({ status: 'active' }).sort({ deadline: 1, views: -1 }).limit(TRENDING_LIMIT).lean(),
    Notification.find({
      $and: [
        { $or: [{ target_province: { $exists: false } }, { target_province: { $in: [null, ''] } }, { target_province: targetingProvince }] },
        { $or: [{ target_interest: { $exists: false } }, { target_interest: { $in: [null, ''] } }, { target_interest: { $in: targetingInterests } }] },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(NOTIFICATIONS_LIMIT)
      .lean(),
  ]);

  res.json({
    user: {
      name: profileSummary.career?.displayName || user.name,
      email: user.email,
      province: targetingProvince,
      interests: targetingInterests,
      notifications: user.notifications,
      headline: profileSummary.career?.headline || '',
      careerSource: careerTargeting.source,
      talentProfileId: profileSummary.talentProfileId,
    },
    career: profileSummary.career,
    resumes: profileSummary.readCanonical
      ? profileSummary.resumeVersions
      : [...profileSummary.resumeVersions, ...profileSummary.legacyResumes],
    saved: {
      savedJobs,
      savedScholarships,
      savedAdmissions,
      savedInternships,
      savedIntlScholarships,
    },
    recentlyViewed: {
      jobs: recentlyViewedJobs,
      scholarships: recentlyViewedScholarships,
      admissions: recentlyViewedAdmissions,
    },
    trending: {
      jobs: trendingJobs,
      scholarships: trendingScholarships,
      admissions: trendingAdmissions,
    },
    notifications,
  });
});
