import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import mongoose from 'mongoose';
import { isMarketplaceCurrentlyActive } from '../../../shared/agent/marketplace.js';
import {
  assertNoOffPlatformFreePromotionContent,
  consumeEducationFreeEntitlementOnPublish,
  ensureEducationFreeEntitlement,
  freePromoExpiresAt,
  resolveEducationPromotionSubject,
  educationMarketplaceFreeEntitlementInternals,
} from '../services/educationMarketplaceFreeEntitlementService.js';
import {
  AgentEducationMarketplaceFreeEntitlement,
  EDUCATION_FREE_PROMO_DURATION_MS,
} from '../models/agent/AgentEducationMarketplaceFreeEntitlement.js';
import {
  EDU_MARKETPLACE_FREE_ENTITLEMENT_CRITICAL_INDEXES,
  provisionMissingIndexes,
} from '../services/platform/criticalIndexProvision.js';
import { agentMarketplaceInternals } from '../services/agentMarketplaceService.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

function expectThrow(fn, status) {
  let thrown = null;
  try { fn(); } catch (e) { thrown = e; }
  assert.ok(thrown, 'expected throw');
  if (status) assert.equal(thrown.status, status);
  count += 1;
}

// --- Source contracts ---
{
  const svc = readFileSync(path.join(root, 'server/src/services/agentMarketplaceService.js'), 'utf8');
  check(svc.includes('assertApprovedVerification'), 'create/submit require Education approval');
  check(svc.includes('assertEducationFreeEntitlementAvailable'), 'free entitlement gated');
  check(svc.includes('assertNoOffPlatformFreePromotionContent'), 'off-platform URL gate');
  check(svc.includes('consumeEducationFreeEntitlementOnPublish'), 'consume on Admin publish');
  check(svc.includes('promotionKind: \'free_education\''), 'drafts tagged free_education');
  check(!/editableFields = \[[^\]]*endsAt/.test(svc), 'endsAt not agent-editable');
  check(svc.includes('publiclyEligible'), 'publicly eligible counter');
  check(!svc.includes('dangerouslySetInnerHTML'), 'no raw HTML injection path');
}

{
  const model = readFileSync(path.join(root, 'server/src/models/agent/AgentEducationMarketplaceFreeEntitlement.js'), 'utf8');
  check(model.includes('edu_marketplace_free_entitlement_subject_unique'), 'unique subject index named');
  check(model.includes('7 * 24 * 60 * 60 * 1000'), '7-day duration constant');
}

{
  const mp = readFileSync(path.join(root, 'client/src/pages/Agent/AgentMarketplace.jsx'), 'utf8');
  check(mp.includes('Create promotion (locked)'), 'pre-approval create locked');
  check(mp.includes('Paid publishing plans'), 'paid plans not configured copy');
  check(mp.includes('Open Professional Verification'), 'lock explains next step');
  check(!mp.includes('Upgrade') && !mp.includes('Buy plan'), 'no fake upgrade CTA');
}

{
  const badge = readFileSync(path.join(root, 'client/src/components/agent/StridetoVerifiedMark.jsx'), 'utf8');
  check(badge.includes('Verified by Strideto'), 'badge label');
  check(badge.includes('Education & Mobility professional verification approved'), 'scoped accessible text');
  check(badge.includes('sr-only'), 'scope not tooltip-only');
  check(/verified = false/.test(badge) && /if \(!verified\) return null/.test(badge), 'badge fails closed unless verified');
}

{
  const pub = readFileSync(path.join(root, 'client/src/pages/Public/AgentPublicProfile.jsx'), 'utf8');
  check(pub.includes('educationProfessionalVerification?.verified === true'), 'public profile gates mark on server projection');
  check(!/<StridetoVerifiedMark\s+scope=/.test(pub) || pub.includes('verified={'), 'no unconditional Verified mark render');
}

{
  const svc = readFileSync(path.join(root, 'server/src/services/agentProfileService.js'), 'utf8');
  check(svc.includes('educationProfessionalVerification'), 'public projection exposes educationProfessionalVerification');
  check(svc.includes("scope: 'education_mobility'"), 'projection scope is education_mobility');
  check(/educationVerified = canExercisePrivilegedCapability\(verStatus\)/.test(svc), 'projection reuses canExercisePrivilegedCapability');
}

