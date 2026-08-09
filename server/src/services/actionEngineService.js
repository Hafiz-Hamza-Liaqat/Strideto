/**
 * Action Engine Service — Mission 9.
 *
 * Persistence layer for user actions, checklists, saved opportunities,
 * deadlines, education applications, and alert preferences.
 *
 * Journey Planner and Next Best Action consume Mission 8 gap analysis
 * rather than duplicating eligibility logic.
 *
 * No AI, no workers, no email/push delivery. Self-managed mode only.
 * Server derives userId from req.user — never from caller-supplied params.
 */
import mongoose from 'mongoose';
import { UserAction } from '../models/action/UserAction.js';
import { UserChecklist } from '../models/action/UserChecklist.js';
import { SavedOpportunity } from '../models/action/SavedOpportunity.js';
import { UserDeadline } from '../models/action/UserDeadline.js';
import { EducationApplication } from '../models/action/EducationApplication.js';
import { AlertPreference } from '../models/action/AlertPreference.js';
import { TalentProfile } from '../models/career/TalentProfile.js';
import {
  ACTION_STATUSES,
  EDUCATION_APPLICATION_STATUSES,
  EDUCATION_APPLICATION_MODES,
  classifyDeadlineUrgency,
  identifyProfileGaps,
  buildJourneyPlan,
  computeNextBestAction,
  ALERT_TYPES,
} from '../../../shared/action/actionEngine.js';
import { getProfileGapAnalysis } from './personalizationService.js';

const toOid = (id) => (mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : null);

// Adapt Mission 8 gap format { key, label, severity, reason, action, section }
// into { criticalGaps, majorGaps } shape expected by the action engine.
function adaptM8Gaps(gaps = []) {
  const criticalGaps = gaps.filter((g) => g.severity === 'critical').map((g) => ({
    type: g.section || 'profile',
    label: g.label,
    reason: g.reason,
    action: g.action,
    key: g.key,
    ctaRoute: '/talent-profile',
  }));
  const majorGaps = gaps.filter((g) => g.severity === 'major').map((g) => ({
    type: g.section || 'profile',
    label: g.label,
    reason: g.reason,
    action: g.action,
    key: g.key,
    ctaRoute: '/talent-profile',
  }));
  return { criticalGaps, majorGaps };
}

// ── Profile snapshot ──────────────────────────────────────────────────────────

async function loadProfileSnapshot(userId) {
  const profile = await TalentProfile.findOne({ userId }).lean();
  if (!profile) return null;
  return {
    personalInfo: profile.personalInfo || {},
    education: profile.education || [],
    examScores: profile.examScores || [],
    studyGoals: profile.studyGoals || [],
    studentPreferences: profile.studentPreferences || {},
    budgetProfile: profile.budgetProfile || {},
    experience: profile.experience || [],
  };
}

// ── Actions / Tasks ───────────────────────────────────────────────────────────

export async function listActions(userId, { status, actionType, page = 1, limit = 20 } = {}) {
  const q = { userId: toOid(userId) };
  if (status) q.status = status;
  if (actionType) q.actionType = actionType;
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    UserAction.find(q).sort({ dueAt: 1, createdAt: -1 }).skip(skip).limit(limit).lean(),
    UserAction.countDocuments(q),
  ]);
  return { items, total, page, limit };
}

export async function createAction(userId, data) {
  const action = new UserAction({ ...data, userId: toOid(userId), source: data.source || 'user' });
  await action.save();
  return action.toObject();
}

export async function getAction(userId, actionId) {
  const oid = toOid(actionId);
  if (!oid) return null;
  return UserAction.findOne({ _id: oid, userId: toOid(userId) }).lean();
}

export async function updateActionStatus(userId, actionId, newStatus) {
  const oid = toOid(actionId);
  if (!oid) return null;
  const update = { status: newStatus };
  if (newStatus === ACTION_STATUSES.COMPLETED) update.completedAt = new Date();
  if (newStatus === ACTION_STATUSES.DISMISSED) update.dismissedAt = new Date();
  return UserAction.findOneAndUpdate(
    { _id: oid, userId: toOid(userId) },
    { $set: update },
    { new: true }
  ).lean();
}

