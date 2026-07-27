import mongoose from 'mongoose';
import { Application } from '../models/Application.js';

/**
 * Normalize job apply mode for employer-facing APIs.
 * @param {object} job
 * @returns {'internal'|'external'}
 */
export function resolveJobApplyType(job = {}) {
  if (job.applyType === 'internal' || job.applyType === 'external') return job.applyType;
  if (job.applicationLink || job.applyEmail) return 'external';
  return 'internal';
}

/**
 * Batch live Application counts for owned jobs (internal only).
 * @param {import('mongoose').Types.ObjectId[]|string[]} jobIds
 * @returns {Promise<Map<string, number>>}
 */
export async function countApplicationsByJobIds(jobIds) {
  const ids = (jobIds || [])
    .map((id) => {
      try {
        return new mongoose.Types.ObjectId(id);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  const map = new Map();
  if (!ids.length) return map;

  const rows = await Application.aggregate([
    { $match: { jobId: { $in: ids } } },
    { $group: { _id: '$jobId', count: { $sum: 1 } } },
  ]);

  for (const row of rows) {
    map.set(String(row._id), row.count);
  }
  return map;
}

/**
 * Enrich lean job documents with truthful application tracking fields.
 * @param {object[]} jobs
 */
export async function enrichEmployerJobsWithApplicationCounts(jobs) {
  const list = Array.isArray(jobs) ? jobs : [];
  const internalIds = list
    .filter((j) => resolveJobApplyType(j) === 'internal')
    .map((j) => j._id);

  const counts = await countApplicationsByJobIds(internalIds);

  return list.map((j) => {
    const applyType = resolveJobApplyType(j);
    const tracked = applyType === 'internal';
    const live = tracked ? counts.get(String(j._id)) ?? 0 : null;
    return {
      ...j,
      applyType,
      applicationsTracked: tracked,
      submittedApplicationsCount: live,
      // Keep stored field for backward compat; UI should prefer submittedApplicationsCount
      applicationsCount: tracked ? live : j.applicationsCount ?? 0,
    };
  });
}
