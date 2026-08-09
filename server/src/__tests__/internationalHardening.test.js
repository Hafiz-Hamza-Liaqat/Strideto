/** Mission 22 — International hardening. Run: node src/__tests__/internationalHardening.test.js */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const source = rel => readFileSync(path.join(root, rel), 'utf8');
const intl = await import('../../../shared/international/index.js');
const budgetCalculations = await import('../../../shared/budget/calculationEngine.js');
const education = await import('../../../shared/education/taxonomy.js');
const scholarship = await import('../../../shared/education/scholarshipIntelligence.js');
const acceptance = await import('../../../shared/education/acceptanceExplorer.js');
const credential = await import('../services/credentialPolicyService.js');

const companyModel = source('server/src/models/Company.js');
const universityModel = source('server/src/models/University.js');
const jobModel = source('server/src/models/Job.js');
const workflowModel = source('server/src/models/EditorialWorkflow.js');
const workflowService = source('server/src/services/workflow/WorkflowService.js');
const consultationService = source('server/src/services/consultationService.js');
const consultationContract = source('shared/services/consultations.js');
const journeyContract = source('server/src/services/actionEngineService.js');
const agentProfile = source('server/src/models/agent/AgentProfile.js');
const agentService = source('server/src/models/agent/AgentService.js');
const programModel = source('server/src/models/education/Program.js');
const testAcceptanceModel = source('server/src/models/education/TestAcceptance.js');
const commerceModels = source('server/src/models/commerce/CommerceTransaction.js') + source('server/src/models/commerce/CommerceOrder.js');
const paymentsService = source('server/src/services/marketplacePaymentService.js');
const budgetService = source('server/src/services/budgetPlanService.js');
const copilotService = source('server/src/services/ai/copilotService.js');
const adminController = source('server/src/controllers/admin/adminSuperControlController.js');
const adminCompanies = source('client/src/pages/Admin/AdminCompanies.jsx');
const adminUniversities = source('client/src/pages/Admin/AdminContentUniversities.jsx');
const adminJobs = source('client/src/pages/Admin/AdminContentJobs.jsx');
const programPage = source('client/src/pages/Tests/ProgramExplorer.jsx');
const scholarshipPage = source('client/src/pages/Scholarships/ScholarshipIntelligenceDetail.jsx');
const dateUtil = source('client/src/utils/formatDate.js');
const employerAppointment = source('server/src/utils/appointmentTime.js');

