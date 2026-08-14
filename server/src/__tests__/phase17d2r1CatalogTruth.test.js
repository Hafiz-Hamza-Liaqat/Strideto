/**
 * Phase 17D-2R1 — catalog truth corrections (IRS EIN, Delaware LLC fee, Delaware RA).
 * Run: node src/__tests__/phase17d2r1CatalogTruth.test.js
 */
import assert from 'node:assert/strict';
import { loadGbsCatalogManifest } from '../../../shared/gbs/catalog/index.js';
import {
  CATALOG_REVIEW_STATUSES,
  FEE_AMOUNT_MODELS,
  FEE_CATEGORIES,
  PROVIDER_FEE_OWNERSHIP,
} from '../../../shared/gbs/catalogConstants.js';
import { validateGovernmentFeeRecord } from '../../../shared/gbs/governmentFeePolicy.js';
import { importGbsCatalog, createMemoryCatalogStore } from '../services/gbs/catalogImportService.js';
import { assertCatalogApplyAllowed } from '../services/gbs/catalogApplyGuard.js';

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const catalog = loadGbsCatalogManifest();

function fees(feeId) {
  return catalog.fees.filter((row) => row.feeId === feeId).sort((a, b) => a.sourceVersion - b.sourceVersion);
}

function currentFee(feeId) {
  const rows = fees(feeId);
  return rows.filter((row) => row.superseded !== true && row.reviewStatus !== CATALOG_REVIEW_STATUSES.SUPERSEDED).at(-1);
}

function rules(ruleId) {
  return catalog.rules.filter((row) => row.ruleId === ruleId).sort((a, b) => a.sourceVersion - b.sourceVersion);
}

{
  const ein = fees('fee:US-IRS-EIN');
  const current = currentFee('fee:US-IRS-EIN');
  const historical = ein.find((row) => row.sourceVersion === 1);
  check(historical && historical.amountModel === FEE_AMOUNT_MODELS.NOT_CATALOGUED, '1. IRS EIN historical not_catalogued revision remains');
  check(historical.superseded === true && historical.reviewStatus === CATALOG_REVIEW_STATUSES.SUPERSEDED, '1b. IRS EIN v1 is superseded, not deleted');
  check(current.sourceVersion === 2, '1c. IRS EIN current revision is sourceVersion 2');
  check(current.authorityId === 'auth:US-IRS', '1d. IRS EIN authority is IRS');
  check(current.feeCategory === FEE_CATEGORIES.EIN_ISSUANCE, '1e. IRS EIN category is issuance, not provider assistance');
  check(current.ownership === PROVIDER_FEE_OWNERSHIP.GOVERNMENT, '1f. IRS EIN fee owner is government');
  check(current.currency === 'USD' && current.amountModel === FEE_AMOUNT_MODELS.FIXED && current.amount === 0, '1. IRS official EIN government fee is current reviewed USD 0');
  check(current.reviewStatus === CATALOG_REVIEW_STATUSES.REVIEWED, '1g. IRS EIN current row is reviewed');
  check(current.sourceId === 'src:US-IRS-EIN-fee', '1h. IRS EIN current source is the official EIN page stating free issuance');
  const src = catalog.sources.find((s) => s.sourceId === 'src:US-IRS-EIN-fee');
  check(src.sourceUrl === 'https://www.irs.gov/businesses/employer-identification-number', '1i. IRS EIN fee source URL is the current official EIN page');
  check(Boolean(src.sourceVersion) && Boolean(src.retrievedAt) && Boolean(src.lastReviewedAt) && Boolean(src.reviewDueAt), '1j. IRS EIN source provenance timestamps exist');
  check(!/provider EIN assistance is free/i.test(current.notes || ''), '2. does not claim provider EIN assistance is free');
  check(
    catalog.fees.every((f) => f.ownership === 'government') &&
      !catalog.fees.some((f) => /ein assistance/i.test(f.label || '') && f.ownership !== 'government'),
    '2. EIN provider assistance remains a separate provider-defined concept (no provider price catalogued)'
  );
}

