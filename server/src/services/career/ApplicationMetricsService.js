import { TERMINAL_PIPELINE_STAGES, PIPELINE_STAGES } from '../../../../shared/career/constants.js';
import { OpportunityApplicationRepository } from '../../repositories/career/OpportunityApplicationRepository.js';
import { isInternalEmployerApplication } from '../../../../shared/career/applicationAuthority.js';

/**
 * Lightweight tracker metrics for the signed-in user (C.8.1).
 */
export const ApplicationMetricsService = {
  async getForUser(userId) {
    const apps = await OpportunityApplicationRepository.findActiveByUserAll(userId);
    const byStage = Object.fromEntries(PIPELINE_STAGES.map((s) => [s, 0]));
    let interviewsScheduled = 0;
    let offersReceived = 0;
    let appliedOrBeyond = 0;
    let viewedOrBeyond = 0;
    let completed = 0;
    let closed = 0;

    const appliedIndex = PIPELINE_STAGES.indexOf('applied');
    const viewedIndex = PIPELINE_STAGES.indexOf('viewed');

    for (const app of apps) {
      const stage = app.pipelineStage;
      if (byStage[stage] != null) byStage[stage] += 1;

      const internal = isInternalEmployerApplication(app);
      if (internal && (stage === 'interview' || app.interview?.scheduledAt)) interviewsScheduled += 1;
      else if (!internal && app.interview?.scheduledAt) interviewsScheduled += 1;
      if (
        internal &&
        (stage === 'offer' || stage === 'negotiation' || stage === 'accepted' || stage === 'joined')
      ) {
        offersReceived += 1;
      }

      const idx = PIPELINE_STAGES.indexOf(stage);
      if (idx >= appliedIndex) appliedOrBeyond += 1;
      if (idx >= viewedIndex && !TERMINAL_PIPELINE_STAGES.includes(stage)) viewedOrBeyond += 1;
      if (TERMINAL_PIPELINE_STAGES.includes(stage) || stage === 'accepted') {
        closed += 1;
        if (stage === 'joined' || stage === 'accepted') completed += 1;
      }
    }

    const active = apps.filter((a) => !TERMINAL_PIPELINE_STAGES.includes(a.pipelineStage)).length;
    const responseRate = appliedOrBeyond === 0 ? 0 : Math.round((viewedOrBeyond / appliedOrBeyond) * 100);
    const completionRate = closed === 0 ? 0 : Math.round((completed / closed) * 100);

    return {
      total: apps.length,
      active,
      interviewsScheduled,
      offersReceived,
      responseRate,
      completionRate,
      byStage,
      updatedAt: new Date().toISOString(),
    };
  },
};
