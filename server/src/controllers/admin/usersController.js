import crypto from 'crypto';
import { User } from '../../models/User.js';
import { Employer } from '../../models/Employer.js';
import { Job } from '../../models/Job.js';
import { Application } from '../../models/Application.js';
import { AuditLog } from '../../models/AuditLog.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { listResponse, paginate } from '../../utils/apiResponse.js';
import { getPermissionsForRole, STAFF_ROLES } from '../../config/rbac.js';
import { getEffectivePermissions, getEffectiveRoles } from '../../services/workflow/PermissionService.js';
import { logAudit, auditFromRequest } from '../../services/auditService.js';
import { onEmployerVerificationChange, queueEmail } from '../../services/automationService.js';
import { sanitizeString } from '../../utils/sanitize.js';
import { validIds } from '../../utils/adminBulkHelper.js';
import { revokeRefreshToken } from '../../utils/tokenStore.js';
import { secureAuthConfig } from '../../services/auth/secureAuthConfig.js';
import { userSecureAuthFlows } from '../../services/auth/userSecureAuthFlows.js';
import { employerSecureAuthFlows } from '../../services/auth/employerSecureAuthFlows.js';

const SUBJECT_STATE_MUTATION_OK = new Set(['SUBJECT_STATE_UPDATED', 'SUBJECT_STATE_ALREADY_APPLIED']);

const ASSIGNABLE_ROLES = ['User', 'Editor', 'Moderator', 'Admin', 'SuperAdmin'];

async function countSuperAdmins(excludeId = null) {
  const filter = { role: 'SuperAdmin' };
  if (excludeId) filter._id = { $ne: excludeId };
  return User.countDocuments(filter);
}

export const listUsers = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, parseInt(req.query.limit, 10) || 20);
  const skip = (page - 1) * limit;
  const filter = {};

  if (req.query.role) filter.role = req.query.role;
  if (req.query.accountStatus) filter.accountStatus = req.query.accountStatus;
  if (req.query.status) filter.accountStatus = req.query.status;
  if (req.query.province) filter.province = new RegExp(req.query.province, 'i');
  if (req.query.search) {
    const re = new RegExp(req.query.search, 'i');
    filter.$or = [{ email: re }, { name: re }];
  }
  if (req.query.from || req.query.to) {
    filter.createdAt = {};
    if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
    if (req.query.to) filter.createdAt.$lte = new Date(req.query.to);
  }

  const [data, total] = await Promise.all([
    User.find(filter).select('-password -refreshToken').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);

  res.json(listResponse(data, paginate(page, limit, total), req.query));
});

export const getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('-password -refreshToken').lean();
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

export const updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const body = req.body || {};
  const user = await User.findById(id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const before = user.toObject();
  delete before.password;

  let accountStatusChanged = null;
  if (body.accountStatus !== undefined) {
    if (!['active', 'suspended'].includes(body.accountStatus)) {
      return res.status(400).json({ error: 'Invalid account status' });
    }
    if (user.role === 'SuperAdmin' && body.accountStatus === 'suspended') {
      return res.status(403).json({ error: 'Cannot suspend Super Admin' });
    }
    if (body.accountStatus !== user.accountStatus) {
      if (secureAuthConfig.enabled) {
        // SEC-3E — routed through the SEC-3D.2/SEC-3D.1 primitives so the
        // mutation is atomic and tokenVersion-bumped/session-swept
        // correctly; the account-status field itself is never written
        // independently by this document's own `.save()` below.
        const result =
          body.accountStatus === 'suspended'
            ? await userSecureAuthFlows.suspendUser({ subjectId: id })
            : await userSecureAuthFlows.reactivateUser({ subjectId: id });
        if (!SUBJECT_STATE_MUTATION_OK.has(result.code)) {
          return res.status(503).json({ error: 'Could not update account status' });
        }
      } else {
        user.accountStatus = body.accountStatus;
      }
      accountStatusChanged = body.accountStatus;
    }
  }
  if (body.name !== undefined) user.name = sanitizeString(body.name);
  if (body.province !== undefined) user.province = sanitizeString(body.province);
  if (body.emailVerified !== undefined) user.emailVerified = !!body.emailVerified;

  await user.save({ validateBeforeSave: false });
  const after = user.toObject();
  if (accountStatusChanged) after.accountStatus = accountStatusChanged;
  delete after.password;

  await logAudit({
    ...auditFromRequest(req),
    action: 'user.update',
    targetType: 'user',
    targetId: id,
    targetLabel: user.email,
    before,
    after,
    reason: body.reason || '',
  });

  res.json({ user: after });
});

