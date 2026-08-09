/**
 * Canonical editorial workflow service (C.7.0.6).
 */
import { EditorialWorkflow } from '../../models/EditorialWorkflow.js';
import { EditorialComment } from '../../models/EditorialComment.js';
import { canTransitionWorkflow } from '../../../../shared/workflow/states.js';
import { validateWorkflowTransition } from '../../../../shared/workflow/validation.js';
import { logAudit } from '../auditService.js';
import { canPerformAction } from './PermissionService.js';
import {
  syncEntityPublishState,
  inferWorkflowStatusFromEntity,
  fetchEntityTitle,
} from './workflowEntitySync.js';
import {
  notifyReviewAssigned,
  notifyWorkflowStatus,
  notifyScheduledPublish,
  notifyPublishCompleted,
} from './EditorialNotificationService.js';
import { enqueueJob } from '../jobQueueService.js';
import { User } from '../../models/User.js';

function actorFromUser(user) {
  return {
    userId: user.userId || user._id,
    role: user.role,
    email: user.email,
    name: user.name,
    permissions: user.permissions,
  };
}

export async function getOrCreateWorkflow(entityType, entityId, defaults = {}) {
  const locale = defaults.locale || 'en';
  let wf = await EditorialWorkflow.findOne({ entityType, entityId, locale });
  if (!wf && locale === 'en') {
    wf = await EditorialWorkflow.findOne({ entityType, entityId, locale: { $exists: false } });
    if (wf) {
      wf.locale = 'en';
      await wf.save();
    }
  }
  if (wf) return wf;

  const inferred = await inferWorkflowStatusFromEntity(entityType, entityId);
  const title = defaults.title || (await fetchEntityTitle(entityType, entityId));
  wf = await EditorialWorkflow.create({
    entityType,
    entityId: String(entityId),
    locale,
    status: defaults.status || inferred,
    title,
    ...defaults,
  });
  return wf;
}

export async function getWorkflow(entityType, entityId, locale = 'en') {
  return EditorialWorkflow.findOne({ entityType, entityId: String(entityId), locale }).lean();
}

async function transitionWorkflow(wf, toStatus, actor, options = {}) {
  const from = wf.status;
  const errors = validateWorkflowTransition({ from, to: toStatus, resource: wf.entityType });
  if (errors.length) {
    const err = new Error(errors.join('; '));
    err.status = 400;
    throw err;
  }

  const actionMap = {
    in_review: 'review',
    changes_requested: 'review',
    approved: 'approve',
    scheduled: 'schedule',
    published: 'publish',
    archived: 'delete',
    draft: 'edit',
  };
  const action = actionMap[toStatus] || 'edit';
  const allowed = await canPerformAction(actorFromUser(actor), wf.entityType, action);
  if (!allowed && toStatus !== 'draft') {
    const err = new Error(`Permission denied for ${action} on ${wf.entityType}`);
    err.status = 403;
    throw err;
  }

  if (!canTransitionWorkflow(from, toStatus) && !(options.force && actor.role === 'SuperAdmin')) {
    const err = new Error(`Invalid transition: ${from} → ${toStatus}`);
    err.status = 400;
    throw err;
  }

  const before = wf.toObject();
  wf.status = toStatus;
  wf.lastActionAt = new Date();
  wf.lastActionBy = actor.userId || actor._id;
  wf.lastActionByEmail = actor.email || '';

  if (toStatus === 'in_review') {
    wf.submittedAt = wf.submittedAt || new Date();
    wf.reviewRound = (wf.reviewRound || 0) + (from === 'changes_requested' || from === 'draft' ? 1 : 0);
  }
  if (toStatus === 'approved') wf.approvedAt = new Date();
  if (toStatus === 'published') {
    wf.publishedAt = new Date();
    wf.scheduledPublishAt = undefined;
    await syncEntityPublishState(wf.entityType, wf.entityId, 'published');
  }
  if (toStatus === 'archived') {
    wf.archivedAt = new Date();
    await syncEntityPublishState(wf.entityType, wf.entityId, 'archived');
  }
  if (toStatus === 'changes_requested' && options.reason) {
    wf.rejectionReason = options.reason;
  }

  await wf.save();

  await logAudit({
    actor,
    action: `workflow_${toStatus}`,
    targetType: wf.entityType,
    targetId: wf.entityId,
    targetLabel: wf.title,
    before: { status: before.status },
    after: { status: toStatus },
    reason: options.reason || '',
    metadata: { reviewRound: wf.reviewRound },
  });

  if (options.notifyUserId) {
    await notifyWorkflowStatus({
      userId: options.notifyUserId,
      email: options.notifyEmail,
      entityType: wf.entityType,
      entityId: wf.entityId,
      title: wf.title,
      status: toStatus,
      reason: options.reason,
    });
  }

  if (toStatus === 'published' && options.notifyUserId) {
    await notifyPublishCompleted({
      userId: options.notifyUserId,
      email: options.notifyEmail,
      entityType: wf.entityType,
      entityId: wf.entityId,
      title: wf.title,
    });
  }

  return wf;
}

