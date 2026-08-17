import assert from 'node:assert/strict';
import { adminSafeEvidenceProjection } from '../../../shared/gbs/providerEvidence.js';
import { evaluateListingPublicationGate, LISTING_PUBLICATION_DENY_REASONS } from '../../../shared/gbs/listingPublicationGate.js';
import { resolveJurisdictionProductionReadiness } from '../../../shared/gbs/providerCatalogProjection.js';
import { createMemoryProviderCapabilityStore, createProviderCapabilityReviewService } from '../services/gbs/providerCapabilityReviewService.js';

const subject = { subjectType: 'agent', subjectId: 'provider-a' };
const capability = {
  id: 'cap-a', ...subject, capabilityId: 'business_formation', status: 'active', trustStatus: 'evidence_backed',
  scope: { countryCodes: ['US'], jurisdictionIds: ['j:TEST'], entityTypeIds: ['entity:test'], protectedTitleIds: [] },
  evidenceRefs: [{ evidenceType: 'regulatory_registration', decision: 'accepted' }], recordVersion: 0,
};
const listing = {
  ...subject, capabilityId: 'business_formation', jurisdictionId: 'j:TEST', countryCode: 'US',
  entityTypeIds: ['entity:test'], scope: capability.scope, moderationStatus: 'approved', adminReviewStatus: 'approved',
};
const ready = { productionReady: true, state: 'current_reviewed', reason: 'current_reviewed' };
const notReady = { productionReady: false, state: 'draft', reason: 'jurisdiction_not_current_reviewed' };

const evidence = adminSafeEvidenceProjection({
  evidenceType: 'regulatory_registration', jurisdictionId: 'j:TEST', referenceNumber: 'REF-1',
  officialRegistryUrl: 'https://registry.example.test/REF-1', issuingAuthorityId: 'auth:test', notes: 'Exact subject evidence',
});
assert.equal(evidence.referenceNumber, 'REF-1');
assert.equal(evidence.officialRegistryUrl, 'https://registry.example.test/REF-1');
assert.equal(evidence.issuingAuthorityId, 'auth:test');
assert.equal(evidence.notes, 'Exact subject evidence');

assert.equal(resolveJurisdictionProductionReadiness('j:does-not-exist').productionReady, false);
assert.equal(evaluateListingPublicationGate({ listing, capability: { ...capability, trustStatus: 'verified' }, requireMarketplaceEnabled: false, jurisdictionReadiness: notReady }).reason,
  LISTING_PUBLICATION_DENY_REASONS.JURISDICTION_NOT_CURRENT_REVIEWED);
assert.equal(evaluateListingPublicationGate({ listing, capability: { ...capability, trustStatus: 'verified' }, requireMarketplaceEnabled: false, jurisdictionReadiness: ready }).allowed, true);

const deniedService = createProviderCapabilityReviewService({
  store: createMemoryProviderCapabilityStore([capability]),
  readinessResolver: () => notReady,
});
await assert.rejects(() => deniedService.verify({ id: 'cap-a', ...subject, expectedVersion: 0, actor: { isStaff: true, id: 'admin-a' } }),
  (err) => err.code === 'jurisdiction_not_current_reviewed');

const readyStore = createMemoryProviderCapabilityStore([capability]);
const readyService = createProviderCapabilityReviewService({ store: readyStore, readinessResolver: () => ready });
const verified = await readyService.verify({ id: 'cap-a', ...subject, expectedVersion: 0, actor: { isStaff: true, id: 'admin-a' } });
assert.equal(verified.trustStatus, 'verified');

console.log('prelaunchAdminEvidenceJurisdictionTrustClosure: PASS');