export const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = await User.findById(id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.role === 'SuperAdmin') {
    const superCount = await countSuperAdmins();
    if (superCount <= 1) {
      return res.status(403).json({ error: 'Cannot delete the only Super Admin' });
    }
  }
  if (String(user._id) === String(req.user.userId)) {
    return res.status(403).json({ error: 'Cannot delete your own account' });
  }

  await logAudit({
    ...auditFromRequest(req),
    action: 'user.delete',
    targetType: 'user',
    targetId: id,
    targetLabel: user.email,
    before: { email: user.email, role: user.role },
    reason: req.body?.reason || '',
  });

  await User.findByIdAndDelete(id);
  res.status(204).send();
});

export const adminResetPassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('+password');
  if (!user) return res.status(404).json({ error: 'User not found' });

  const tempPassword = crypto.randomBytes(8).toString('base64url').slice(0, 12);
  const tempExpires = new Date(Date.now() + 72 * 60 * 60 * 1000);
  user.password = tempPassword;
  user.mustChangePassword = true;
  user.tempPasswordExpires = tempExpires;
  await user.save();
  // RC-1: invalidate existing sessions after admin password reset
  await revokeRefreshToken(String(user._id));

  const loginUrl = `${(process.env.FRONTEND_URL || process.env.SITE_URL || 'http://localhost:5173').replace(/\/$/, '')}/auth/login`;
  const { isSmtpConfigured } = await import('../../services/emailService.js');
  await queueEmail({
    to: user.email,
    templateKey: 'temporaryPassword',
    vars: {
      name: user.name,
      tempPassword,
      expiresAt: tempExpires.toLocaleString('en-PK'),
      loginUrl,
    },
    dedupKey: `temp_password:${user._id}:${Date.now()}`,
  });

  const emailMeta = isSmtpConfigured()
    ? { emailQueued: true, emailMode: 'live' }
    : { emailQueued: true, emailMode: 'placeholder', emailNotice: 'Email queued (SMTP not configured)' };

  await logAudit({
    ...auditFromRequest(req),
    action: 'user.reset_password',
    targetType: 'user',
    targetId: user._id,
    targetLabel: user.email,
    reason: req.body?.reason || 'Admin reset',
    metadata: { tempPasswordExpires: tempExpires, ...emailMeta },
  });

  res.json({
    message: 'Temporary password set and emailed',
    temporaryPassword: tempPassword,
    expiresAt: tempExpires,
    mustChangePassword: true,
    ...emailMeta,
  });
});

export const bulkAssignRole = asyncHandler(async (req, res) => {
  const { ids = [], role } = req.body || {};
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'ids required' });
  if (!ASSIGNABLE_ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role' });
  if (role === 'SuperAdmin' && req.user.role !== 'SuperAdmin') {
    return res.status(403).json({ error: 'Only Super Admin can assign Super Admin role' });
  }

  const users = await User.find({ _id: { $in: ids } });
  let updated = 0;
  for (const user of users) {
    const prev = user.role;
    if (prev === role) continue;
    if (prev === 'SuperAdmin' && role !== 'SuperAdmin') {
      const superCount = await countSuperAdmins(user._id);
      if (superCount < 1) continue;
    }
    if (secureAuthConfig.enabled) {
      const result = await userSecureAuthFlows.changeUserRole({
        subjectId: user._id.toString(),
        expectedPriorRole: prev,
        newRole: role,
      });
      if (!SUBJECT_STATE_MUTATION_OK.has(result.code)) continue;
    } else {
      user.role = role;
      await user.save({ validateBeforeSave: false });
    }
    updated += 1;
    await logAudit({
      ...auditFromRequest(req),
      action: 'user.role_change',
      targetType: 'user',
      targetId: user._id,
      targetLabel: user.email,
      metadata: { from: prev, to: role },
      reason: req.body?.reason || 'Bulk role assignment',
    });
  }

  res.json({ updated, total: ids.length });
});

