import { AgentMarketplacePost } from '../models/agent/AgentMarketplacePost.js';
import { AgentMarketplaceModerationEvent } from '../models/agent/AgentMarketplaceModerationEvent.js';
import { AgentMarketplaceInterest } from '../models/agent/AgentMarketplaceInterest.js';
import { AgentProfile } from '../models/agent/AgentProfile.js';
import { AgentMembership } from '../models/agent/AgentMembership.js';
import { AgentService } from '../models/agent/AgentService.js';
import { AgentLead } from '../models/agent/AgentLead.js';
import { Organization } from '../models/Organization.js';
import { OrganizationVerification } from '../models/OrganizationVerification.js';
import { VerificationEvidence } from '../models/VerificationEvidence.js';
import { CanonicalSource } from '../models/trust/CanonicalSource.js';
import { Program } from '../models/education/Program.js';
import { CanonicalScholarship } from '../models/education/CanonicalScholarship.js';
import { Test } from '../models/education/Test.js';
import { CanonicalInstitution } from '../models/education/CanonicalInstitution.js';
import { logAudit } from './auditService.js';
import { assertApprovedVerification } from './agentProfileService.js';
import { deriveBadges, VERIFICATION_STATUSES } from '../../../shared/international/verification.js';
import { deriveFreshness, FRESHNESS_STATES, SOURCE_STATUS as _SOURCE_STATUS } from '../../../shared/trust/sourceVerification.js';
import {
  MARKETPLACE_POST_TYPES, MARKETPLACE_CONTENT_KINDS as _MARKETPLACE_CONTENT_KINDS, MARKETPLACE_REFERENCE_TYPES,
  MARKETPLACE_PUBLICATION_STATUSES as PS, MARKETPLACE_MODERATION_STATUSES as MS,
  MARKETPLACE_INTEREST_STATUSES, marketplaceClaimSignals, requiresMarketplaceProvenance,
  freshnessWarning, isMarketplaceCurrentlyActive,
} from '../../../shared/agent/marketplace.js';

const error = (message, status = 400) => Object.assign(new Error(message), { status });
const slugify = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'marketplace-post';
const list = (value, upper = false) => Array.isArray(value) ? value.map((v) => upper ? String(v).trim().toUpperCase() : String(v).trim()).filter(Boolean).slice(0, 30) : [];

export function validateMarketplaceContent(data, { forPublication = false } = {}) {
  const signals = marketplaceClaimSignals(data.title, data.summary, data.agentStatement, (data.factualClaims || []).map((c) => c.statement));
  if (signals.length) throw error(`Content violates guarantee or misleading-claim policy: ${signals.join(', ')}`, 422);
  if (!Object.values(MARKETPLACE_POST_TYPES).includes(data.postType)) throw error('Invalid marketplace post type', 422);
  if (requiresMarketplaceProvenance(data)) {
    if (!Array.isArray(data.canonicalReferences) || data.canonicalReferences.length === 0) throw error('Source-backed factual content requires a canonical opportunity reference', 422);
    if (!Array.isArray(data.factualClaims) || data.factualClaims.length === 0 || data.factualClaims.some((claim) => !Array.isArray(claim.sourceIds) || claim.sourceIds.length === 0)) throw error('Every factual claim requires at least one canonical source', 422);
  }
  if (forPublication && !data.title?.trim()) throw error('Title is required', 422);
  return { signals };
}

async function resolveAgentScope(agentAccountId) {
  const profile = await AgentProfile.findOne({ agentAccountId }).lean();
  if (!profile) throw error('Agent profile not found', 404);
  const membership = await AgentMembership.findOne({ agentAccountId, organizationId: profile.organizationId, active: true }).lean();
  if (!membership) throw error('Active organization membership required', 403);
  return { profile, membership };
}

async function uniqueSlug(title) {
  const base = slugify(title);
  for (let i = 0; i < 100; i += 1) {
    const slug = i ? `${base}-${i + 1}` : base;
    if (!(await AgentMarketplacePost.exists({ slug }))) return slug;
  }
  return `${base}-${Date.now().toString(36)}`;
}