export async function updateAction(userId, actionId, data) {
  const oid = toOid(actionId);
  if (!oid) return null;
  // Prevent overriding ownership
  delete data.userId;
  delete data.source;
  return UserAction.findOneAndUpdate(
    { _id: oid, userId: toOid(userId) },
    { $set: data },
    { new: true }
  ).lean();
}

export async function deleteAction(userId, actionId) {
  const oid = toOid(actionId);
  if (!oid) return false;
  const result = await UserAction.deleteOne({ _id: oid, userId: toOid(userId) });
  return result.deletedCount > 0;
}

// ── Checklists ────────────────────────────────────────────────────────────────

export async function listChecklists(userId, { targetType, targetId } = {}) {
  const q = { userId: toOid(userId) };
  if (targetType) q.targetType = targetType;
  if (targetId) q.targetId = toOid(targetId);
  return UserChecklist.find(q).sort({ createdAt: -1 }).lean();
}

export async function createChecklist(userId, data) {
  const cl = new UserChecklist({ ...data, userId: toOid(userId) });
  await cl.save();
  return cl.toObject();
}

export async function getChecklist(userId, checklistId) {
  const oid = toOid(checklistId);
  if (!oid) return null;
  return UserChecklist.findOne({ _id: oid, userId: toOid(userId) }).lean();
}

export async function addChecklistItem(userId, checklistId, itemData) {
  const oid = toOid(checklistId);
  if (!oid) return null;
  const cl = await UserChecklist.findOne({ _id: oid, userId: toOid(userId) });
  if (!cl) return null;
  cl.items.push({ ...itemData });
  await cl.save();
  return cl.toObject();
}

export async function updateChecklistItem(userId, checklistId, itemId, update) {
  const clOid = toOid(checklistId);
  const itemOid = toOid(itemId);
  if (!clOid || !itemOid) return null;
  const cl = await UserChecklist.findOne({ _id: clOid, userId: toOid(userId) });
  if (!cl) return null;
  const item = cl.items.id(itemOid);
  if (!item) return null;
  // User completion does not modify underlying official requirement reference
  if (update.status) item.status = update.status;
  if (update.status === 'completed' && !item.completedAt) item.completedAt = new Date();
  if (update.label && item.source === 'user') item.label = update.label;
  if (update.dueAt !== undefined) item.dueAt = update.dueAt;
  await cl.save();
  return cl.toObject();
}

export async function deleteChecklist(userId, checklistId) {
  const oid = toOid(checklistId);
  if (!oid) return false;
  const result = await UserChecklist.deleteOne({ _id: oid, userId: toOid(userId) });
  return result.deletedCount > 0;
}

// ── Saved opportunities ───────────────────────────────────────────────────────

export async function saveOpportunity(userId, entityType, entityId, notes = '') {
  const uidOid = toOid(userId);
  const eOid = toOid(entityId);
  if (!eOid) return { error: 'invalid_id' };
  try {
    const doc = await SavedOpportunity.findOneAndUpdate(
      { userId: uidOid, entityType, entityId: eOid },
      { $setOnInsert: { userId: uidOid, entityType, entityId: eOid, notes } },
      { upsert: true, new: true }
    ).lean();
    return { saved: true, id: doc._id };
  } catch (err) {
    if (err.code === 11000) return { saved: true }; // already saved — idempotent
    throw err;
  }
}

export async function unsaveOpportunity(userId, entityType, entityId) {
  const eOid = toOid(entityId);
  if (!eOid) return { saved: false };
  await SavedOpportunity.deleteOne({ userId: toOid(userId), entityType, entityId: eOid });
  return { saved: false };
}

export async function listSavedOpportunities(userId, { entityType, page = 1, limit = 20 } = {}) {
  const q = { userId: toOid(userId) };
  if (entityType) q.entityType = entityType;
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    SavedOpportunity.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    SavedOpportunity.countDocuments(q),
  ]);
  return { items, total, page, limit };
}