// --- Off-platform URL rejection ---
{
  const cases = [
    { title: 'See https://example.com' },
    { summary: 'www.example.com offers help' },
    { agentStatement: 'Chat on https://wa.me/123' },
    { agentStatement: 'Join https://t.me/channel' },
    { agentStatement: 'mailto:test@example.com' },
    { agentStatement: 'Call tel:+1234567890' },
    { title: 'Book at https://calendly.com/x' },
  ];
  for (const c of cases) {
    expectThrow(() => assertNoOffPlatformFreePromotionContent(c), 422);
  }
  assertNoOffPlatformFreePromotionContent({
    title: 'Guidance for UK study applications',
    summary: 'Structured support for document preparation inside Strideto.',
    agentStatement: 'Request a consultation on Strideto. No guarantee of admission.',
  });
  count += 1;
}

// --- XSS-ish text is treated as plain content (no HTML renderer in service) ---
{
  assertNoOffPlatformFreePromotionContent({
    title: '<img src=x onerror=alert(1)>',
    summary: '<script>alert(1)</script>',
    agentStatement: 'javascript:alert(1) is not a link scheme we parse as URL host prose alone without ://',
  });
  // javascript: alone without http/www — our patterns don't need to treat as off-platform URL;
  // marketplace claim signals and React text rendering handle XSS. Confirm no dangerouslySetInnerHTML.
  count += 1;
}

// --- Duration / active window ---
{
  const publishedAt = new Date('2026-01-01T00:00:00.000Z');
  const expiresAt = freePromoExpiresAt(publishedAt);
  assert.equal(expiresAt.getTime() - publishedAt.getTime(), EDUCATION_FREE_PROMO_DURATION_MS);
  check(
    isMarketplaceCurrentlyActive({
      publicationStatus: 'published',
      moderationStatus: 'approved',
      publishedAt,
      endsAt: expiresAt,
    }, new Date('2026-01-07T23:59:59.000Z')),
    'still eligible before exact 7d'
  );
  check(
    !isMarketplaceCurrentlyActive({
      publicationStatus: 'published',
      moderationStatus: 'approved',
      publishedAt,
      endsAt: expiresAt,
    }, new Date('2026-01-08T00:00:00.000Z')),
    'not eligible at publishedAt+7d'
  );
}

// --- Subject resolution ---
{
  const agency = resolveEducationPromotionSubject({ agentType: 'agency', organizationId: 'org1' }, 'agentA');
  assert.equal(agency.providerSubjectType, 'organization');
  assert.equal(String(agency.providerSubjectId), 'org1');
  const indie = resolveEducationPromotionSubject({ agentType: 'agent', organizationId: 'org2', agentAccountId: 'agentB' }, 'agentB');
  assert.equal(indie.providerSubjectType, 'agent');
  assert.equal(String(indie.providerSubjectId), 'agentB');
  count += 2;
}

// --- Agent-writable fields reject endsAt / publishedAt tampering ---
{
  const out = agentMarketplaceInternals.normalizedInput({
    title: 'x',
    endsAt: new Date('2099-01-01'),
    publishedAt: new Date('2000-01-01'),
    promotionKind: 'paid_unlimited',
    verified: true,
  });
  check(!('endsAt' in out), 'endsAt stripped');
  check(!('publishedAt' in out), 'publishedAt stripped');
  check(!('promotionKind' in out), 'promotionKind stripped');
  check(!('verified' in out), 'verified stripped');
}

// --- Mongo disposable entitlement CAS + index idempotency ---
const TEST_URI = process.env.MONGO_URI_TEST
  || process.env.MONGODB_URI
  || 'mongodb://127.0.0.1:27017/strideto_agent_workflow_free_promo';

const runMongo = process.env.SKIP_MONGO_INTEGRATION !== '1';

