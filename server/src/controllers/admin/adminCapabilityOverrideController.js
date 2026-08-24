import { getOverrideService } from '../../services/capability/overrideRuntime.js';
import { VerificationCapabilityOverride } from '../../models/VerificationCapabilityOverride.js';
import { OrganizationVerification } from '../../models/OrganizationVerification.js';
import { VerificationEvidence } from '../../models/VerificationEvidence.js';
import { ROLES } from '../../config/rbac.js';

export async function getOverrideStatus(req, res) {
  try {
    const { organizationId } = req.params;
    const [override, verification, evidence] = await Promise.all([
      VerificationCapabilityOverride.findOne({ organizationId })
        .sort({ grantedAt: -1 })
        .lean(),
      OrganizationVerification.findOne({ organizationId })
        .select('status organizationType earnedBadges')
        .lean(),
      VerificationEvidence.find({ organizationId })
        .select('evidenceType status submittedAt')
        .lean(),
    ]);
    res.json({
      override: override || null,
      verificationStatus: verification?.status || null,
      organizationType: verification?.organizationType || null,
      earnedBadges: verification?.earnedBadges || [],
      evidenceSummary: evidence.map((e) => ({
        evidenceType: e.evidenceType,
        status: e.status,
        submittedAt: e.submittedAt,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function grantOverride(req, res) {
  try {
    if (req.user?.role !== ROLES.SUPER_ADMIN) {
      return res.status(403).json({ error: 'Super Admin access required' });
    }
    const { organizationId } = req.params;
    const { overrideType, reason, capabilities, expiresAt } = req.body;
    const svc = getOverrideService();
    const result = await svc.grantOverride({
      actorId: req.user.userId,
      actorRole: req.user.role,
      organizationId,
      overrideType,
      reason,
      capabilities,
      expiresAt: expiresAt || null,
    });
    res.json({ override: result });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, code: err.code });
  }
}

export async function revokeOverride(req, res) {
  try {
    if (req.user?.role !== ROLES.SUPER_ADMIN) {
      return res.status(403).json({ error: 'Super Admin access required' });
    }
    const { organizationId } = req.params;
    const { reason } = req.body;
    const svc = getOverrideService();
    const result = await svc.revokeOverride({
      actorId: req.user.userId,
      actorRole: req.user.role,
      organizationId,
      reason,
    });
    res.json({ override: result });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, code: err.code });
  }
}