export async function isSaved(userId, entityType, entityId) {
  const eOid = toOid(entityId);
  if (!eOid) return false;
  const doc = await SavedOpportunity.findOne({ userId: toOid(userId), entityType, entityId: eOid }).lean();
  return !!doc;
}

// ── Deadlines / Calendar ──────────────────────────────────────────────────────

export async function listDeadlines(userId, { from, to, status, page = 1, limit = 50 } = {}) {
  const q = { userId: toOid(userId) };
  if (from || to) {
    q.deadlineAt = {};
    if (from) q.deadlineAt.$gte = new Date(from);
    if (to) q.deadlineAt.$lte = new Date(to);
  }
  const skip = (page - 1) * limit;
  const raw = await UserDeadline.find(q).sort({ deadlineAt: 1 }).skip(skip).limit(limit).lean();
  const now = new Date();
  const items = raw.map((d) => ({
    ...d,
    urgency: classifyDeadlineUrgency(d.deadlineAt, d.isDateOnly, undefined, now),
  }));
  // Optional filter by urgency after classification
  const filtered = status ? items.filter((d) => d.urgency === status) : items;
  return { items: filtered, total: filtered.length, page, limit };
}

export async function createDeadline(userId, data) {
  // Never invent a time when isDateOnly is true
  const dl = new UserDeadline({ ...data, userId: toOid(userId), isUserCreated: true });
  await dl.save();
  return dl.toObject();
}

export async function updateDeadline(userId, deadlineId, data) {
  const oid = toOid(deadlineId);
  if (!oid) return null;
  delete data.userId;
  return UserDeadline.findOneAndUpdate(
    { _id: oid, userId: toOid(userId) },
    { $set: data },
    { new: true }
  ).lean();
}

export async function deleteDeadline(userId, deadlineId) {
  const oid = toOid(deadlineId);
  if (!oid) return false;
  const result = await UserDeadline.deleteOne({ _id: oid, userId: toOid(userId) });
  return result.deletedCount > 0;
}

// ── Education Applications ────────────────────────────────────────────────────

export async function listEducationApplications(userId, { status, page = 1, limit = 20 } = {}) {
  const q = { userId: toOid(userId) };
  if (status) q.status = status;
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    EducationApplication.find(q).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
    EducationApplication.countDocuments(q),
  ]);
  return { items, total, page, limit };
}

export async function createEducationApplication(userId, data) {
  const app = new EducationApplication({
    ...data,
    userId: toOid(userId),
    mode: EDUCATION_APPLICATION_MODES.SELF_MANAGED,
    status: data.status || EDUCATION_APPLICATION_STATUSES.INTERESTED,
    history: [{ fromStatus: null, toStatus: data.status || EDUCATION_APPLICATION_STATUSES.INTERESTED, note: 'Application tracking started.' }],
  });
  await app.save();
  return app.toObject();
}

export async function getEducationApplication(userId, appId) {
  const oid = toOid(appId);
  if (!oid) return null;
  return EducationApplication.findOne({ _id: oid, userId: toOid(userId) }).lean();
}

export async function transitionEducationApplicationStatus(userId, appId, newStatus, note = '') {
  const oid = toOid(appId);
  if (!oid) return null;
  const app = await EducationApplication.findOne({ _id: oid, userId: toOid(userId) });
  if (!app) return null;

  const prevStatus = app.status;
  app.status = newStatus;

  // Truthful: only record submittedAt when user explicitly reports submission
  if (newStatus === EDUCATION_APPLICATION_STATUSES.SUBMITTED && !app.submittedAt) {
    app.submittedAt = new Date();
  }
  if ([EDUCATION_APPLICATION_STATUSES.OFFER_OR_ADMITTED, EDUCATION_APPLICATION_STATUSES.REJECTED, EDUCATION_APPLICATION_STATUSES.WITHDRAWN, EDUCATION_APPLICATION_STATUSES.COMPLETED].includes(newStatus)) {
    if (!app.outcomeAt) app.outcomeAt = new Date();
  }

  // Append to history — never overwrite
  app.history.push({ fromStatus: prevStatus, toStatus: newStatus, changedAt: new Date(), note });
  await app.save();
  return app.toObject();
}