async function validateRelatedRecords(data, organizationId) {
  if (data.relatedAgentServiceId) {
    const service = await AgentService.findOne({ _id: data.relatedAgentServiceId, organizationId }).lean();
    if (!service) throw error('Related service not found in this organization', 404);
  }
  const modelMap = {
    [MARKETPLACE_REFERENCE_TYPES.PROGRAM]: Program,
    [MARKETPLACE_REFERENCE_TYPES.SCHOLARSHIP]: CanonicalScholarship,
    [MARKETPLACE_REFERENCE_TYPES.TEST]: Test,
    [MARKETPLACE_REFERENCE_TYPES.INSTITUTION]: CanonicalInstitution,
  };
  for (const ref of data.canonicalReferences || []) {
    const model = modelMap[ref.referenceType];
    if (!model || !(await model.exists({ _id: ref.referenceId, status: 'published' }))) throw error('Canonical reference is invalid or not publicly published', 422);
  }
}

async function sourceState(data) {
  const ids = new Set([...(data.sourceIds || []).map(String)]);
  for (const claim of data.factualClaims || []) for (const id of claim.sourceIds || []) ids.add(String(id));
  if (!ids.size) return { sourceIds: [], freshness: FRESHNESS_STATES.UNKNOWN };
  const sources = await CanonicalSource.find({ _id: { $in: [...ids] } }).select('_id status lastVerifiedAt nextReviewAt').lean();
  if (sources.length !== ids.size) throw error('One or more canonical sources do not exist', 422);
  const states = sources.map((s) => deriveFreshness({ lastVerifiedAt: s.lastVerifiedAt, nextReviewAt: s.nextReviewAt, sourceStatus: s.status }));
  const order = ['broken', 'stale', 'review_due', 'unknown', 'fresh'];
  return { sourceIds: [...ids], freshness: states.sort((a, b) => order.indexOf(a) - order.indexOf(b))[0] || FRESHNESS_STATES.UNKNOWN };
}

const editableFields = ['postType','title','summary','contentKind','agentStatement','factualClaims','canonicalReferences','relatedAgentServiceId','targetCountries','destinationCountries','degreeCategories','careerCategories','journeyCategories','languages','sourceIds','effectiveAt','startsAt','endsAt'];
function normalizedInput(data) {
  const out = {};
  for (const key of editableFields) if (key in data) out[key] = data[key];
  for (const key of ['targetCountries','destinationCountries']) if (key in out) out[key] = list(out[key], true);
  for (const key of ['degreeCategories','careerCategories','journeyCategories','languages']) if (key in out) out[key] = list(out[key]);
  return out;
}

async function audit(action, actor, metadata) { await logAudit({ action, actor, metadata }); }
async function event(post, toStatus, action, actorId, actorRealm, reason = '') {
  await AgentMarketplaceModerationEvent.create({ postId: post._id, organizationId: post.organizationId, fromStatus: post.moderationStatus, toStatus, action, reason, actorId, actorRealm });
}

export async function createDraft(agentAccountId, data) {
  const { profile } = await resolveAgentScope(agentAccountId);
  const input = normalizedInput(data); validateMarketplaceContent(input);
  await validateRelatedRecords(input, profile.organizationId);
  const sources = await sourceState(input);
  const post = await AgentMarketplacePost.create({ ...input, organizationId: profile.organizationId, authorAgentAccountId: agentAccountId, slug: await uniqueSlug(input.title), sourceIds: sources.sourceIds, sourceFreshnessState: sources.freshness, policySignals: [] });
  await audit('agent_marketplace_draft_created', { userId: agentAccountId, role: 'agent' }, { postId: post._id, organizationId: profile.organizationId, postType: post.postType });
  return post.toObject();
}

