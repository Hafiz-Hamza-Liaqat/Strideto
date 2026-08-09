/**
 * Mission 1 — International Foundation contract tests.
 *
 * Pure-contract tests (no DB). Run:
 *   node src/__tests__/internationalFoundation.test.js
 */
import assert from 'assert';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const load = (rel) =>
  import(pathToFileURL(path.resolve(__dirname, '../../../shared/international', rel)).href);

const country = await load('country.js');
const currency = await load('currency.js');
const money = await load('money.js');
const timezone = await load('timezone.js');
const geo = await load('geo.js');
const address = await load('address.js');
const phone = await load('phone.js');
const realms = await load('realms.js');
const organization = await load('organization.js');
const audit = await load('audit.js');
const evidence = await load('evidence.js');
const notif = await load('notificationPreferences.js');
const rollout = await load('rolloutConfig.js');

let passed = 0;
const check = async (label, fn) => {
  await fn();
  passed += 1;
  console.log(`  ok - ${label}`);
};

// 1. Country normalization / validation
await check('country normalization + validation', () => {
  assert.strictEqual(country.normalizeCountryCode('pk'), 'PK');
  assert.strictEqual(country.normalizeCountryCode(' Us '), 'US');
  assert.strictEqual(country.normalizeCountryCode('ZZ'), null);
  assert.strictEqual(country.normalizeCountryCode('PAK'), null);
  assert.strictEqual(country.isValidCountryCode('gb'), true);
  assert.strictEqual(country.isValidCountryCode(''), false);
  // No implicit Pakistan default — junk stays null, never coerced to PK.
  assert.strictEqual(country.coerceCountryCode('Pakistan'), 'PK');
  assert.strictEqual(country.coerceCountryCode('Nowhereland'), null);
  assert.strictEqual(country.countryDisplayName('PK'), 'Pakistan');
  assert.strictEqual(country.normalizeSubdivisionCode('us-ca'), 'US-CA');
  assert.strictEqual(country.normalizeSubdivisionCode('ZZ-XX'), null);
});

// 2. Currency normalization / validation
await check('currency normalization + validation', () => {
  assert.strictEqual(currency.normalizeCurrency('usd'), 'USD');
  assert.strictEqual(currency.normalizeCurrency('PKR'), 'PKR');
  assert.strictEqual(currency.normalizeCurrency('US$'), null);
  assert.strictEqual(currency.normalizeCurrency('ZZZ'), null);
  assert.strictEqual(currency.isValidCurrency('jpy'), true);
});

// 3. Money serialization + minor-unit safety
await check('money minor units + serialization + FP safety', () => {
  assert.strictEqual(currency.currencyMinorUnits('USD'), 2);
  assert.strictEqual(currency.currencyMinorUnits('JPY'), 0); // zero-decimal
  assert.strictEqual(currency.currencyMinorUnits('KWD'), 3); // three-decimal
  assert.strictEqual(currency.isZeroDecimalCurrency('JPY'), true);

  const m = money.makeMoney(1050, 'usd');
  assert.deepStrictEqual({ ...m }, { amountMinor: 1050, currency: 'USD' });
  assert.strictEqual(money.serializeMoney(m), '1050 USD');
  assert.deepStrictEqual({ ...money.deserializeMoney('1050 USD') }, { amountMinor: 1050, currency: 'USD' });

  // Non-integer minor units rejected — no floating point money.
  assert.throws(() => money.makeMoney(10.5, 'USD'));
  // FP-noisy decimal converts exactly, not 1004.9999…
  assert.strictEqual(money.fromDecimal('10.05', 'USD').amountMinor, 1005);
  assert.strictEqual(money.fromDecimal(1050, 'JPY').amountMinor, 1050); // zero-decimal scale
  assert.strictEqual(money.toDecimalString(m), '10.50');
  assert.strictEqual(money.toDecimalString(money.makeMoney(1050, 'JPY')), '1050');
  // Same-currency add; mixed-currency refused.
  assert.strictEqual(money.addMoney(m, money.makeMoney(50, 'USD')).amountMinor, 1100);
  assert.throws(() => money.addMoney(m, money.makeMoney(50, 'EUR')));
});

// 4. Timezone validation
await check('timezone validation + fallback formatting', () => {
  assert.strictEqual(timezone.isValidTimeZone('Asia/Karachi'), true);
  assert.strictEqual(timezone.isValidTimeZone('UTC'), true);
  assert.strictEqual(timezone.isValidTimeZone('+05:00'), false); // offset != zone
  assert.strictEqual(timezone.isValidTimeZone('Mars/Phobos'), false);
  assert.strictEqual(timezone.normalizeTimeZone('  America/New_York '), 'America/New_York');
  // Missing zone falls back to a labeled UTC render, never a silent guess.
  const out = timezone.formatInstantInZone('2026-01-01T00:00:00Z', undefined);
  assert.ok(typeof out === 'string' && out.length > 0);
});