export async function updateEducationApplication(userId, appId, data) {
  const oid = toOid(appId);
  if (!oid) return null;
  delete data.userId;
  delete data.mode;
  delete data.history;
  delete data.status; // status changes go through transitionEducationApplicationStatus
  return EducationApplication.findOneAndUpdate(
    { _id: oid, userId: toOid(userId) },
    { $set: data },
    { new: true }
  ).lean();
}

export async function deleteEducationApplication(userId, appId) {
  const oid = toOid(appId);
  if (!oid) return false;
  const result = await EducationApplication.deleteOne({ _id: oid, userId: toOid(userId) });
  return result.deletedCount > 0;
}

// ── Alert preferences ─────────────────────────────────────────────────────────

export async function getAlertPreferences(userId) {
  let prefs = await AlertPreference.findOne({ userId: toOid(userId) }).lean();
  if (!prefs) {
    // Return defaults without persisting; user gets explicit defaults on first save
    const defaults = {};
    Object.values(ALERT_TYPES).forEach((t) => { defaults[t] = true; });
    return { preferences: defaults, channelOverrides: {} };
  }
  const prefObj = {};
  if (prefs.preferences instanceof Map) {
    for (const [k, v] of prefs.preferences) prefObj[k] = v;
  } else {
    Object.assign(prefObj, prefs.preferences);
  }
  return { preferences: prefObj, channelOverrides: prefs.channelOverrides || {} };
}

export async function upsertAlertPreferences(userId, updates) {
  const uidOid = toOid(userId);
  let doc = await AlertPreference.findOne({ userId: uidOid });
  if (!doc) {
    const defaults = new Map(Object.values(ALERT_TYPES).map((t) => [t, true]));
    doc = new AlertPreference({ userId: uidOid, preferences: defaults });
  }
  if (updates.preferences) {
    for (const [k, v] of Object.entries(updates.preferences)) {
      if (Object.values(ALERT_TYPES).includes(k)) {
        doc.preferences.set(k, Boolean(v));
      }
    }
  }
  if (updates.channelOverrides) {
    doc.channelOverrides = { ...doc.channelOverrides, ...updates.channelOverrides };
  }
  await doc.save();
  const prefObj = {};
  for (const [k, v] of doc.preferences) prefObj[k] = v;
  return { preferences: prefObj, channelOverrides: doc.channelOverrides };
}

// ── Journey Planner ───────────────────────────────────────────────────────────

export async function getJourneyPlan(userId) {
  const uidOid = toOid(userId);

  const [profile, pendingActions, savedOpps, educationApps] = await Promise.all([
    loadProfileSnapshot(userId),
    UserAction.find({ userId: uidOid, status: { $in: [ACTION_STATUSES.TODO, ACTION_STATUSES.IN_PROGRESS] } }).lean(),
    SavedOpportunity.find({ userId: uidOid }).lean(),
    EducationApplication.find({ userId: uidOid }).lean(),
  ]);

  const profileGaps = identifyProfileGaps(profile);

  // Consume Mission 8 gap analysis — do not duplicate eligibility logic
  let eligibilityGaps = { criticalGaps: [], majorGaps: [] };
  try {
    const m8 = await getProfileGapAnalysis(userId);
    if (m8 && !m8.error) {
      eligibilityGaps = adaptM8Gaps(m8.gaps || []);
    }
  } catch {
    // Gap analysis is best-effort; journey still works without it
  }

  // Deadline urgency for journey context
  const deadlines = await UserDeadline.find({ userId: uidOid }).lean();
  const now = new Date();
  const upcomingDeadlines = deadlines.map((d) => ({
    ...d,
    urgency: classifyDeadlineUrgency(d.deadlineAt, d.isDateOnly, undefined, now),
  }));

  const goalTypes = (profile?.studyGoals || []).map((g) => g.goalType).filter(Boolean);

  return buildJourneyPlan({
    profile,
    profileGaps,
    eligibilityGaps,
    savedOpportunities: savedOpps,
    educationApplications: educationApps,
    pendingActions,
    upcomingDeadlines,
    goalTypes,
  });
}