export async function updateDraft(agentAccountId, postId, data) {
  const { profile } = await resolveAgentScope(agentAccountId);
  const post = await AgentMarketplacePost.findOne({ _id: postId, organizationId: profile.organizationId });
  if (!post) throw error('Marketplace post not found', 404);
  if (![[PS.DRAFT, MS.NOT_SUBMITTED], [PS.SUBMITTED, MS.NEEDS_CHANGES]].some(([p, m]) => post.publicationStatus === p && post.moderationStatus === m)) throw error('Post cannot be edited in its current state', 409);
  const input = { ...post.toObject(), ...normalizedInput(data) }; validateMarketplaceContent(input);
  await validateRelatedRecords(input, profile.organizationId); const sources = await sourceState(input);
  for (const [key, value] of Object.entries(normalizedInput(data))) post[key] = value;
  post.sourceIds = sources.sourceIds; post.sourceFreshnessState = sources.freshness;
  await post.save();
  await audit('agent_marketplace_draft_updated', { userId: agentAccountId, role: 'agent' }, { postId: post._id, organizationId: profile.organizationId });
  return post.toObject();
}

export async function submitPost(agentAccountId, postId) {
  const { profile } = await resolveAgentScope(agentAccountId); await assertApprovedVerification(profile.organizationId);
  const post = await AgentMarketplacePost.findOne({ _id: postId, organizationId: profile.organizationId });
  if (!post) throw error('Marketplace post not found', 404);
  if (!((post.publicationStatus === PS.DRAFT && post.moderationStatus === MS.NOT_SUBMITTED) || post.moderationStatus === MS.NEEDS_CHANGES)) throw error('Post cannot be submitted in its current state', 409);
  validateMarketplaceContent(post.toObject(), { forPublication: true }); await validateRelatedRecords(post.toObject(), profile.organizationId);
  const sources = await sourceState(post.toObject());
  if (requiresMarketplaceProvenance(post) && [FRESHNESS_STATES.BROKEN, FRESHNESS_STATES.UNKNOWN].includes(sources.freshness)) throw error('Factual claims require verified, available provenance', 422);
  await event(post, MS.PENDING, 'submitted', agentAccountId, 'agent');
  post.publicationStatus = PS.SUBMITTED; post.moderationStatus = MS.PENDING; post.moderationFeedback = ''; post.sourceFreshnessState = sources.freshness; await post.save();
  await audit('agent_marketplace_submitted', { userId: agentAccountId, role: 'agent' }, { postId: post._id, organizationId: profile.organizationId }); return post.toObject();
}

export async function archivePost(agentAccountId, postId) {
  const { profile } = await resolveAgentScope(agentAccountId);
  const post = await AgentMarketplacePost.findOne({ _id: postId, organizationId: profile.organizationId }); if (!post) throw error('Marketplace post not found', 404);
  await event(post, MS.ARCHIVED, 'archived', agentAccountId, 'agent'); post.publicationStatus = PS.ARCHIVED; post.moderationStatus = MS.ARCHIVED; post.archivedAt = new Date(); await post.save();
  await audit('agent_marketplace_archived', { userId: agentAccountId, role: 'agent' }, { postId: post._id, organizationId: profile.organizationId }); return post.toObject();
}

export async function listOwnPosts(agentAccountId, { status, page = 1, limit = 20 } = {}) {
  const { profile } = await resolveAgentScope(agentAccountId); const query = { organizationId: profile.organizationId }; if (status) query.moderationStatus = status;
  const p = Math.max(1, parseInt(page, 10) || 1), l = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const [posts, total] = await Promise.all([AgentMarketplacePost.find(query).sort({ updatedAt: -1 }).skip((p-1)*l).limit(l).lean(), AgentMarketplacePost.countDocuments(query)]);
  return { posts, total, page: p, limit: l, pages: Math.ceil(total/l) };
}
export async function getOwnPost(agentAccountId, postId) { const { profile } = await resolveAgentScope(agentAccountId); const post = await AgentMarketplacePost.findOne({ _id: postId, organizationId: profile.organizationId }).lean(); if (!post) throw error('Marketplace post not found', 404); return post; }
export async function marketplaceCounts(agentAccountId) { const { profile } = await resolveAgentScope(agentAccountId); const rows = await AgentMarketplacePost.aggregate([{ $match: { organizationId: profile.organizationId } }, { $group: { _id: '$moderationStatus', count: { $sum: 1 } } }]); return Object.fromEntries(rows.map((r) => [r._id, r.count])); }

