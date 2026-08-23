import {
  AgentEducationMarketplaceFreeEntitlement,
  EDUCATION_FREE_ENTITLEMENT_STATUSES as ES,
  EDUCATION_FREE_PROMO_DURATION_MS,
} from '../models/agent/AgentEducationMarketplaceFreeEntitlement.js';
import { AgentProfile } from '../models/agent/AgentProfile.js';
import { PROVIDER_DOMAIN_IDS } from '../../../shared/provider/providerDomains.js';
import { logAudit } from './auditService.js';

const error = (message, status = 400) => Object.assign(new Error(message), { status });

/**
 * Resolve the Provider subject that owns Education Marketplace free entitlement.
 * Agency → organization subject. Independent → agent subject.
 * Team members act under the Agency organization subject — never multiply entitlements.
 */
export function resolveEducationPromotionSubject(profile, agentAccountId) {
  if (!profile?.organizationId) throw error('Agent profile organization required', 403);
  if (profile.agentType === 'agency') {
    return {
      providerSubjectType: 'organization',
      providerSubjectId: profile.organizationId,
      organizationId: profile.organizationId,
    };
  }
  return {
    providerSubjectType: 'agent',
    providerSubjectId: agentAccountId || profile.agentAccountId,
    organizationId: profile.organizationId,
  };
}

export async function ensureEducationFreeEntitlement(subject) {
  const filter = {
    providerSubjectType: subject.providerSubjectType,
    providerSubjectId: subject.providerSubjectId,
    domainId: PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY,
  };
  let row = await AgentEducationMarketplaceFreeEntitlement.findOne(filter);
  if (row) return row;
  try {
    row = await AgentEducationMarketplaceFreeEntitlement.create({
      ...filter,
      organizationId: subject.organizationId,
      status: ES.AVAILABLE,
    });
    return row;
  } catch (err) {
    if (err?.code === 11000) {
      return AgentEducationMarketplaceFreeEntitlement.findOne(filter);
    }
    throw err;
  }
}

export async function getEducationFreeEntitlementStatus(profile, agentAccountId) {
  const subject = resolveEducationPromotionSubject(profile, agentAccountId);
  const row = await ensureEducationFreeEntitlement(subject);
  return {
    providerSubjectType: subject.providerSubjectType,
    providerSubjectId: String(subject.providerSubjectId),
    domainId: PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY,
    status: row.status,
    available: row.status === ES.AVAILABLE,
    consumed: row.status === ES.CONSUMED,
    consumedAt: row.consumedAt,
    consumedByPostId: row.consumedByPostId ? String(row.consumedByPostId) : null,
    publishedAt: row.publishedAt,
    expiresAt: row.expiresAt,
    paidPublishingPlans: 'not_configured',
    durationMs: EDUCATION_FREE_PROMO_DURATION_MS,
  };
}

/**
 * Atomically consume the one-time free entitlement at first successful publication.
 * Concurrent api-a / api-b callers: exactly one wins (findOneAndUpdate CAS).
 */
export async function consumeEducationFreeEntitlementOnPublish({
  profile,
  agentAccountId,
  postId,
  publishedAt,
  actorId,
  actorRole = 'admin',
}) {
  const subject = resolveEducationPromotionSubject(profile, agentAccountId);
  await ensureEducationFreeEntitlement(subject);
  const published = publishedAt instanceof Date ? publishedAt : new Date(publishedAt);
  const expiresAt = new Date(published.getTime() + EDUCATION_FREE_PROMO_DURATION_MS);

  const updated = await AgentEducationMarketplaceFreeEntitlement.findOneAndUpdate(
    {
      providerSubjectType: subject.providerSubjectType,
      providerSubjectId: subject.providerSubjectId,
      domainId: PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY,
      status: ES.AVAILABLE,
    },
    {
      $set: {
        status: ES.CONSUMED,
        consumedAt: new Date(),
        consumedByPostId: postId,
        publishedAt: published,
        expiresAt,
      },
    },
    { new: true }
  );

  if (!updated) {
    const existing = await AgentEducationMarketplaceFreeEntitlement.findOne({
      providerSubjectType: subject.providerSubjectType,
      providerSubjectId: subject.providerSubjectId,
      domainId: PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY,
    }).lean();
    if (existing?.status === ES.CONSUMED && String(existing.consumedByPostId) === String(postId)) {
      return { entitlement: existing, expiresAt: existing.expiresAt, alreadyConsumed: true };
    }
    throw error('One-time free Education Marketplace promotion entitlement already used for this Provider subject', 403);
  }

  await logAudit({
    action: 'agent_marketplace_free_entitlement_consumed',
    actor: { userId: actorId, role: actorRole },
    metadata: {
      providerSubjectType: subject.providerSubjectType,
      providerSubjectId: String(subject.providerSubjectId),
      domainId: PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY,
      entitlementType: 'education_marketplace_free_promotion',
      postId: String(postId),
      transition: 'available→consumed',
      publishedAt: published.toISOString(),
      expiresAt: expiresAt.toISOString(),
    },
  });

  return { entitlement: updated.toObject(), expiresAt, alreadyConsumed: false };
}

export async function assertEducationFreeEntitlementAvailable(profile, agentAccountId) {
  const status = await getEducationFreeEntitlementStatus(profile, agentAccountId);
  if (!status.available) {
    throw error(
      'Free Education Marketplace promotion already used for this Provider subject. Paid publishing plans are not configured.',
      403
    );
  }
  return status;
}

/**
 * Reject off-platform diversion in free-promotion content.
 * Client validation is convenience only — this is authoritative.
 */
export function assertNoOffPlatformFreePromotionContent(data = {}) {
  const texts = [
    data.title,
    data.summary,
    data.agentStatement,
    data.ctaText,
    data.ctaUrl,
    data.website,
    data.externalUrl,
    ...(Array.isArray(data.factualClaims) ? data.factualClaims.map((c) => c.statement) : []),
  ]
    .filter((v) => typeof v === 'string')
    .join('\n');

  const patterns = [
    /https?:\/\//i,
    /\bwww\./i,
    /\bwa\.me\b/i,
    /\bt\.me\b/i,
    /\bmailto\s*:/i,
    /\btel\s*:/i,
    /\b(bit\.ly|tinyurl\.com|goo\.gl)\b/i,
    /\b(facebook|instagram|linkedin|twitter|x)\.com\b/i,
    /\b(whatsapp|telegram)\b/i,
  ];

  for (const re of patterns) {
    if (re.test(texts)) {
      throw error(
        'Free Education Marketplace promotions cannot include off-platform URLs, social links, WhatsApp/Telegram, mailto, tel, or external booking CTAs. Keep responses inside Strideto.',
        422
      );
    }
  }
}

export async function loadProfileForEntitlement(agentAccountId) {
  const profile = await AgentProfile.findOne({ agentAccountId }).lean();
  if (!profile) throw error('Agent profile not found', 404);
  return profile;
}

export function freePromoExpiresAt(publishedAt) {
  const published = publishedAt instanceof Date ? publishedAt : new Date(publishedAt);
  return new Date(published.getTime() + EDUCATION_FREE_PROMO_DURATION_MS);
}

export const educationMarketplaceFreeEntitlementInternals = Object.freeze({
  resolveEducationPromotionSubject,
  EDUCATION_FREE_PROMO_DURATION_MS,
  ES,
});