// ── Next Best Action ──────────────────────────────────────────────────────────

export async function getNextBestAction(userId) {
  const uidOid = toOid(userId);

  const [profile, pendingActions, savedOpps, educationApps, deadlines] = await Promise.all([
    loadProfileSnapshot(userId),
    UserAction.find({ userId: uidOid, status: { $in: [ACTION_STATUSES.TODO, ACTION_STATUSES.IN_PROGRESS] } }).lean(),
    SavedOpportunity.find({ userId: uidOid }).lean(),
    EducationApplication.find({
      userId: uidOid,
      status: { $in: [EDUCATION_APPLICATION_STATUSES.PREPARING, EDUCATION_APPLICATION_STATUSES.READY_TO_APPLY, EDUCATION_APPLICATION_STATUSES.SUBMITTED, EDUCATION_APPLICATION_STATUSES.UNDER_REVIEW, EDUCATION_APPLICATION_STATUSES.INTERVIEW_OR_ASSESSMENT] },
    }).lean(),
    UserDeadline.find({ userId: uidOid }).lean(),
  ]);

  const profileGaps = identifyProfileGaps(profile);

  let eligibilityGaps = { criticalGaps: [], majorGaps: [] };
  try {
    const m8 = await getProfileGapAnalysis(userId);
    if (m8 && !m8.error) {
      eligibilityGaps = adaptM8Gaps(m8.gaps || []);
    }
  } catch {
    // Best-effort
  }

  const now = new Date();
  const upcomingDeadlines = deadlines
    .map((d) => ({
      ...d,
      urgency: classifyDeadlineUrgency(d.deadlineAt, d.isDateOnly, undefined, now),
      entityType: d.sourceEntityType,
      entityId: d.sourceEntityId,
      ctaRoute: '/journey/deadlines',
    }))
    .filter((d) => d.urgency !== 'none');

  return computeNextBestAction({
    profileGaps,
    eligibilityGaps,
    upcomingDeadlines,
    pendingActions,
    activeApplications: educationApps,
    savedOpportunities: savedOpps,
  });
}

// ── Dashboard summary ─────────────────────────────────────────────────────────

export async function getActionDashboard(userId) {
  const uidOid = toOid(userId);
  const now = new Date();

  const [nba, pendingActions, savedOpps, educationApps, deadlines] = await Promise.all([
    getNextBestAction(userId),
    UserAction.find({ userId: uidOid, status: { $in: [ACTION_STATUSES.TODO, ACTION_STATUSES.IN_PROGRESS] } }).sort({ dueAt: 1 }).limit(10).lean(),
    SavedOpportunity.find({ userId: uidOid }).sort({ createdAt: -1 }).limit(10).lean(),
    EducationApplication.find({ userId: uidOid, status: { $nin: [EDUCATION_APPLICATION_STATUSES.COMPLETED, EDUCATION_APPLICATION_STATUSES.REJECTED, EDUCATION_APPLICATION_STATUSES.WITHDRAWN] } }).sort({ updatedAt: -1 }).limit(10).lean(),
    UserDeadline.find({ userId: uidOid, deadlineAt: { $gte: now } }).sort({ deadlineAt: 1 }).limit(10).lean(),
  ]);

  const upcomingDeadlines = deadlines.map((d) => ({
    ...d,
    urgency: classifyDeadlineUrgency(d.deadlineAt, d.isDateOnly, undefined, now),
  }));

  const overdueDeadlines = await UserDeadline.find({
    userId: uidOid,
    deadlineAt: { $lt: now },
  }).sort({ deadlineAt: -1 }).limit(5).lean();

  return {
    nextBestAction: nba,
    pendingActions,
    upcomingDeadlines,
    overdueDeadlines: overdueDeadlines.map((d) => ({ ...d, urgency: 'overdue' })),
    activeApplications: educationApps,
    savedOpportunities: savedOpps,
  };
}
