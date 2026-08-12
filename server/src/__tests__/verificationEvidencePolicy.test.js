/**
 * Track AA — evidence acceptance policy tests.
 *
 * Run: node src/__tests__/verificationEvidencePolicy.test.js
 */
import assert from 'assert';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const load = (rel) =>
  import(pathToFileURL(path.resolve(__dirname, '../../../shared/international', rel)).href);

const policy = await load('evidencePolicy.js');
const ver = await load('verification.js');

let passed = 0;
const check = async (label, fn) => {
  try {
    await fn();
    passed += 1;
    console.log(`  ok - ${label}`);
  } catch (err) {
    console.error(`  FAIL - ${label}`);
    console.error(`       ${err.message}`);
    process.exitCode = 1;
  }
};

const ORDINARY_SITE = 'https://example-company.com/about';
const MAPS_URL = 'https://www.google.com/maps/place/Test';

await check('ordinary website rejected for professional_license accept', () => {
  const result = policy.validateEvidenceAcceptance(ver.EVIDENCE_TYPES.PROFESSIONAL_LICENSE, ORDINARY_SITE);
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.code, 'WEBSITE_NOT_CREDENTIAL');
});

await check('ordinary website rejected for accreditation accept', () => {
  const result = policy.validateEvidenceAcceptance(ver.EVIDENCE_TYPES.ACCREDITATION, ORDINARY_SITE);
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.code, 'WEBSITE_NOT_CREDENTIAL');
});

await check('professional_license accept blocked for ordinary website (no badge path)', () => {
  const accept = policy.validateEvidenceAcceptance(ver.EVIDENCE_TYPES.PROFESSIONAL_LICENSE, ORDINARY_SITE);
  assert.strictEqual(accept.ok, false);
  assert.strictEqual(accept.code, 'WEBSITE_NOT_CREDENTIAL');
});

await check('accreditation accept blocked for ordinary website (no badge path)', () => {
  const accept = policy.validateEvidenceAcceptance(ver.EVIDENCE_TYPES.ACCREDITATION, ORDINARY_SITE);
  assert.strictEqual(accept.ok, false);
  assert.strictEqual(accept.code, 'WEBSITE_NOT_CREDENTIAL');
});

await check('Maps URL rejected as business_registration accept', () => {
  const result = policy.validateEvidenceAcceptance(ver.EVIDENCE_TYPES.BUSINESS_REGISTRATION, MAPS_URL);
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.code, 'MAPS_SUPPORTING_ONLY');
});

await check('Maps alone cannot create any VERIFIED badge via deriveBadges', () => {
  const records = [{ evidenceType: ver.EVIDENCE_TYPES.GOOGLE_MAPS, status: ver.EVIDENCE_STATUSES.ACCEPTED, sourceUrl: MAPS_URL }];
  const accept = policy.validateEvidenceAcceptance(records[0].evidenceType, records[0].sourceUrl);
  assert.strictEqual(accept.ok, true);
  const badges = ver.deriveBadges(records);
  assert.strictEqual(badges.length, 0);
});

await check('Maps rejected as physical_location accept', () => {
  const result = policy.validateEvidenceAcceptance(ver.EVIDENCE_TYPES.PHYSICAL_LOCATION, MAPS_URL);
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.code, 'MAPS_SUPPORTING_ONLY');
});

await check('Maps alone cannot create physical_location_verified badge', () => {
  const asLocation = [{ evidenceType: ver.EVIDENCE_TYPES.PHYSICAL_LOCATION, status: ver.EVIDENCE_STATUSES.ACCEPTED, sourceUrl: MAPS_URL }];
  assert.strictEqual(policy.validateEvidenceAcceptance(asLocation[0].evidenceType, asLocation[0].sourceUrl).ok, false);
  const asMaps = [{ evidenceType: ver.EVIDENCE_TYPES.GOOGLE_MAPS, status: ver.EVIDENCE_STATUSES.ACCEPTED, sourceUrl: MAPS_URL }];
  const badges = ver.deriveBadges(asMaps);
  assert.ok(!badges.includes('physical_location_verified'));
});

await check('describeEvidencePolicy marks Maps as supporting-only', () => {
  const meta = policy.describeEvidencePolicy(ver.EVIDENCE_TYPES.GOOGLE_MAPS);
  assert.strictEqual(meta.supportingOnly, true);
  assert.match(meta.maxTrustOutcome, /None/i);
});

console.log(`\nverificationEvidencePolicy: ${passed} checks passed`);
