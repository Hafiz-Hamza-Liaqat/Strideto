import { asyncHandler } from '../../utils/asyncHandler.js';
import { buildSeoMeasurementDashboard, importManualSeoSnapshot } from '../../services/seo/measurement/seoMeasurementService.js';
import { logAudit } from '../../services/auditService.js';

export const getSeoMeasurementDashboard = asyncHandler(async (req, res) => {
  const range = ['7d', '28d', '90d'].includes(req.query.range) ? req.query.range : '28d';
  const data = await buildSeoMeasurementDashboard(range);
  res.json(data);
});

export const postManualSeoSnapshot = asyncHandler(async (req, res) => {
  const doc = await importManualSeoSnapshot(req.body || {});
  await logAudit({
    actorId: req.user?.userId,
    action: 'seo.manual_snapshot_import',
    targetType: 'SeoMetricsSnapshot',
    targetId: String(doc._id),
    metadata: {
      provider: doc.provider,
      dataset: doc.dataset,
    },
  });
  res.status(201).json(doc);
});
