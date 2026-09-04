import { asyncHandler } from '../../utils/asyncHandler.js';
import { getInvestorReadiness as buildInvestorReadiness } from '../../services/analytics/InvestorReadinessService.js';
import { boundedInvestorRange } from '../../../../shared/analytics/investorMetrics.js';

export const getInvestorReadiness = asyncHandler(async (req, res) => {
  const requested = Number(req.query.range || 30);
  const range = boundedInvestorRange(requested);
  res.json(await buildInvestorReadiness({ range }));
});
