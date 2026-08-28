import mongoose from 'mongoose';
import { Employer } from '../models/Employer.js';

/**
 * Batch-fetch sanitized employer logo URLs for public job projection.
 * Only logoUrl is selected — no private employer profile fields.
 */
export async function fetchEmployerLogoMap(employerIds) {
  const unique = [...new Set(
    (employerIds || [])
      .filter(Boolean)
      .map((id) => String(id)),
  )];
  if (!unique.length) return new Map();

  const objectIds = unique
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
  if (!objectIds.length) return new Map();

  const employers = await Employer.find({ _id: { $in: objectIds } })
    .select('logoUrl')
    .lean();

  const map = new Map();
  for (const emp of employers) {
    map.set(String(emp._id), emp.logoUrl || '');
  }
  return map;
}

export function employerLogoForJob(job, logoMap) {
  if (!job?.employerId || !logoMap) return null;
  return logoMap.get(String(job.employerId)) ?? null;
}

/** Attach _employerLogoUrl on job rows that need employer fallback at projection time. */
export function attachEmployerLogos(jobs, logoMap) {
  if (!Array.isArray(jobs) || !logoMap?.size) return jobs;
  return jobs.map((job) => {
    const logo = employerLogoForJob(job, logoMap);
    if (!logo) return job;
    return { ...job, _employerLogoUrl: logo };
  });
}

/** Collect employerIds from jobs that may need logo fallback. */
export function collectEmployerIdsForLogoFallback(jobs) {
  const ids = [];
  for (const job of jobs || []) {
    if ((job.source === 'employer' || job.employerId) && !job.logoUrl && job.employerId) {
      ids.push(job.employerId);
    }
  }
  return ids;
}