{
  const de = fees('fee:US-DE-llc-formation');
  const historical = de.find((row) => row.sourceVersion === 1);
  const current = currentFee('fee:US-DE-llc-formation');
  check(historical && historical.amountModel === FEE_AMOUNT_MODELS.NOT_CATALOGUED, '8. Delaware historical not_catalogued revision remains');
  check(historical.superseded === true && historical.sourceId === 'src:US-DE-fee-page', '8b. Delaware HTML landing-page ambiguity is retained as history');
  check(current.sourceVersion === 2 && current.amount === 110 && current.currency === 'USD', '3. Delaware domestic LLC current formation fee is USD 110');
  check(current.amountModel === FEE_AMOUNT_MODELS.FIXED && current.reviewStatus === CATALOG_REVIEW_STATUSES.REVIEWED, '3b. Delaware LLC fee is reviewed fixed');
  check(current.authorityId === 'auth:US-DE-DOS', '3c. Delaware fee authority is Division of Corporations');
  check(current.entityTypeId === 'et:US-DE:LLC', '3d. Delaware fee is domestic LLC scoped');
  check(current.sourceId === 'src:US-DE-fee-schedule-2026-08', '3e. Delaware fee source is the current official schedule');
  const pdf = catalog.sources.find((s) => s.sourceId === 'src:US-DE-fee-schedule-2026-08');
  check(
    pdf.sourceUrl === 'https://corpfiles.delaware.gov/Fee_Schedule/AugustFee2026.pdf',
    '3f. Delaware fee source URL is the current official PDF'
  );
  check(pdf.effectiveFrom === '2026-08-01T00:00:00.000Z', '3g. Delaware schedule effective/revision metadata is present');
  check(catalog.sources.some((s) => s.sourceId === 'src:US-DE-fee-page'), '8c. historical Delaware HTML fee page source is not deleted');
}

{
  const ra = rules('rule:US-DE-registered-agent');
  check(ra.length === 1, '4. Delaware RA requirement exists once (no duplicate)');
  check(ra[0].reviewStatus === CATALOG_REVIEW_STATUSES.REVIEWED, '4b. Delaware RA rule is reviewed');
  check(ra[0].payload.required === true && ra[0].payload.physicalDelawareStreetAddressRequired === true, '4. Delaware RA requirement is official-source backed');
  check(ra[0].sourceId === 'src:US-DE-ra', '4c. Delaware RA rule cites the official RA FAQ source');
  const src = catalog.sources.find((s) => s.sourceId === 'src:US-DE-ra');
  check(src.sourceUrl === 'https://corp.delaware.gov/faqs-regarding-registered-agents/', '4d. Delaware RA source is the official FAQ');
  check(
    !catalog.fees.some(
      (f) => f.jurisdictionId === 'j:US-DE' && /registered agent/i.test(`${f.label} ${f.feeCategory}`) && f.ownership !== 'government'
    ),
    '5. no Delaware provider RA price is invented'
  );
  check(
    !catalog.fees.some((f) => f.jurisdictionId === 'j:US-DE' && f.feeCategory === FEE_CATEGORIES.REGISTERED_AGENT_DESIGNATION),
    '5b. no Delaware government RA service fee was invented'
  );
}

{
  check(currentFee('fee:GB-CH-incorporation-online').amount === 100, '6. UK digital incorporation fee unchanged (£100)');
  check(currentFee('fee:GB-CH-incorporation-paper').amount === 124, '6b. UK paper incorporation fee unchanged (£124)');
  check(currentFee('fee:US-WY-llc-articles').amount === 100, '7. Wyoming LLC formation fee unchanged (USD 100)');
  check(currentFee('fee:US-FL-llc-articles').amount === 100, '7b. Florida LLC formation fee unchanged (USD 100)');
  check(currentFee('fee:US-FL-llc-ra-designation').amount === 25, '7c. Florida RA designation government fee unchanged (USD 25)');
  check(currentFee('fee:US-TX-llc-formation').amount === 300, '7d. Texas LLC formation fee unchanged (USD 300)');
}

{
  const llcRule = rules('rule:US-DE-llc-supported');
  check(llcRule.some((r) => r.sourceVersion === 1 && r.payload.formationFeeNotCatalogued === true), '8d. historical Delaware eligibility fee-unknown payload remains');
  check(llcRule.some((r) => r.sourceVersion === 2 && r.payload.formationFeeNotCatalogued === false), '8e. current Delaware eligibility reflects catalogued fee');
}

{
  const parsed = validateGovernmentFeeRecord(currentFee('fee:US-IRS-EIN'));
  check(parsed.ok === true && parsed.value.amount === 0, 'IRS EIN USD 0 validates as a government fee');
  const deParsed = validateGovernmentFeeRecord(currentFee('fee:US-DE-llc-formation'));
  check(deParsed.ok === true && deParsed.value.amount === 110, 'Delaware USD 110 validates as a government fee');
}

{
  const summary = await importGbsCatalog({ store: createMemoryCatalogStore(), apply: false });
  check(summary.mode === 'dry-run' && summary.persistentImport === false, 'importer remains dry-run');
  check(summary.create > 0, `dry-run creates=${summary.create}`);
  console.log(
    `17D-2R1 catalog dry-run: create=${summary.create} revision=${summary.revision} update=${summary.update} unchanged=${summary.unchanged} stale=${summary.stale} invalid=${summary.invalid}`
  );
  const live = assertCatalogApplyAllowed({ apply: true, dbName: 'edurozgaar', confirm: '1' });
  check(live.ok === false, 'persistent edurozgaar catalog apply remains refused');
}

console.log(`phase17d2r1CatalogTruth.test.js: ${count} assertions passed`);