async function publicProjection(post) {
  const [profile, org, evidence, service, sources, refs] = await Promise.all([
    AgentProfile.findOne({ organizationId: post.organizationId }).select('slug professionalName agentType countryCode languages website').lean(),
    Organization.findById(post.organizationId).select('displayName organizationType countryCode slug').lean(),
    VerificationEvidence.find({ organizationId: post.organizationId, status: 'accepted' }).select('evidenceType status').lean(),
    post.relatedAgentServiceId ? AgentService.findOne({ _id: post.relatedAgentServiceId, organizationId: post.organizationId, status: 'active' }).select('title category countriesServed destinationCountries deliveryMode pricingMode durationEstimate').lean() : null,
    CanonicalSource.find({ _id: { $in: post.sourceIds || [] } }).select('url label publisher authorityType status lastVerifiedAt nextReviewAt').lean(),
    resolvePublicReferences(post.canonicalReferences || []),
  ]);
  return { id: post._id, slug: post.slug, postType: post.postType, title: post.title, summary: post.summary, agentStatement: post.agentStatement, contentKind: post.contentKind, factualClaims: post.factualClaims, targetCountries: post.targetCountries, destinationCountries: post.destinationCountries, degreeCategories: post.degreeCategories, careerCategories: post.careerCategories, journeyCategories: post.journeyCategories, languages: post.languages, effectiveAt: post.effectiveAt, startsAt: post.startsAt, endsAt: post.endsAt, publishedAt: post.publishedAt, current: isMarketplaceCurrentlyActive(post), sourceFreshnessState: post.sourceFreshnessState, freshnessWarning: freshnessWarning(post.sourceFreshnessState), sources, canonicalReferences: refs, relatedService: service, organization: org, agent: profile, trustBadges: deriveBadges(evidence), platformInformation: 'Agent statements are third-party assertions. Canonical facts and sources are displayed separately; Strideto does not guarantee outcomes.' };
}

async function resolvePublicReferences(refs) {
  const modelMap = { program: [Program, 'name slug degreeLevel field country freshnessState lastVerifiedAt'], canonical_scholarship: [CanonicalScholarship, 'title slug destinationCountries degreeLevels freshnessState lastVerifiedAt'], test: [Test, 'name shortName slug category officialWebsite'], canonical_institution: [CanonicalInstitution, 'officialName slug countryCode city institutionType officialWebsite'] };
  const result = [];
  for (const ref of refs) { const pair = modelMap[ref.referenceType]; if (!pair) continue; const doc = await pair[0].findOne({ _id: ref.referenceId, status: 'published' }).select(pair[1]).lean(); if (doc) result.push({ referenceType: ref.referenceType, ...doc }); }
  return result;
}