export async function submitForReview(entityType, entityId, actor, options = {}) {
  const wf = await getOrCreateWorkflow(entityType, entityId, { title: options.title });
  return transitionWorkflow(wf, 'in_review', actor, options);
}

export async function assignReviewer(entityType, entityId, reviewerId, actor) {
  const wf = await getOrCreateWorkflow(entityType, entityId);
  const reviewer = await User.findById(reviewerId).select('email name').lean();
  if (!reviewer) {
    const err = new Error('Reviewer not found');
    err.status = 404;
    throw err;
  }

  wf.assignedReviewerId = reviewerId;
  wf.assignedReviewerEmail = reviewer.email || '';
  if (wf.status === 'draft') wf.status = 'in_review';
  wf.lastActionAt = new Date();
  wf.lastActionBy = actor.userId || actor._id;
  await wf.save();

  await logAudit({
    actor,
    action: 'workflow_assign_reviewer',
    targetType: entityType,
    targetId: entityId,
    targetLabel: wf.title,
    metadata: { reviewerId, reviewerEmail: reviewer.email },
  });

  await notifyReviewAssigned({
    reviewerId,
    reviewerEmail: reviewer.email,
    entityType,
    entityId,
    title: wf.title,
    assignerEmail: actor.email,
  });

  return wf;
}

export async function approveContent(entityType, entityId, actor, options = {}) {
  const wf = await getOrCreateWorkflow(entityType, entityId);
  return transitionWorkflow(wf, options.publish ? 'published' : 'approved', actor, options);
}

export async function rejectContent(entityType, entityId, actor, reason = '') {
  const wf = await getOrCreateWorkflow(entityType, entityId);
  return transitionWorkflow(wf, 'changes_requested', actor, { reason, notifyUserId: wf.lastActionBy });
}

export async function requestChanges(entityType, entityId, actor, reason = '') {
  return rejectContent(entityType, entityId, actor, reason);
}

export async function schedulePublish(entityType, entityId, actor, { scheduledPublishAt, timezone, scheduledArchiveAt }) {
  const wf = await getOrCreateWorkflow(entityType, entityId);
  wf.scheduledPublishAt = new Date(scheduledPublishAt);
  wf.timezone = timezone || wf.timezone || 'UTC';
  if (scheduledArchiveAt) wf.scheduledArchiveAt = new Date(scheduledArchiveAt);
  wf.status = 'scheduled';
  wf.lastActionAt = new Date();
  wf.lastActionBy = actor.userId || actor._id;
  await wf.save();

  const dedupKey = `scheduled_publish:${entityType}:${entityId}:${scheduledPublishAt}`;
  await enqueueJob({
    type: 'scheduled_publish',
    payload: { entityType, entityId, action: 'publish' },
    scheduledAt: new Date(scheduledPublishAt),
    dedupKey,
  });
  if (scheduledArchiveAt) {
    await enqueueJob({
      type: 'scheduled_publish',
      payload: { entityType, entityId, action: 'archive' },
      scheduledAt: new Date(scheduledArchiveAt),
      dedupKey: `scheduled_archive:${entityType}:${entityId}:${scheduledArchiveAt}`,
    });
  }

  await logAudit({
    actor,
    action: 'workflow_schedule',
    targetType: entityType,
    targetId: entityId,
    metadata: { scheduledPublishAt, scheduledArchiveAt, timezone: wf.timezone },
  });

  await notifyScheduledPublish({
    userId: actor.userId || actor._id,
    email: actor.email,
    entityType,
    entityId,
    title: wf.title,
    scheduledAt: scheduledPublishAt,
  });

  return wf;
}

export async function publishNow(entityType, entityId, actor, options = {}) {
  const wf = await getOrCreateWorkflow(entityType, entityId);
  return transitionWorkflow(wf, 'published', actor, options);
}

export async function archiveContent(entityType, entityId, actor) {
  const wf = await getOrCreateWorkflow(entityType, entityId);
  return transitionWorkflow(wf, 'archived', actor);
}

export async function restoreToDraft(entityType, entityId, actor) {
  const wf = await getOrCreateWorkflow(entityType, entityId);
  return transitionWorkflow(wf, 'draft', actor);
}

// --- Review queue ---