export const getUserActivity = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, parseInt(req.query.limit, 10) || 20);
  const skip = (page - 1) * limit;

  const filter = {
    $or: [{ actorId: id }, { targetId: String(id), targetType: 'user' }],
  };

  const [data, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ]);

  res.json(listResponse(data, paginate(page, limit, total), req.query));
});

export const listEmployers = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, parseInt(req.query.limit, 10) || 20);
  const skip = (page - 1) * limit;
  const filter = {};

  if (req.query.verified === 'true') filter.verified = true;
  if (req.query.verified === 'false') filter.verified = false;
  if (req.query.accountStatus) filter.accountStatus = req.query.accountStatus;
  if (req.query.search) {
    const re = new RegExp(req.query.search, 'i');
    filter.$or = [{ companyName: re }, { email: re }, { industry: re }];
  }

  const [data, total] = await Promise.all([
    Employer.find(filter).select('-password').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Employer.countDocuments(filter),
  ]);

  res.json(listResponse(data, paginate(page, limit, total), req.query));
});

export const getEmployer = asyncHandler(async (req, res) => {
  const employer = await Employer.findById(req.params.id).select('-password').lean();
  if (!employer) return res.status(404).json({ error: 'Employer not found' });
  const [jobCount, applicationCount] = await Promise.all([
    Job.countDocuments({ employerId: req.params.id }),
    Application.countDocuments({ employerId: req.params.id }),
  ]);
  res.json({ ...employer, stats: { jobCount, applicationCount } });
});

export const getEmployerJobs = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, parseInt(req.query.limit, 10) || 20);
  const skip = (page - 1) * limit;
  const filter = { employerId: req.params.id };
  const [data, total] = await Promise.all([
    Job.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Job.countDocuments(filter),
  ]);
  res.json(listResponse(data, paginate(page, limit, total), req.query));
});

export const updateEmployer = asyncHandler(async (req, res) => {
  const employer = await Employer.findById(req.params.id);
  if (!employer) return res.status(404).json({ error: 'Employer not found' });
  const body = req.body || {};
  const before = { verified: employer.verified, accountStatus: employer.accountStatus, verificationLevel: employer.verificationLevel };
  let accountStatusChanged = null;
  if (body.accountStatus !== undefined && ['active', 'suspended'].includes(body.accountStatus)) {
    if (body.accountStatus !== employer.accountStatus) {
      if (secureAuthConfig.enabled) {
        const result =
          body.accountStatus === 'suspended'
            ? await employerSecureAuthFlows.suspendEmployer({ subjectId: employer._id.toString() })
            : await employerSecureAuthFlows.reactivateEmployer({ subjectId: employer._id.toString() });
        if (!SUBJECT_STATE_MUTATION_OK.has(result.code)) {
          return res.status(503).json({ error: 'Could not update account status' });
        }
      } else {
        employer.accountStatus = body.accountStatus;
      }
      accountStatusChanged = body.accountStatus;
    }
  }
  if (body.verified !== undefined) employer.verified = !!body.verified;
  if (body.verificationLevel !== undefined) employer.verificationLevel = body.verificationLevel;
  if (body.companyName !== undefined) employer.companyName = sanitizeString(body.companyName);
  await employer.save({ validateBeforeSave: false });
  if (accountStatusChanged) employer.accountStatus = accountStatusChanged;
  const verificationChanged =
    before.verified !== employer.verified || before.verificationLevel !== employer.verificationLevel;
  if (verificationChanged) {
    onEmployerVerificationChange({
      employerId: employer._id,
      verificationLevel: employer.verificationLevel || (employer.verified ? 'verified' : 'basic'),
      companyName: employer.companyName,
    }).catch(() => {});
  }
  await logAudit({
    ...auditFromRequest(req),
    action: 'employer.update',
    targetType: 'employer',
    targetId: employer._id,
    targetLabel: employer.companyName,
    before,
    after: { verified: employer.verified, accountStatus: employer.accountStatus, verificationLevel: employer.verificationLevel },
    reason: body.reason || '',
  });
  const out = employer.toObject();
  delete out.password;
  res.json(out);
});