export async function listPublicMarketplace({ agentType, serviceType, postType, destinationCountry, serviceCountry, language, journeyType, relatedOpportunityType, freshness, page = 1, limit = 20 } = {}) {
  const approved = await OrganizationVerification.find({ status: VERIFICATION_STATUSES.APPROVED }).distinct('organizationId');
  let orgIds = approved;
  if (agentType || serviceCountry || language) { const pq = { organizationId: { $in: approved } }; if (agentType) pq.agentType = agentType; if (serviceCountry) pq.serviceCountries = serviceCountry.toUpperCase(); if (language) pq.languages = language.toLowerCase(); orgIds = await AgentProfile.find(pq).distinct('organizationId'); }
  const now = new Date(); const query = { organizationId: { $in: orgIds }, publicationStatus: PS.PUBLISHED, moderationStatus: MS.APPROVED, $and: [{ $or: [{ effectiveAt: null }, { effectiveAt: { $lte: now } }] }, { $or: [{ endsAt: null }, { endsAt: { $gt: now } }] }] };
  if (postType) query.postType = postType; if (destinationCountry) query.destinationCountries = destinationCountry.toUpperCase(); if (journeyType) query.journeyCategories = journeyType; if (freshness) query.sourceFreshnessState = freshness; if (relatedOpportunityType) query['canonicalReferences.referenceType'] = relatedOpportunityType;
  if (serviceType) { const serviceIds = await AgentService.find({ organizationId: { $in: orgIds }, category: serviceType, status: 'active' }).distinct('_id'); query.relatedAgentServiceId = { $in: serviceIds }; }
  const p = Math.max(1, parseInt(page, 10)||1), l = Math.min(50, Math.max(1, parseInt(limit, 10)||20)); const [raw,total] = await Promise.all([AgentMarketplacePost.find(query).sort({ publishedAt: -1 }).skip((p-1)*l).limit(l).lean(), AgentMarketplacePost.countDocuments(query)]);
  return { posts: await Promise.all(raw.map(publicProjection)), total, page:p, limit:l, pages:Math.ceil(total/l) };
}

export async function getPublicPost(slug) { const post = await AgentMarketplacePost.findOne({ slug }).lean(); if (!post || !isMarketplaceCurrentlyActive(post)) throw error('Marketplace post not found', 404); const approved = await OrganizationVerification.exists({ organizationId: post.organizationId, status: VERIFICATION_STATUSES.APPROVED }); if (!approved) throw error('Marketplace post not found', 404); return publicProjection(post); }

export async function createInterest(userId, slug, explicitConsent) {
  if (explicitConsent !== true) throw error('Explicit consent is required', 422); const post = await AgentMarketplacePost.findOne({ slug }).lean(); if (!post || !isMarketplaceCurrentlyActive(post) || !(await OrganizationVerification.exists({ organizationId: post.organizationId, status: VERIFICATION_STATUSES.APPROVED }))) throw error('Marketplace post not found', 404);
  const now = new Date(); const interest = await AgentMarketplaceInterest.findOneAndUpdate({ postId: post._id, userId }, { $set: { organizationId: post.organizationId, status: MARKETPLACE_INTEREST_STATUSES.ACTIVE, consentedAt: now, withdrawnAt: null } }, { upsert: true, new: true }).lean();
  await AgentLead.findOneAndUpdate({ organizationId: post.organizationId, userId }, { $setOnInsert: { source: 'marketplace_interest', context: `marketplace_post:${post._id}`, status: 'new' } }, { upsert: true, new: true });
  await audit('agent_marketplace_interest_created', { userId, role: 'User' }, { postId: post._id, organizationId: post.organizationId }); return { interestId: interest._id, status: interest.status };
}
export async function withdrawInterest(userId, slug) { const post = await AgentMarketplacePost.findOne({ slug }).select('_id organizationId').lean(); if (!post) throw error('Marketplace post not found', 404); const interest = await AgentMarketplaceInterest.findOneAndUpdate({ postId: post._id, userId, status: MARKETPLACE_INTEREST_STATUSES.ACTIVE }, { $set: { status: MARKETPLACE_INTEREST_STATUSES.WITHDRAWN, withdrawnAt: new Date() } }, { new: true }).lean(); if (!interest) throw error('Active interest not found', 404); const remaining = await AgentMarketplaceInterest.exists({ organizationId: post.organizationId, userId, status: MARKETPLACE_INTEREST_STATUSES.ACTIVE }); if (!remaining) await AgentLead.updateOne({ organizationId: post.organizationId, userId }, { $set: { status: 'closed' } }); await audit('agent_marketplace_interest_withdrawn', { userId, role: 'User' }, { postId: post._id, organizationId: post.organizationId }); return { status: interest.status }; }

