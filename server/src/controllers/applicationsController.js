import { Application } from '../models/Application.js';
import { Job } from '../models/Job.js';
import { User } from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { awardBadge } from './badgesController.js';
import { uploadFile } from '../services/storageService.js';
import { validateResumeBuffer } from '../utils/fileValidation.js';
import { stripAllHtml } from '../utils/htmlSanitize.js';
import { onJobApplication } from '../services/automationService.js';
import { TalentProfileReadService } from '../services/career/TalentProfileReadService.js';
import { ApplicationMigrationService } from '../services/career/migration/ApplicationMigrationService.js';
import { JobVacancyService } from '../services/career/JobVacancyService.js';

export const applyToJob = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const jobId = req.params.id;
  let resumeURL = req.body?.resumeURL || null;
  let resumeSource = 'none';
  let talentProfileId = null;
  let resumeVersionId = null;

  if (req.file?.buffer) {
    await validateResumeBuffer(req.file.buffer, req.file.mimetype);
    const uploaded = await uploadFile({
      buffer: req.file.buffer,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      folder: 'applications',
    });
    resumeURL = uploaded.url;
    resumeSource = 'upload';
  } else {
    const useProfileResume = req.body?.useProfileResume !== '0' && req.body?.useProfileResume !== false;
    const resolved = await TalentProfileReadService.resolveResumeUrlForApply(userId, {
      uploadedUrl: resumeURL,
      useProfileResume,
    });
    resumeURL = resolved.url || resumeURL;
    resumeSource = resolved.source || resumeSource;
    talentProfileId = resolved.talentProfileId || null;
    resumeVersionId = resolved.resumeVersionId || null;
  }

  const job = await Job.findById(jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  try {
    await JobVacancyService.assertJobAcceptingApplications(job);
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message, code: err.code || 'HIRING_CLOSED' });
  }

  if (job.applyType === 'external') {
    return res.status(400).json({ error: 'This job requires external application. Use the official link.' });
  }

  const existing = await Application.findOne({ userId, jobId });
  if (existing) return res.status(400).json({ error: 'You have already applied to this job' });

  let application;
  try {
    application = await Application.create({
      userId,
      jobId,
      resumeURL: resumeURL || req.body?.resumeURL,
      talentProfileId,
      resumeVersionId,
      resumeSource,
      coverLetter: stripAllHtml(req.body?.coverLetter),
      status: 'submitted',
    });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(400).json({ error: 'You have already applied to this job' });
    }
    throw err;
  }
  await Job.findByIdAndUpdate(jobId, { $inc: { applicationsCount: 1 } });

  // L.2.6 — await dual-write so Apply → Tracker redirect can use OA id
  const dualWrite = await ApplicationMigrationService.dualWriteFromLegacyJobApplication(
    application.toObject(),
    job,
  );
  const opportunityApplication = dualWrite?.application || null;
  const opportunityApplicationId = opportunityApplication?._id
    ? String(opportunityApplication._id)
    : null;

  const appCount = await Application.countDocuments({ userId });
  await awardBadge(userId, 'job_applied', 'First Application', 'Applied to your first job');
  if (appCount >= 5) await awardBadge(userId, 'job_hunter_5', 'Job Hunter', '5 applications submitted');

  const [user, candidate] = await Promise.all([
    User.findById(userId).select('name email').lean(),
    TalentProfileReadService.getCandidateCardForUser(userId),
  ]);
  onJobApplication({
    applicationId: application._id,
    userId,
    jobId,
    userName: candidate?.displayName || user?.name,
    userEmail: user?.email,
  }).catch(() => {});

  res.status(201).json({
    id: application._id,
    message: 'Application submitted successfully',
    status: application.status,
    opportunityApplicationId,
    trackerUrl: opportunityApplicationId ? `/applications/${opportunityApplicationId}` : null,
  });
});

export const getMyApplications = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const applications = await Application.find({ userId })
    .populate('jobId', 'title organization province deadline slug')
    .sort({ appliedDate: -1 })
    .lean();

  res.json({
    data: applications.map((a) => ({
      _id: a._id,
      job: a.jobId,
      status: a.status,
      appliedDate: a.appliedDate,
      resumeURL: a.resumeURL,
    })),
  });
});