export const bulkVerifyEmployers = asyncHandler(async (req, res) => {
  const ids = validIds(req.body?.ids);
  if (!ids.length) return res.status(400).json({ error: 'ids required' });
  const level = req.body?.verificationLevel || 'verified';
  const result = await Employer.updateMany(
    { _id: { $in: ids } },
    { $set: { verified: true, verificationLevel: level } }
  );
  const employers = await Employer.find({ _id: { $in: ids } }).select('_id companyName verificationLevel').lean();
  for (const emp of employers) {
    onEmployerVerificationChange({
      employerId: emp._id,
      verificationLevel: emp.verificationLevel || level,
      companyName: emp.companyName,
    }).catch(() => {});
  }
  await logAudit({
    ...auditFromRequest(req),
    action: 'employer.bulk_verify',
    targetType: 'employer',
    metadata: { ids, modified: result.modifiedCount, verificationLevel: level },
  });
  res.json({ affected: result.modifiedCount });
});

export const bulkSuspendEmployers = asyncHandler(async (req, res) => {
  const ids = validIds(req.body?.ids);
  if (!ids.length) return res.status(400).json({ error: 'ids required' });
  const status = req.body?.accountStatus || 'suspended';

  if (secureAuthConfig.enabled && ['active', 'suspended'].includes(status)) {
    // SEC-3E — bounded per-subject calls (no unbounded retry, no silent
    // skip): every id is attempted exactly once via the SEC-3D.2/SEC-3D.1
    // primitives; failures are counted, not hidden.
    let modified = 0;
    let failed = 0;
    for (const id of ids) {
      const result =
        status === 'suspended'
          ? await employerSecureAuthFlows.suspendEmployer({ subjectId: id })
          : await employerSecureAuthFlows.reactivateEmployer({ subjectId: id });
      if (SUBJECT_STATE_MUTATION_OK.has(result.code)) {
        modified += 1;
      } else {
        failed += 1;
      }
    }
    await logAudit({
      ...auditFromRequest(req),
      action: 'employer.bulk_suspend',
      targetType: 'employer',
      metadata: { ids, modified, failed, accountStatus: status },
      reason: req.body?.reason || '',
    });
    return res.json({ affected: modified, failed });
  }

  const result = await Employer.updateMany({ _id: { $in: ids } }, { $set: { accountStatus: status } });
  await logAudit({
    ...auditFromRequest(req),
    action: 'employer.bulk_suspend',
    targetType: 'employer',
    metadata: { ids, modified: result.modifiedCount, accountStatus: status },
    reason: req.body?.reason || '',
  });
  res.json({ affected: result.modifiedCount });
});

export const assignRole = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { role } = req.body || {};
  if (!ASSIGNABLE_ROLES.includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  if (role === 'SuperAdmin' && req.user.role !== 'SuperAdmin') {
    return res.status(403).json({ error: 'Only Super Admin can assign Super Admin role' });
  }
  const user = await User.findById(id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (user.role === 'SuperAdmin' && role !== 'SuperAdmin') {
    const superCount = await countSuperAdmins(user._id);
    if (superCount < 1) {
      return res.status(403).json({ error: 'Cannot demote the only Super Admin' });
    }
  }

  const prev = user.role;
  if (prev !== role) {
    if (secureAuthConfig.enabled) {
      const result = await userSecureAuthFlows.changeUserRole({
        subjectId: user._id.toString(),
        expectedPriorRole: prev,
        newRole: role,
      });
      if (!SUBJECT_STATE_MUTATION_OK.has(result.code)) {
        return res.status(503).json({ error: 'Could not update role' });
      }
    } else {
      user.role = role;
      await user.save({ validateBeforeSave: false });
    }
  }
  await logAudit({
    ...auditFromRequest(req),
    action: 'user.role_change',
    targetType: 'user',
    targetId: id,
    targetLabel: user.email,
    metadata: { from: prev, to: role },
    reason: req.body?.reason || '',
  });
  res.json({ user: { _id: user._id, email: user.email, role, permissions: getPermissionsForRole(role) } });
});

export const getMyPermissions = asyncHandler(async (req, res) => {
  const role = req.user?.role;
  const userId = req.user?.userId;
  const [permissions, roles] = await Promise.all([
    getEffectivePermissions(userId, role),
    getEffectiveRoles(userId, role),
  ]);
  res.json({
    role,
    roles,
    permissions,
    isStaff: STAFF_ROLES.includes(role),
  });
});