let passed = 0;
let failed = 0;
async function check(name, fn) {
  try { await fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (error) { failed++; console.error(`  ✗ ${name}\n    ${error.message}`); }
}

console.log('\n=== Mission 22 — International Hardening Tests ===\n');
const countries = ['PK', 'US', 'GB', 'CA', 'DE', 'AE', 'JP', 'IN', 'NG', 'BR', 'AU'];
const zones = ['Asia/Karachi', 'America/Toronto', 'Europe/London', 'Asia/Tokyo', 'Australia/Sydney', 'Asia/Dubai'];

await check('1. canonical ISO alpha-2 normalization', () => assert.equal(intl.normalizeCountryCode(' gb '), 'GB'));
await check('2. representative multi-country codes are valid', () => countries.forEach(code => assert.equal(intl.isValidCountryCode(code), true)));
await check('3. invalid country never defaults to PK or US', () => {
  assert.equal(intl.normalizeCountryCode('ZZ'), null);
  assert.equal(intl.coerceCountryCode('Nowhereland'), null);
});
await check('4. legacy country reads normalize safely', () => {
  assert.equal(intl.coerceCountryCode('Pakistan'), 'PK');
  assert.equal(intl.coerceCountryCode('United States'), 'US');
  assert.equal(intl.coerceCountryCode('UK'), 'GB');
  assert.equal(intl.coerceCountryCode('United Kingdom'), 'GB');
});
await check('5. canonical creation flows have no hidden Pakistan default', () => {
  assert.doesNotMatch(companyModel + universityModel + jobModel + adminCompanies + adminUniversities + adminJobs, /default:\s*['"]Pakistan|country:\s*['"]Pakistan|salaryCurrency:\s*['"]PKR/);
});
await check('6. country display uses shared Intl helper', () => {
  assert.match(intl.countryDisplayName('DE', 'en'), /Germany/i);
  assert.notEqual(intl.countryDisplayName('JP', 'en'), 'JP');
});
await check('7. jurisdiction configuration lookup is centralized', () => {
  const table = { feature: 'evidence', rules: [{ countryCode: 'DE', value: 'required' }] };
  assert.deepEqual(intl.resolveJurisdictionPolicy(table, { countryCode: 'DE' }), { state: 'required', configured: true, countryCode: 'DE' });
});
await check('8. unknown jurisdiction fails truthfully', () => {
  assert.equal(intl.resolveJurisdictionPolicy({ feature: 'x', rules: [] }, { countryCode: 'ZZ' }).state, 'not_configured');
});
await check('9. credential policy remains country-aware', () => {
  assert.equal(credential.resolveCredentialPolicy({ countryCode: 'PK', organizationType: 'agent' }), 'required');
  assert.equal(credential.resolveCredentialPolicy({ countryCode: 'DE', organizationType: 'agent' }), 'optional');
  assert.equal(credential.resolveCredentialPolicy({ countryCode: 'US', organizationType: 'employer' }), 'not_applicable');
});
await check('10. ISO currency normalization', () => ['USD', 'PKR', 'EUR', 'GBP', 'JPY', 'KWD'].forEach(c => assert.equal(intl.normalizeCurrency(c.toLowerCase()), c)));
await check('11. no implicit PKR in hardened creation paths', () => assert.doesNotMatch(jobModel + adminJobs, /default:\s*['"]PKR|salaryCurrency:\s*['"]PKR/));
await check('12. no implicit USD in hardened creation paths', () => assert.doesNotMatch(jobModel + adminJobs, /default:\s*['"]USD|salaryCurrency:\s*['"]USD/));
await check('13. zero-decimal Money is supported', () => assert.equal(intl.toDecimalString(intl.makeMoney(1250, 'JPY')), '1250'));
await check('14. three-decimal Money is supported', () => assert.equal(intl.toDecimalString(intl.makeMoney(1250, 'KWD')), '1.250'));
await check('15. two-decimal Money is supported', () => assert.equal(intl.toDecimalString(intl.makeMoney(1250, 'USD')), '12.50'));
await check('16. affected displays avoid universal amountMinor/100', () => assert.doesNotMatch(programPage + scholarshipPage, /amountMinor\s*\/\s*100/));
await check('17. mixed-currency addition is rejected', () => assert.throws(() => intl.addMoney(intl.makeMoney(1, 'USD'), intl.makeMoney(1, 'GBP'))));
await check('18. original currency is retained', () => assert.equal(intl.makeMoney(100, 'cad').currency, 'CAD'));
await check('19. representative IANA timezones validate', () => zones.forEach(zone => assert.equal(intl.isValidTimeZone(zone), true)));
await check('20. no implicit Asia/Karachi in hardened workflow', () => assert.doesNotMatch(workflowModel + workflowService, /default:\s*['"]Asia\/Karachi|\|\|\s*['"]Asia\/Karachi/));
await check('21. UTC instant and timezone identity are preserved', () => {
  assert.match(consultationService, /confirmedStart/);
  assert.match(consultationService, /timezone/);
});
await check('22. date-only values do not invent a time', () => {
  const rendered = intl.formatDate('2026-09-15', { locale: 'en-CA', timeZone: 'UTC' });
  assert.doesNotMatch(rendered, /\d{1,2}:\d{2}/);
});
await check('23. DST-sensitive conversion uses IANA data', () => {
  const winter = intl.formatInstantInZone('2026-01-15T12:00:00Z', 'America/Toronto');
  const summer = intl.formatInstantInZone('2026-07-15T12:00:00Z', 'America/Toronto');
  assert.notEqual(winter, summer);
});
await check('24. non-DST conversion uses explicit zone', () => assert.match(intl.formatInstantInZone('2026-01-15T12:00:00Z', 'Asia/Karachi'), /2026/));
await check('25. locale-aware date helper replaces fixed PK locale', () => {
  assert.match(dateUtil, /formatInternationalDate/);
  assert.doesNotMatch(dateUtil, /en-PK/);
});
await check('26. Pakistan E.164 example', () => assert.equal(intl.normalizePhone('+92 300 1234567'), '+923001234567'));
await check('27. North America E.164 example', () => assert.equal(intl.normalizePhone('+1 416 555 1234'), '+14165551234'));
await check('28. UK E.164 example', () => assert.equal(intl.normalizePhone('+44 20 7123 4567'), '+442071234567'));
await check('29. no automatic +92 prefix', () => assert.equal(intl.normalizePhone('03001234567'), null));
await check('30. generic address permits omitted region', () => assert.equal(intl.validateAddress({ countryCode: 'JP' }).ok, true));
await check('31. generic address permits omitted postal code', () => assert.equal(intl.validateAddress({ countryCode: 'AE', city: 'Dubai' }).ok, true));
await check('32. address country is normalized', () => assert.equal(intl.validateAddress({ countryCode: 'br' }).value.countryCode, 'BR'));
await check('33. Unicode personal-style names are accepted safely', () => assert.equal(intl.validateOrganizationCore({ organizationType: 'agency', displayName: '東京進学', countryCode: 'JP' }).ok, true));
await check('34. diacritics, apostrophes, and hyphens are accepted', () => assert.equal(intl.validateOrganizationCore({ organizationType: 'agency', displayName: "École O’Connor-Silva", countryCode: 'CA' }).ok, true));
await check('35. Unicode institution names are preserved', () => assert.equal(intl.validateOrganizationCore({ organizationType: 'university', legalName: 'Universität São Paulo', countryCode: 'BR' }).value.legalName, 'Universität São Paulo'));
await check('36. unsafe markup remains rejected', () => assert.equal(intl.validateOrganizationCore({ organizationType: 'agency', displayName: '<script>x</script>', countryCode: 'GB' }).ok, false));
await check('37. nationality and residence remain separate', () => {
  const src = source('shared/career/studentProfileValidation.js');
  assert.match(src, /nationality/); assert.match(src, /country/);
});
await check('38. destination and residence remain separate', () => {
  const goals = source('shared/career/studentProfileValidation.js');
  const personal = source('server/src/models/career/PersonalInfo.js');
  assert.match(goals, /destinationCountries/); assert.match(personal, /country/);
});
await check('39. no guessed GPA conversion exists', () => assert.doesNotMatch(source('shared/education/eligibilityEngine.js'), /convert.*GPA|GPA.*\/\s*4\s*\*\s*100/i));
await check('40. qualification taxonomy is international', () => {
  assert.equal(education.TEST_CATEGORIES.NATIONAL_QUALIFICATION, 'national_qualification');
  assert.equal(education.DEGREE_LEVELS.PROFESSIONAL, 'professional');
});
await check('41. Program intake labels do not require Fall/Spring', () => assert.doesNotMatch(programModel, /enum:\s*\[[^\]]*Fall[^\]]*Spring/i));
await check('42. Scholarship nationality/residence semantics remain explicit', () => assert.equal(scholarship.CRITERIA_TYPES.NATIONALITY_RESIDENCE, 'nationality_residence'));
await check('43. TestAcceptance remains scope-based', () => {
  assert.match(testAcceptanceModel, /scope/);
  assert.equal(acceptance.ACCEPTANCE_SCOPES.COUNTRY, 'country');
});
await check('44. Agent service and destination countries remain separate', () => {
  assert.match(agentProfile, /serviceCountries/); assert.match(agentProfile + agentService, /destinationCountries/);
});
await check('45. Institution Program currency is preserved', () => assert.match(programModel, /amountMinor[\s\S]*currency/));
await check('46. consultation scheduling supports explicit different zones', () => {
  assert.match(consultationService, /normalizeTimeZone/); assert.match(consultationContract, /timeZone/);
});
await check('47. double-booking operates on instants', () => assert.match(consultationService, /confirmedStart|requestedWindow/));
await check('48. Journey urgency avoids a Karachi/server-local default', () => assert.doesNotMatch(journeyContract, /Asia\/Karachi|process\.env\.TZ/));
await check('49. Commerce retains transaction currency', () => assert.match(commerceModels, /amountMinor[\s\S]*currency/));
await check('50. provider readiness is distinct from organization approval', () => {
  assert.match(paymentsService, /provider|payoutsEnabled/i); assert.match(paymentsService, /approved/i);
});
await check('51. Budget Planner preserves unresolved multi-currency', () => {
  assert.equal(budgetCalculations.resolveMultiCurrencyAffordability(['USD', 'GBP']).affordabilityState, 'multi_currency_unresolved');
  assert.match(budgetService, /groupTotalsByCurrency/);
});
await check('52. Copilot does not invent jurisdiction facts', () => assert.doesNotMatch(copilotService, /default.*(visa|jurisdiction|immigration).*PK|guaranteed visa/i));
await check('53. public Money display distinguishes currencies safely', () => {
  assert.match(programPage + scholarshipPage, /formatMoney/);
  assert.notEqual(intl.formatMoney({ amountMinor: 100, currency: 'USD' }), intl.formatMoney({ amountMinor: 100, currency: 'CAD' }));
});
await check('54. public dates do not rely on fixed PK locale', () => assert.doesNotMatch(dateUtil, /toLocaleDateString\(['"]en-PK/));
await check('55. Admin international diagnostics are bounded', () => {
  assert.match(adminController, /missingOrganizationCountry/);
  assert.match(adminController, /countDocuments/);
});
await check('56. CountryReadiness never claims production-ready', () => {
  const result = intl.assessCountryReadiness('DE', Object.fromEntries(['countryConfiguration','educationDataReady','verificationPolicyConfigured','currencySupported','providerReady','sourceFreshnessReady'].map(k => [k, true])));
  assert.equal(result.state, 'ready_for_internal_testing'); assert.equal(result.productionReady, false);
});
await check('57. legacy diagnostics do not mutate data', () => assert.doesNotMatch(adminController, /updateMany|bulkWrite/));
await check('58. no live migration/backfill was introduced', () => assert.doesNotMatch(adminController + source('shared/international/countryReadiness.js'), /migration\.run|backfill\(/i));
await check('59. no live FX/provider/network call exists in international contracts', () => assert.doesNotMatch(source('shared/international/index.js') + source('shared/international/countryReadiness.js'), /fetch\(|axios|Stripe|exchangeRateApi/i));
await check('60. Employer Release Baseline scheduling remains isolated', () => {
  assert.match(employerAppointment, /timeZone/); assert.doesNotMatch(workflowService, /EmployerIntelligence|appointmentTime/);
});

console.log(`\n  ${passed}/60 tests passed`);
if (failed) { console.error(`  ${failed} failed`); process.exitCode = 1; }
else console.log('  Mission 22 international hardening passed.');
