import { OpportunityApplication } from '../models/career/OpportunityApplication.js';
import { mapLegacyApplicationStatus } from '../../../shared/career/migrationMap.js';

/**
 * Best-effort sync Application.status → OpportunityApplication.pipelineStage.
 * Application remains authoritative; failures are logged without blocking employer updates.
 *
 * @returns {Promise<{ ok: boolean, matched?: number, error?: string }>}
 */
export async function syncOpportunityApplicationFromLegacyStatus(application, {
  employerId,
  previousStatus,
  newStatus,
  reason = 'employer_status_update',
} = {}) {
  if (!application?._id) {
    return { ok: false, error: 'missing_application' };
  }
  const fromStage = mapLegacyApplicationStatus(previousStatus);
  const toStage = mapLegacyApplicationStatus(newStatus);
  try {
    const result = await OpportunityApplication.updateOne(
      { legacyApplicationId: application._id },
      {
        $set: { pipelineStage: toStage },
        $push: {
          stageHistory: {
            fromStage,
            toStage,
            at: new Date(),
            byActorType: 'employer',
            byActorId: employerId,
            reason,
          },
        },
      }
    );
    return { ok: true, matched: result.matchedCount };
  } catch (err) {
    const safe = {
      applicationId: String(application._id),
      code: err?.code,
      message: err?.message ? String(err.message).slice(0, 120) : 'sync_failed',
    };
    console.warn('[employer] OpportunityApplication sync failed', safe);
    return { ok: false, error: safe.message };
  }
}