export async function getReviewQueue({ tab = 'awaiting', userId, page = 1, limit = 25 } = {}) {
  const filter = {};
  const skip = (Math.max(1, page) - 1) * limit;

  switch (tab) {
    case 'awaiting':
      filter.status = 'in_review';
      break;
    case 'assigned':
      filter.status = 'in_review';
      if (userId) filter.assignedReviewerId = userId;
      break;
    case 'approved':
      filter.status = 'approved';
      break;
    case 'scheduled':
      filter.status = 'scheduled';
      break;
    case 'rejected':
      filter.status = 'changes_requested';
      break;
    case 'drafts':
      filter.status = 'draft';
      break;
    default:
      filter.status = 'in_review';
  }

  const [items, total] = await Promise.all([
    EditorialWorkflow.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
    EditorialWorkflow.countDocuments(filter),
  ]);

  return { items, total, page, limit, tab };
}

export async function getWorkflowDashboard() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const [
    pendingReviews,
    assignedReviews,
    scheduledToday,
    publishedToday,
    rejected,
    drafts,
    avgApproval,
  ] = await Promise.all([
    EditorialWorkflow.countDocuments({ status: 'in_review' }),
    EditorialWorkflow.countDocuments({ status: 'in_review', assignedReviewerId: { $ne: null } }),
    EditorialWorkflow.countDocuments({
      status: 'scheduled',
      scheduledPublishAt: { $gte: startOfDay, $lt: endOfDay },
    }),
    EditorialWorkflow.countDocuments({
      status: 'published',
      publishedAt: { $gte: startOfDay, $lt: endOfDay },
    }),
    EditorialWorkflow.countDocuments({ status: 'changes_requested' }),
    EditorialWorkflow.countDocuments({ status: 'draft' }),
    EditorialWorkflow.aggregate([
      { $match: { approvedAt: { $exists: true }, submittedAt: { $exists: true } } },
      {
        $project: {
          hours: { $divide: [{ $subtract: ['$approvedAt', '$submittedAt'] }, 3600000] },
        },
      },
      { $group: { _id: null, avgHours: { $avg: '$hours' } } },
    ]),
  ]);

  return {
    pendingReviews,
    assignedReviews,
    scheduledToday,
    publishedToday,
    rejected,
    drafts,
    averageApprovalHours: avgApproval[0]?.avgHours ? Math.round(avgApproval[0].avgHours * 10) / 10 : null,
  };
}

// --- Bulk actions ---

export async function bulkApprove(items, actor) {
  const results = [];
  for (const { entityType, entityId } of items) {
    try {
      const wf = await approveContent(entityType, entityId, actor);
      results.push({ entityType, entityId, ok: true, status: wf.status });
    } catch (err) {
      results.push({ entityType, entityId, ok: false, error: err.message });
    }
  }
  return results;
}

export async function bulkReject(items, actor, reason) {
  const results = [];
  for (const { entityType, entityId } of items) {
    try {
      const wf = await rejectContent(entityType, entityId, actor, reason);
      results.push({ entityType, entityId, ok: true, status: wf.status });
    } catch (err) {
      results.push({ entityType, entityId, ok: false, error: err.message });
    }
  }
  return results;
}

export async function bulkAssign(items, reviewerId, actor) {
  const results = [];
  for (const { entityType, entityId } of items) {
    try {
      const wf = await assignReviewer(entityType, entityId, reviewerId, actor);
      results.push({ entityType, entityId, ok: true, status: wf.status });
    } catch (err) {
      results.push({ entityType, entityId, ok: false, error: err.message });
    }
  }
  return results;
}

// --- Comments ---

export async function listComments(entityType, entityId, { resolved } = {}) {
  const filter = { entityType, entityId: String(entityId) };
  if (resolved !== undefined) filter.resolved = resolved === true || resolved === 'true';
  return EditorialComment.find(filter).sort({ createdAt: -1 }).lean();
}

export async function addComment(entityType, entityId, actor, body, options = {}) {
  const wf = await getOrCreateWorkflow(entityType, entityId);
  const comment = await EditorialComment.create({
    entityType,
    entityId: String(entityId),
    scope: options.scope || 'page',
    targetId: options.targetId || '',
    fieldKey: options.fieldKey || '',
    body,
    authorId: actor.userId || actor._id,
    authorName: actor.name || '',
    authorEmail: actor.email || '',
    reviewRound: wf.reviewRound || 0,
  });

  await logAudit({
    actor,
    action: 'workflow_comment',
    targetType: entityType,
    targetId: entityId,
    metadata: { commentId: comment._id, scope: comment.scope },
  });

  return comment;
}

export async function resolveComment(commentId, actor, resolved = true) {
  const comment = await EditorialComment.findByIdAndUpdate(
    commentId,
    { $set: { resolved } },
    { new: true }
  );
  if (comment) {
    await logAudit({
      actor,
      action: resolved ? 'workflow_comment_resolve' : 'workflow_comment_reopen',
      targetType: comment.entityType,
      targetId: comment.entityId,
      metadata: { commentId },
    });
  }
  return comment;
}
