import mongoose from 'mongoose';
import sanitizeHtml from 'sanitize-html';
import { Consultation } from '../models/consultation/Consultation.js';
import { ConsultationMessage } from '../models/consultation/ConsultationMessage.js';
import { ConsultationThread } from '../models/consultation/ConsultationThread.js';
import { ProfessionalCase } from '../models/case/ProfessionalCase.js';
import { CaseMessage, CaseThread } from '../models/case/CaseRecords.js';
import { AgentMembership } from '../models/agent/AgentMembership.js';
import { AgentProfile } from '../models/agent/AgentProfile.js';
import { AgentService } from '../models/agent/AgentService.js';
import { AgentMarketplacePost } from '../models/agent/AgentMarketplacePost.js';
import { ProfessionalReview } from '../models/trust/ProfessionalReview.js';
import { ProfessionalReport } from '../models/trust/ProfessionalReport.js';
import { ProfessionalDispute } from '../models/trust/ProfessionalDispute.js';
import { TrustNotificationEvent } from '../models/trust/TrustNotificationEvent.js';
import { DISPUTE_STATUSES, MODERATION_ACTIONS, REPORT_STATUSES, VERIFIED_REVIEW_COPY } from '../../../shared/services/professionalTrust.js';

const fail = (status, message) => Object.assign(new Error(message), { status });
const id = (value) => String(value || '');
const clean = (value, max) => {
  const raw = String(value || '').trim();
  const stripped = sanitizeHtml(raw, { allowedTags: [], allowedAttributes: {} });
  if (raw !== stripped || stripped.length > max || /(?:api[_-]?key|bearer\s+[a-z0-9._-]{16,}|BEGIN (?:RSA |EC )?PRIVATE KEY)/i.test(stripped)) throw fail(400, 'Text contains unsafe or sensitive content');
  return stripped;
};
const notify = (data) => TrustNotificationEvent.create(data).catch(() => null);

export async function getActiveMembership(agentAccountId) {
  const membership = await AgentMembership.findOne({ agentAccountId, active: true });
  if (!membership) throw fail(403, 'Active Agent organization membership required');
  return membership;
}

export async function resolveInteraction(studentUserId, interactionType, interactionId) {
  if (!mongoose.isValidObjectId(interactionId)) throw fail(400, 'Invalid interaction');
  const Model = interactionType === 'consultation' ? Consultation : interactionType === 'professional_case' ? ProfessionalCase : null;
  if (!Model) throw fail(400, 'Unsupported review interaction');
  const anchor = await Model.findOne({ _id: interactionId, studentUserId });
  if (!anchor) throw fail(403, 'Interaction is not owned by this Student');
  const eligible = interactionType === 'consultation' ? anchor.status === 'completed' && Boolean(anchor.completion?.completedAt) : anchor.lifecycle === 'closed' && anchor.processCompleted;
  if (!eligible) throw fail(409, 'Interaction is not review eligible');
  return anchor;
}

export async function reviewEligibility(studentUserId, interactionType, interactionId) {
  try {
    const anchor = await resolveInteraction(studentUserId, interactionType, interactionId);
    const existing = await ProfessionalReview.exists({ studentUserId, interactionType, interactionId });
    return { eligible: !existing, reason: existing ? 'already_reviewed' : null, organizationId: anchor.organizationId };
  } catch (error) { return { eligible: false, reason: error.message }; }
}