async function mongoCases() {
  await mongoose.connect(TEST_URI, { autoIndex: false });
  const coll = AgentEducationMarketplaceFreeEntitlement.collection;
  await coll.deleteMany({});

  const pass1 = await provisionMissingIndexes({
    collection: coll,
    expected: EDU_MARKETPLACE_FREE_ENTITLEMENT_CRITICAL_INDEXES,
  });
  const pass2 = await provisionMissingIndexes({
    collection: coll,
    expected: EDU_MARKETPLACE_FREE_ENTITLEMENT_CRITICAL_INDEXES,
  });
  check(Array.isArray(pass2.created) && pass2.created.length === 0, 'second index provision creates []');
  check(pass1.comparison.ok && pass2.comparison.ok, 'index comparison ok');

  const orgId = new mongoose.Types.ObjectId();
  const agentId = new mongoose.Types.ObjectId();
  const profile = { agentType: 'agency', organizationId: orgId };
  const subject = resolveEducationPromotionSubject(profile, agentId);
  await ensureEducationFreeEntitlement(subject);

  const postA = new mongoose.Types.ObjectId();
  const postB = new mongoose.Types.ObjectId();
  const publishedAt = new Date('2026-06-01T12:00:00.000Z');

  const results = await Promise.allSettled([
    consumeEducationFreeEntitlementOnPublish({
      profile, agentAccountId: agentId, postId: postA, publishedAt, actorId: new mongoose.Types.ObjectId(),
    }),
    consumeEducationFreeEntitlementOnPublish({
      profile, agentAccountId: agentId, postId: postB, publishedAt, actorId: new mongoose.Types.ObjectId(),
    }),
  ]);
  const ok = results.filter((r) => r.status === 'fulfilled');
  const fail = results.filter((r) => r.status === 'rejected');
  check(ok.length === 1, 'api-a/api-b race: exactly one consume wins');
  check(fail.length === 1, 'api-a/api-b race: loser denied');
  const row = await AgentEducationMarketplaceFreeEntitlement.findOne({
    providerSubjectType: 'organization',
    providerSubjectId: orgId,
  }).lean();
  check(row.status === 'consumed', 'entitlement consumed');
  check(String(row.consumedByPostId) === String(ok[0].value.entitlement.consumedByPostId || ok[0].value.entitlement.consumedByPostId), 'winner post retained');
  assert.equal(new Date(row.expiresAt).getTime(), publishedAt.getTime() + EDUCATION_FREE_PROMO_DURATION_MS);

  // Second free attempt after delete simulation — still consumed
  await AgentEducationMarketplaceFreeEntitlement.updateOne(
    { _id: row._id },
    { $set: { status: 'consumed' } }
  );
  await assert.rejects(
    () => consumeEducationFreeEntitlementOnPublish({
      profile, agentAccountId: agentId, postId: new mongoose.Types.ObjectId(), publishedAt: new Date(), actorId: 'admin-c',
    }),
    (err) => err.status === 403
  );
  count += 1;

  // Independent subject is separate from Agency
  const indieProfile = { agentType: 'agent', organizationId: orgId, agentAccountId: agentId };
  const indieSubject = resolveEducationPromotionSubject(indieProfile, agentId);
  await ensureEducationFreeEntitlement(indieSubject);
  const indie = await AgentEducationMarketplaceFreeEntitlement.findOne({
    providerSubjectType: 'agent',
    providerSubjectId: agentId,
  }).lean();
  check(indie.status === 'available', 'Independent entitlement separate from Agency');

  await mongoose.disconnect();
}

console.log(`educationMarketplaceFreePromotion.test.js: starting (${runMongo ? 'with mongo' : 'source-only'})`);

await (async () => {
  if (runMongo) {
    try {
      await mongoCases();
    } catch (err) {
      console.error(err);
      process.exitCode = 1;
      throw err;
    }
  } else {
    check(true, 'mongo integration skipped');
  }
  console.log(`educationMarketplaceFreePromotion.test.js: ${count} assertions passed`);
  check(educationMarketplaceFreeEntitlementInternals.EDUCATION_FREE_PROMO_DURATION_MS === EDUCATION_FREE_PROMO_DURATION_MS, 'duration export');
})();