export async function listModerationQueue(filters = {}) { const query = {}; if (filters.status) query.moderationStatus = filters.status; else query.moderationStatus = { $in: [MS.PENDING, MS.UNDER_REVIEW, MS.NEEDS_CHANGES] }; if (filters.organizationId) query.organizationId = filters.organizationId; if (filters.postType) query.postType = filters.postType; if (filters.country) query.destinationCountries = filters.country.toUpperCase(); if (filters.sourceStatus) query.sourceFreshnessState = filters.sourceStatus; const p=Math.max(1,parseInt(filters.page,10)||1),l=Math.min(50,Math.max(1,parseInt(filters.limit,10)||20)); const [posts,total]=await Promise.all([AgentMarketplacePost.find(query).sort({updatedAt:1}).skip((p-1)*l).limit(l).populate('organizationId','displayName organizationType countryCode').lean(),AgentMarketplacePost.countDocuments(query)]); return { posts,total,page:p,limit:l,pages:Math.ceil(total/l) }; }
export async function getModerationPost(postId) { const post=await AgentMarketplacePost.findById(postId).populate('organizationId','displayName organizationType countryCode').lean(); if(!post) throw error('Marketplace post not found',404); const [history,verification,evidence,sources]=await Promise.all([AgentMarketplaceModerationEvent.find({postId}).sort({createdAt:1}).lean(),OrganizationVerification.findOne({organizationId:post.organizationId._id}).select('status').lean(),VerificationEvidence.find({organizationId:post.organizationId._id,status:'accepted'}).select('evidenceType status').lean(),CanonicalSource.find({_id:{$in:post.sourceIds||[]}}).select('url label status authorityType lastVerifiedAt nextReviewAt').lean()]); return {post,history,verificationStatus:verification?.status||'draft',trustBadges:deriveBadges(evidence),sources,policySignals:marketplaceClaimSignals(post.title,post.summary,post.agentStatement,(post.factualClaims||[]).map(c=>c.statement))}; }
export async function moderatePost(adminId, postId, action, reason='') { const post=await AgentMarketplacePost.findById(postId); if(!post) throw error('Marketplace post not found',404); const negative=['request_changes','reject','suspend','archive']; if(negative.includes(action)&&!reason.trim()) throw error('A moderation reason is required',422); const transitions={begin_review:{from:[MS.PENDING],to:MS.UNDER_REVIEW},request_changes:{from:[MS.PENDING,MS.UNDER_REVIEW],to:MS.NEEDS_CHANGES},approve:{from:[MS.PENDING,MS.UNDER_REVIEW],to:MS.APPROVED},reject:{from:[MS.PENDING,MS.UNDER_REVIEW],to:MS.REJECTED},suspend:{from:[MS.APPROVED],to:MS.SUSPENDED},archive:{from:[MS.APPROVED,MS.REJECTED,MS.SUSPENDED],to:MS.ARCHIVED}}; const transition=transitions[action]; if(!transition||!transition.from.includes(post.moderationStatus)) throw error('Invalid moderation transition',409);
  if(action==='approve'){ await assertApprovedVerification(post.organizationId); validateMarketplaceContent(post.toObject(),{forPublication:true}); const sources=await sourceState(post.toObject()); if(requiresMarketplaceProvenance(post)&&[FRESHNESS_STATES.BROKEN,FRESHNESS_STATES.UNKNOWN].includes(sources.freshness)) throw error('Factual claims lack publishable provenance',422); post.publicationStatus=PS.PUBLISHED;post.publishedAt=new Date();post.sourceFreshnessState=sources.freshness; }
  if(action==='request_changes') post.publicationStatus=PS.SUBMITTED; if(action==='reject') post.publicationStatus=PS.SUBMITTED; if(action==='suspend') post.publicationStatus=PS.SUSPENDED; if(action==='archive'){post.publicationStatus=PS.ARCHIVED;post.archivedAt=new Date();}
  await event(post,transition.to,action,adminId,'admin',reason);post.moderationStatus=transition.to;post.moderationFeedback=reason;await post.save();await audit(`agent_marketplace_${action}`,{userId:adminId,role:'admin'},{postId:post._id,organizationId:post.organizationId,reason});return post.toObject(); }

export const agentMarketplaceInternals = Object.freeze({ slugify, validateMarketplaceContent, normalizedInput });