// 5 + 6 + 7. Address, coordinates, Google Maps URL boundary
await check('address + coordinate + maps-url validation', () => {
  const good = address.validateAddress({ addressLine1: '1 St', city: 'Lahore', countryCode: 'pk' });
  assert.strictEqual(good.ok, true);
  assert.strictEqual(good.value.countryCode, 'PK');
  // countryCode is the only hard requirement.
  assert.strictEqual(address.validateAddress({}).ok, false);

  // Coordinates: both or neither, and in range.
  assert.throws(() => geo.normalizeCoordinates({ latitude: 10 })); // lone coord
  assert.throws(() => geo.normalizeCoordinates({ latitude: 200, longitude: 0 })); // out of range
  assert.deepStrictEqual(geo.normalizeCoordinates({ latitude: 24.8, longitude: 67 }), {
    latitude: 24.8,
    longitude: 67,
  });
  assert.strictEqual(geo.normalizeCoordinates({}), null);

  // Google Maps URL boundary: accept genuine HTTPS maps links, reject others.
  assert.strictEqual(geo.isGoogleMapsUrl('https://maps.google.com/?q=1,2'), true);
  assert.strictEqual(geo.isGoogleMapsUrl('https://www.google.com/maps/place/x'), true);
  assert.strictEqual(geo.isGoogleMapsUrl('https://maps.app.goo.gl/abcd'), true);
  assert.strictEqual(geo.isGoogleMapsUrl('http://maps.google.com/'), false); // not https
  assert.strictEqual(geo.isGoogleMapsUrl('https://www.google.com/search?q=x'), false); // not /maps
  assert.strictEqual(geo.isGoogleMapsUrl('https://evil.example.com/maps'), false); // wrong host
  const badMaps = address.validateAddress({ countryCode: 'US', googleMapsUrl: 'https://evil.com/x' });
  assert.strictEqual(badMaps.ok, false);
});

// 8. Phone normalization / validation
await check('phone E.164 normalization', () => {
  assert.strictEqual(phone.normalizePhone('+92 300 1234567'), '+923001234567');
  assert.strictEqual(phone.normalizePhone('0092-300-1234567'), '+923001234567'); // 00 prefix
  assert.strictEqual(phone.isE164('+14155552671'), true);
  // No leading + and no explicit dialing code → cannot attribute a country.
  assert.strictEqual(phone.normalizePhone('03001234567'), null);
  // Explicit dialing code supplied → local number canonicalizes (no +92 assumed).
  assert.strictEqual(
    phone.normalizePhone('0300 1234567', { defaultCountryCallingCode: '92' }),
    '+923001234567'
  );
  assert.strictEqual(phone.normalizePhone('not a phone'), null);
});

// 9 + 10. Organization slug uniqueness + type validation
await check('organization slug uniqueness + type/status validation', async () => {
  assert.strictEqual(organization.isValidOrganizationType('university'), true);
  assert.strictEqual(organization.isValidOrganizationType('nonprofit'), false);
  assert.strictEqual(organization.isValidOrganizationStatus('active'), true);
  assert.strictEqual(organization.organizationSlugBase('Acme  Corp!!'), 'acme-corp');
  assert.strictEqual(organization.organizationSlugBase(''), 'organization');

  const taken = new Set(['acme-corp']);
  const slug = await organization.ensureUniqueOrganizationSlug('Acme Corp', (s) => taken.has(s));
  assert.strictEqual(slug, 'acme-corp-2'); // collision-safe

  const core = organization.validateOrganizationCore({
    organizationType: 'agency',
    displayName: 'Global Study Agency',
    countryCode: 'ae',
  });
  assert.strictEqual(core.ok, true);
  assert.strictEqual(core.value.countryCode, 'AE');
  assert.strictEqual(core.value.status, 'draft');
  assert.strictEqual(organization.validateOrganizationCore({ organizationType: 'x' }).ok, false);
});

// 11. Legacy Employer compatibility
await check('legacy employer address compatibility adapter', () => {
  const adapted = address.fromLegacyEmployer({
    location: '5 Mall Rd',
    city: 'Karachi',
    province: 'Sindh',
    country: 'Pakistan',
  });
  assert.strictEqual(adapted.countryCode, 'PK'); // name coerced to code
  assert.strictEqual(adapted.city, 'Karachi');
  // Unknown legacy country yields no fabricated default.
  const noCountry = address.fromLegacyEmployer({ location: 'x', city: 'y' });
  assert.strictEqual('countryCode' in noCountry, false);
});

