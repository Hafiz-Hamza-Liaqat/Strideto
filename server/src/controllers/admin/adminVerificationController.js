/**
 * adminVerificationController — Admin/Moderator verification queue and review.
 *
 * Authorization is enforced at the route level (requirePermission).
 * This controller enforces:
 *   - No client-authoritative approval.
 *   - Role-specific action gates (Moderator ≠ Admin ≠ SuperAdmin).
 *   - Reason requirements for destructive actions.
 */
import * as verificationService from '../../services/verificationService.js';
import { listResponse, paginate } from '../../utils/apiResponse.js';
import { hasPermission, PERMISSIONS } from '../../config/rbac.js';

/** Attach request actor for audit. */
function actor(req) {
  return {
    userId: req.user?.userId,
    role: req.user?.role,
    email: req.user?.email,
    realm: 'admin',
    correlationId: req.headers['x-request-id'] || '',
  };
}

export async function getQueue(req, res) {
  try {
    const {
      status,
      organizationType,
      countryCode,
      riskLevel,
      page = '1',
      limit = '20',
    } = req.query;

    const result = await verificationService.getVerificationQueue({
      status: status ? (Array.isArray(status) ? status : [status]) : undefined,
      organizationType,
      countryCode,
      riskLevel,
      page: Math.max(1, parseInt(page, 10) || 1),
      limit: Math.min(100, Math.max(1, parseInt(limit, 10) || 20)),
    });

    return res.json(
      listResponse(
        result.items,
        paginate(result.page, result.limit, result.total)
      )
    );
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

export async function getOrgVerification(req, res) {
  try {
    const { organizationId } = req.params;
    const record = await verificationService.getVerification(organizationId);
    const evidence = await verificationService.getEvidence(organizationId);
    const history = await verificationService.getTransitionHistory(organizationId);
    return res.json({ verification: record, evidence, history });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

export async function beginReview(req, res) {
  try {
    const { organizationId } = req.params;
    const updated = await verificationService.beginReview(organizationId, actor(req));
    return res.json({ verification: updated });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

export async function requestInformation(req, res) {
  try {
    const { organizationId } = req.params;
    const { reason } = req.body;
    const updated = await verificationService.requestInformation(organizationId, reason, actor(req));
    return res.json({ verification: updated });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

export async function escalate(req, res) {
  try {
    const { organizationId } = req.params;
    const { reason } = req.body;
    const updated = await verificationService.escalate(organizationId, actor(req), reason);
    return res.json({ verification: updated });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

export async function approve(req, res) {
  try {
    const { organizationId } = req.params;
    const { reason } = req.body;

    // Server-side gate: VERIFICATION_APPROVE required (Admin+)
    if (!hasPermission(req.user?.role, PERMISSIONS.VERIFICATION_APPROVE)) {
      return res.status(403).json({ error: 'Insufficient permissions to approve' });
    }

    const updated = await verificationService.approve(organizationId, actor(req), reason);
    return res.json({ verification: updated });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

export async function reject(req, res) {
  try {
    const { organizationId } = req.params;
    const { reason } = req.body;

    if (!hasPermission(req.user?.role, PERMISSIONS.VERIFICATION_APPROVE)) {
      return res.status(403).json({ error: 'Insufficient permissions to reject' });
    }

    const updated = await verificationService.reject(organizationId, actor(req), reason);
    return res.json({ verification: updated });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

export async function suspend(req, res) {
  try {
    const { organizationId } = req.params;
    const { reason } = req.body;

    if (!hasPermission(req.user?.role, PERMISSIONS.VERIFICATION_APPROVE)) {
      return res.status(403).json({ error: 'Insufficient permissions to suspend' });
    }

    const updated = await verificationService.suspend(organizationId, actor(req), reason);
    return res.json({ verification: updated });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

export async function unsuspend(req, res) {
  try {
    const { organizationId } = req.params;
    const { reason } = req.body;

    if (!hasPermission(req.user?.role, PERMISSIONS.VERIFICATION_APPROVE)) {
      return res.status(403).json({ error: 'Insufficient permissions to unsuspend' });
    }

    const updated = await verificationService.unsuspend(organizationId, actor(req), reason);
    return res.json({ verification: updated });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

export async function revoke(req, res) {
  try {
    const { organizationId } = req.params;
    const { reason } = req.body;

    // SuperAdmin only — enforced both at route level and here
    if (!hasPermission(req.user?.role, PERMISSIONS.VERIFICATION_REVOKE)) {
      return res.status(403).json({ error: 'Only SuperAdmin may revoke an organization' });
    }

    const updated = await verificationService.revoke(organizationId, actor(req), reason);
    return res.json({ verification: updated });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

export async function reviewEvidence(req, res) {
  try {
    const { organizationId, evidenceId } = req.params;
    const { status, reason } = req.body;
    const updated = await verificationService.reviewEvidence(
      organizationId,
      evidenceId,
      status,
      reason,
      actor(req)
    );
    return res.json({ evidence: updated });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

export async function getTransitionHistory(req, res) {
  try {
    const { organizationId } = req.params;
    const history = await verificationService.getTransitionHistory(organizationId);
    return res.json({ history });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

export async function recordRiskSignal(req, res) {
  try {
    const { organizationId } = req.params;
    const { signal, detail } = req.body;
    const result = await verificationService.recordRiskSignal(
      organizationId,
      signal,
      detail,
      actor(req)
    );
    return res.json(result);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}