export async function createReview(studentUserId, input) {
  const anchor = await resolveInteraction(studentUserId, input.interactionType, input.interactionId);
  const profile = await AgentProfile.findOne({ agentAccountId: studentUserId, organizationId: anchor.organizationId });
  if (profile) throw fail(403, 'Organization members cannot review their own organization');
  const body = clean(input.body, 4000); if (body.length < 10) throw fail(400, 'Review text is too short');
  const title = clean(input.title, 120); const rating = Number(input.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw fail(400, 'Rating must be an integer from 1 to 5');
  const dimensions = Object.fromEntries(Object.entries(input.dimensions || {}).map(([key, value]) => [key, Number(value)]));
  try {
    const review = await ProfessionalReview.create({ studentUserId, organizationId: anchor.organizationId, membershipId: anchor.assignedMembershipId, interactionType: input.interactionType, interactionId: anchor._id, rating, dimensions, title, body, verifiedInteraction: true, status: 'published', publishedAt: new Date() });
    await notify({ recipientActorType: 'agent', recipientId: id(anchor.organizationId), eventType: 'review_received', entityType: 'review', entityId: review._id }); return review;
  } catch (error) { if (error?.code === 11000) throw fail(409, 'This interaction already has a review'); throw error; }
}

export async function updateOwnReview(studentUserId, reviewId, input) {
  const review = await ProfessionalReview.findOne({ _id: reviewId, studentUserId }); if (!review) throw fail(404, 'Review not found');
  if (['removed', 'rejected'].includes(review.status)) throw fail(409, 'Moderated review cannot be edited');
  if (input.rating !== undefined) { const n = Number(input.rating); if (!Number.isInteger(n) || n < 1 || n > 5) throw fail(400, 'Rating must be an integer from 1 to 5'); review.rating = n; }
  if (input.body !== undefined) { review.body = clean(input.body, 4000); if (review.body.length < 10) throw fail(400, 'Review text is too short'); }
  if (input.title !== undefined) review.title = clean(input.title, 120);
  review.status = input.withdraw === true ? 'withdrawn' : 'published'; review.publishedAt ||= new Date(); return review.save();
}

export async function respondToReview(agentAccountId, reviewId, body) {
  const membership = await getActiveMembership(agentAccountId); const review = await ProfessionalReview.findOne({ _id: reviewId, organizationId: membership.organizationId });
  if (!review) throw fail(404, 'Review not found in Agent organization'); if (!['published', 'under_review'].includes(review.status)) throw fail(409, 'Review cannot receive a response');
  const responseBody = clean(body, 1500); if (responseBody.length < 2) throw fail(400, 'Response is required'); const now = new Date();
  review.response = { body: responseBody, membershipId: membership._id, createdAt: review.response?.createdAt || now, updatedAt: now }; await review.save();
  await notify({ recipientActorType: 'student', recipientId: id(review.studentUserId), eventType: 'agent_response', entityType: 'review', entityId: review._id }); return review;
}

export const publicReviewProjection = (review) => ({ id: review._id, rating: review.rating, dimensions: review.dimensions, title: review.title, body: review.body, verifiedInteraction: true, verifiedMeaning: VERIFIED_REVIEW_COPY, interactionType: review.interactionType, publishedAt: review.publishedAt, student: { displayName: 'Verified Student' }, response: review.response ? { label: 'Agent/Agency response', body: review.response.body, updatedAt: review.response.updatedAt } : null });
export async function publicReviews(organizationId, limit = 20) { const reviews = await ProfessionalReview.find({ organizationId, status: 'published', verifiedInteraction: true }).sort({ publishedAt: -1, _id: -1 }).limit(Math.min(Number(limit) || 20, 50)); const aggregate = await ProfessionalReview.aggregate([{ $match: { organizationId: new mongoose.Types.ObjectId(organizationId), status: 'published', verifiedInteraction: true } }, { $group: { _id: null, averageRating: { $avg: '$rating' }, reviewCount: { $sum: 1 } } }]); return { aggregate: aggregate[0] ? { averageRating: Number(aggregate[0].averageRating.toFixed(2)), reviewCount: aggregate[0].reviewCount } : { averageRating: null, reviewCount: 0 }, reviews: reviews.map(publicReviewProjection), verifiedMeaning: VERIFIED_REVIEW_COPY }; }

async function targetContext(userId, type, targetId) {
  const map = { organization: [null, {}], marketplace_post: [AgentMarketplacePost, {}], agent_service: [AgentService, {}], consultation: [Consultation, { studentUserId: userId }], professional_case: [ProfessionalCase, { studentUserId: userId }], review: [ProfessionalReview, {}], consultation_message: [ConsultationMessage, {}], case_message: [CaseMessage, {}] };
  const pair = map[type]; if (!pair || !mongoose.isValidObjectId(targetId)) throw fail(400, 'Invalid report target');
  if (type === 'organization') return { organizationId: targetId };
  const target = await pair[0].findOne({ _id: targetId, ...pair[1] }); if (!target) throw fail(404, 'Report target not found or not authorized');
  if (type === 'consultation_message') { const thread = await ConsultationThread.findOne({ _id: target.threadId, studentUserId: userId }); if (!thread) throw fail(403, 'Message is not in your consultation'); return { organizationId: thread.organizationId }; }
  if (type === 'case_message') { const thread = await CaseThread.findOne({ _id: target.threadId, studentUserId: userId }); if (!thread) throw fail(403, 'Message is not in your case'); return { organizationId: thread.organizationId }; }
  return { organizationId: target.organizationId || null };
}

export async function createReport(reporterUserId, input) { const context = await targetContext(reporterUserId, input.targetType, input.targetId); const description = clean(input.description, 3000); if (description.length < 10) throw fail(400, 'Report description is too short'); return ProfessionalReport.create({ reporterUserId, targetType: input.targetType, targetId: input.targetId, organizationId: context.organizationId, category: input.category, description, evidenceReferences: input.evidenceReferences || [] }); }

export async function openDispute(studentUserId, input) { let anchor; if (input.contextType === 'agent_service') { anchor = await Consultation.findOne({ studentUserId, agentServiceId: input.contextId, status: 'completed', 'completion.completedAt': { $ne: null } }); if (!anchor) throw fail(409, 'Agent service dispute requires a completed engagement'); } else anchor = await resolveInteraction(studentUserId, input.contextType === 'professional_case' ? 'professional_case' : 'consultation', input.contextId);
  const summary = clean(input.summary, 3000); if (summary.length < 10) throw fail(400, 'Dispute summary is too short'); try { const dispute = await ProfessionalDispute.create({ studentUserId, organizationId: anchor.organizationId, contextType: input.contextType, contextId: input.contextId, category: input.category, summary, events: [{ type: 'opened', actorType: 'student', actorId: studentUserId, note: summary }] }); await notify({ recipientActorType: 'agent', recipientId: id(anchor.organizationId), eventType: 'dispute_opened', entityType: 'dispute', entityId: dispute._id }); return dispute; } catch (error) { if (error?.code === 11000) throw fail(409, 'A dispute already exists for this interaction'); throw error; } }

const PARTY_TRANSITIONS = { student: { opened: ['awaiting_response'], awaiting_response: ['under_review'] }, agent: { opened: ['awaiting_response'], awaiting_response: ['under_review'] } };
export async function partyDisputeEvent(actorType, actorId, disputeId, input) { const scope = actorType === 'student' ? { studentUserId: actorId } : { organizationId: (await getActiveMembership(actorId)).organizationId }; const dispute = await ProfessionalDispute.findOne({ _id: disputeId, ...scope }); if (!dispute) throw fail(404, 'Dispute not found'); const next = input.status || dispute.status; if (['resolved', 'closed', 'dismissed', 'escalated', 'proposed_resolution'].includes(next) || (next !== dispute.status && !PARTY_TRANSITIONS[actorType]?.[dispute.status]?.includes(next))) throw fail(403, 'Only authorized staff can set this dispute state'); const note = clean(input.note, 1500); dispute.status = next; dispute.events.push({ type: input.type || 'response_submitted', actorType, actorId, note, evidenceReferences: input.evidenceReferences || [] }); return dispute.save(); }

export async function moderate(kind, entityId, staff, input) { const Models = { review: ProfessionalReview, report: ProfessionalReport, dispute: ProfessionalDispute }; const Model = Models[kind]; if (!Model) throw fail(400, 'Invalid moderation target'); const entity = await Model.findById(entityId).select('+reporterUserId +moderation.reason +moderation.reviewedBy +moderation.reviewedAt'); if (!entity) throw fail(404, 'Moderation target not found'); const action = input.action; if (!MODERATION_ACTIONS.includes(action)) throw fail(400, 'Invalid moderation action'); const role = staff.role; if (action === 'organization_suspension_recommended' && !['Moderator', 'Admin', 'SuperAdmin'].includes(role)) throw fail(403, 'Insufficient authority'); if (['resolved', 'dismissed', 'action_taken'].includes(input.status) && !['Admin', 'SuperAdmin'].includes(role)) throw fail(403, 'Admin authority required for resolution');
  if (!['Moderator', 'Admin', 'SuperAdmin'].includes(role)) throw fail(403, 'Moderator authority required');
  const reason = clean(input.reason, 1000); if (!reason && action !== 'no_action') throw fail(400, 'Reason is required');
  if (kind === 'review') { const statuses = ['published', 'under_review', 'hidden', 'rejected', 'removed']; if (!statuses.includes(input.status)) throw fail(400, 'Invalid review state'); entity.status = input.status; entity.moderation = { reason, reviewedBy: staff.userId, reviewedAt: new Date() }; }
  if (kind === 'report') { if (!REPORT_STATUSES.includes(input.status)) throw fail(400, 'Invalid report state'); entity.status = input.status; entity.resolution = reason; entity.reviewedAt = new Date(); }
  if (kind === 'dispute') { if (!DISPUTE_STATUSES.includes(input.status)) throw fail(400, 'Invalid dispute state'); entity.status = input.status; entity.resolution = reason; entity.events.push({ type: action, actorType: role === 'Moderator' ? 'moderator' : 'admin', actorId: staff.userId, note: reason }); }
  await entity.save(); return entity;
}
