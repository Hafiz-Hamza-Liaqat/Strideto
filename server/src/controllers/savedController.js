import { User } from '../models/User.js';
import { Job } from '../models/Job.js';
import { Scholarship } from '../models/Scholarship.js';
import { Admission } from '../models/Admission.js';
import { Internship } from '../models/Internship.js';
import { IntlScholarship } from '../models/IntlScholarship.js';
import mongoose from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler.js';
import { projectSavedRecord } from '../../../shared/publicDiscovery/projectSavedListing.js';
import {
  projectPublicJobListItem,
  projectPublicCmsScholarship,
  projectPublicCmsAdmission,
  projectPublicInternship,
} from '../../../shared/publicDiscovery/projectPublicDiscovery.js';
import {
  attachEmployerLogos,
  collectEmployerIdsForLogoFallback,
  fetchEmployerLogoMap,
} from '../utils/employerLogoProjection.js';

const COLLECTION_MAP = {
  jobs: { Model: Job, field: 'savedJobs' },
  scholarships: { Model: Scholarship, field: 'savedScholarships' },
  admissions: { Model: Admission, field: 'savedAdmissions' },
  internships: { Model: Internship, field: 'savedInternships' },
  intl_scholarships: { Model: IntlScholarship, field: 'savedIntlScholarships' },
};

async function toggleSaved(userId, collection, id, add) {
  const oid = mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : null;
  if (!oid) return { found: false };
  const config = COLLECTION_MAP[collection];
  if (!config) return { found: false };
  const doc = await config.Model.findOne({ _id: oid, status: 'active' });
  if (!doc) return { found: false };
  const user = await User.findById(userId);
  if (!user) return { found: false };
  const field = config.field;
  let arr = user[field] || [];
  if (add) {
    if (arr.some((x) => x.toString() === oid.toString())) return { found: true, saved: true };
    arr.push(oid);
  } else {
    arr = arr.filter((x) => x.toString() !== oid.toString());
  }
  user[field] = arr;
  await user.save();
  return { found: true, saved: add };
}

export const saveJob = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await toggleSaved(req.user.userId, 'jobs', id, true);
  if (!result.found) return res.status(404).json({ error: 'Job not found' });
  res.json({ saved: true });
});

export const unsaveJob = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await toggleSaved(req.user.userId, 'jobs', id, false);
  res.json({ saved: false });
});

export const saveScholarship = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await toggleSaved(req.user.userId, 'scholarships', id, true);
  if (!result.found) return res.status(404).json({ error: 'Scholarship not found' });
  res.json({ saved: true });
});

export const unsaveScholarship = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await toggleSaved(req.user.userId, 'scholarships', id, false);
  res.json({ saved: false });
});

export const saveAdmission = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await toggleSaved(req.user.userId, 'admissions', id, true);
  if (!result.found) return res.status(404).json({ error: 'Admission not found' });
  res.json({ saved: true });
});

export const unsaveAdmission = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await toggleSaved(req.user.userId, 'admissions', id, false);
  res.json({ saved: false });
});

export const saveInternship = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await toggleSaved(req.user.userId, 'internships', id, true);
  if (!result.found) return res.status(404).json({ error: 'Internship not found' });
  res.json({ saved: true });
});

export const unsaveInternship = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await toggleSaved(req.user.userId, 'internships', id, false);
  res.json({ saved: false });
});

export const saveIntlScholarship = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await toggleSaved(req.user.userId, 'intl_scholarships', id, true);
  if (!result.found) return res.status(404).json({ error: 'Scholarship not found' });
  res.json({ saved: true });
});

export const unsaveIntlScholarship = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await toggleSaved(req.user.userId, 'intl_scholarships', id, false);
  res.json({ saved: false });
});

export const getSaved = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.userId)
    .populate('savedJobs')
    .populate('savedScholarships')
    .populate('savedAdmissions')
    .populate('savedInternships')
    .populate('savedIntlScholarships')
    .lean();
  if (!user) return res.status(404).json({ error: 'User not found' });
  const savedJobRows = (user.savedJobs || []).filter(Boolean);
  const jobLogoMap = await fetchEmployerLogoMap(collectEmployerIdsForLogoFallback(savedJobRows));
  const savedJobsWithLogos = attachEmployerLogos(savedJobRows, jobLogoMap);
  const identityOnly = (doc) => ({
    _id: doc?._id,
    title: doc?.title || doc?.name || '',
    slug: doc?.slug,
    provider: doc?.provider,
    organization: doc?.organization || doc?.company,
  });
  res.json({
    savedJobs: savedJobsWithLogos
      .map((j) => projectSavedRecord(j, projectPublicJobListItem)),
    savedScholarships: (user.savedScholarships || [])
      .filter(Boolean)
      .map((s) => projectSavedRecord(s, projectPublicCmsScholarship)),
    savedAdmissions: (user.savedAdmissions || [])
      .filter(Boolean)
      .map((a) => projectSavedRecord(a, projectPublicCmsAdmission)),
    savedInternships: (user.savedInternships || [])
      .filter(Boolean)
      .map((i) => projectSavedRecord(i, projectPublicInternship)),
    savedIntlScholarships: (user.savedIntlScholarships || [])
      .filter(Boolean)
      .map((s) => projectSavedRecord(s, identityOnly)),
  });
});