// 12. Realm constants cannot collide / drift
await check('realm vocabulary integrity', () => {
  assert.strictEqual(realms.assertRealmIntegrity(), true);
  assert.strictEqual(realms.isValidRealm('employer'), true);
  assert.strictEqual(realms.isActiveRealm('agent'), false); // declared, not live
  assert.strictEqual(realms.isValidRealm('AGENT'), false); // casing drift rejected
  assert.deepStrictEqual([...realms.ACTIVE_REALMS].sort(), ['admin', 'employer', 'user']);
});

// 13. Audit metadata rejects sensitive keys
await check('audit primitive rejects sensitive metadata', () => {
  assert.strictEqual(audit.isForbiddenMetadataKey('password'), true);
  assert.strictEqual(audit.isForbiddenMetadataKey('authToken'), true);
  assert.strictEqual(audit.isForbiddenMetadataKey('card_number'), true);
  assert.strictEqual(audit.isForbiddenMetadataKey('jobTitle'), false);
  assert.deepStrictEqual(
    audit.findForbiddenMetadataKeys({ ok: 1, nested: { cvv: '123' } }),
    ['nested.cvv']
  );
  const good = audit.validateAuditRecord({
    actorRealm: 'admin',
    action: 'organization.created',
    metadata: { orgId: 'x', country: 'PK' },
  });
  assert.strictEqual(good.ok, true);
  const bad = audit.validateAuditRecord({
    actorRealm: 'admin',
    action: 'x',
    metadata: { password: 'nope' },
  });
  assert.strictEqual(bad.ok, false);
  // Unknown realm rejected.
  assert.strictEqual(audit.validateAuditRecord({ actorRealm: 'ghost', action: 'x' }).ok, false);
});

// 14. Source / evidence validation
await check('source / evidence validation', () => {
  const ok = evidence.validateSource({
    sourceType: 'official',
    sourceUrl: 'https://hec.gov.pk/x',
    publisher: 'HEC',
    retrievedAt: '2026-01-01T00:00:00Z',
  });
  assert.strictEqual(ok.ok, true);
  assert.strictEqual(evidence.validateSource({ sourceType: 'nope', sourceUrl: 'https://x' }).ok, false);
  assert.strictEqual(evidence.validateSource({ sourceType: 'official', sourceUrl: 'ftp://x' }).ok, false);
  // A web source needs a url or an evidence ref.
  assert.strictEqual(evidence.validateSource({ sourceType: 'third_party' }).ok, false);
  // A document source may carry only an evidenceRef.
  assert.strictEqual(evidence.validateSource({ sourceType: 'document', evidenceRef: 'doc_1' }).ok, true);
});

// 15. Notification preference validation
await check('notification preferences: marketing separable from transactional', () => {
  const res = notif.validateNotificationPreferences({
    promotions: { email: false, in_app: true },
    applications: { email: false }, // transactional — cannot be silenced
  });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.value.promotions.email, false); // marketing opt-out honored
  assert.strictEqual(res.value.applications.email, true); // transactional coerced on
  assert.ok(res.coerced.includes('applications.email'));
  assert.strictEqual(notif.isTransactionalCategory('applications'), true);
  assert.strictEqual(notif.isTransactionalCategory('promotions'), false);
  // Unknown category/channel rejected.
  assert.strictEqual(notif.validateNotificationPreferences({ bogus: { email: true } }).ok, false);
  assert.strictEqual(notif.validateNotificationPreferences({ jobs: { fax: true } }).ok, false);
});

// 16. Country / feature configuration resolution
await check('rollout config resolution by specificity', () => {
  const table = {
    feature: 'payment_available',
    rules: [
      { value: false }, // default
      { countryCode: 'US', value: true },
      { countryCode: 'US', organizationType: 'university', value: false },
    ],
  };
  assert.strictEqual(rollout.validateRolloutTable(table).ok, true);
  assert.strictEqual(rollout.resolveFeature(table, { countryCode: 'PK' }), false); // default
  assert.strictEqual(rollout.resolveFeature(table, { countryCode: 'us' }), true); // country rule
  assert.strictEqual(
    rollout.resolveFeature(table, { countryCode: 'US', organizationType: 'university' }),
    false // most specific wins
  );
  // Invalid rule country is caught by validation.
  assert.strictEqual(
    rollout.validateRolloutTable({ feature: 'x', rules: [{ countryCode: 'ZZ', value: 1 }] }).ok,
    false
  );
});

console.log(`\ninternationalFoundation.test.js — ${passed} checks passed`);
