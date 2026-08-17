import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { businessCapabilityPresentation, businessVerificationSummary } from '../pages/Agent/business-services/businessVerificationPresentation.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const candidate = businessCapabilityPresentation({
  trustStatus: 'evidence_backed', status: 'active', productionAuthority: false,
  scope: { jurisdictionIds: ['j:US-WY'], entityTypeIds: ['et:US-WY:LLC'], protectedTitleIds: ['registered_agent'] },
  jurisdictionReadiness: [{ jurisdictionId: 'j:US-WY', state: 'candidate', productionReady: false }],
});
assert.equal(candidate.productionAuthorized, false);
assert.equal(candidate.authorityLabel, 'Not authorized for live service');
assert.deepEqual(candidate.jurisdictionIds, ['j:US-WY']);
assert.deepEqual(candidate.entityTypeIds, ['et:US-WY:LLC']);
assert.deepEqual(candidate.protectedTitleIds, ['registered_agent']);

const current = businessCapabilityPresentation({
  trustStatus: 'verified', status: 'active', productionAuthority: true,
  scope: { jurisdictionIds: ['j:TEST-CURRENT'], entityTypeIds: ['et:TEST:LLC'], protectedTitleIds: [] },
});
assert.equal(current.productionAuthorized, true);
assert.equal(current.authorityLabel, 'Verified for current-reviewed scope');

for (const trustStatus of ['claimed', 'evidence_submitted', 'evidence_backed', 'suspended', 'revoked']) {
  assert.equal(businessCapabilityPresentation({ trustStatus, status: 'active', productionAuthority: true }).productionAuthorized, false, `${trustStatus} cannot appear live`);
}
assert.equal(businessCapabilityPresentation({ trustStatus: 'verified', status: 'suspended', productionAuthority: true }).productionAuthorized, false);

const summary = businessVerificationSummary([
  current,
  { trustStatus: 'evidence_submitted', status: 'active', productionAuthority: false, scope: { jurisdictionIds: ['j:CANDIDATE'] } },
  { trustStatus: 'evidence_backed', status: 'active', productionAuthority: false, review: { decision: 'needs_information' }, scope: { jurisdictionIds: ['j:CANDIDATE'] } },
  { trustStatus: 'revoked', status: 'revoked', productionAuthority: false, scope: { jurisdictionIds: ['j:OLD'] } },
]);
assert.equal(summary.claimed, 4);
assert.equal(summary.productionVerified, 1);
assert.equal(summary.underReview, 2);
assert.equal(summary.needsChanges, 1);
assert.equal(summary.suspendedOrRevoked, 1);
assert.equal(summary.jurisdictionIds.size, 3);

const verification = read('pages/Agent/business-services/GbsVerification.jsx');
assert.ok(verification.includes('businessVerificationSummary'));
assert.ok(!verification.includes('verificationStatus ||'));
assert.ok(!verification.includes('cap.jurisdictionIds || cap.jurisdictions'));
for (const field of ['trustStatus', 'productionAuthorized', 'jurisdictionIds', 'entityTypeIds', 'protectedTitleIds']) assert.ok(verification.includes(field));

const providerLists = [
  ['GbsRequests.jsx', 'Service Requests'], ['GbsQuotes.jsx', 'Quotes'], ['GbsCases.jsx', 'Cases'],
  ['GbsJurisdictions.jsx', 'Jurisdictions'], ['GbsListings.jsx', 'My Services'],
  ['GbsListingEditor.jsx', 'pageTitle'], ['GbsVerification.jsx', 'Business Verification'],
];
for (const [file, title] of providerLists) {
  const source = read(`pages/Agent/business-services/${file}`);
  assert.ok(source.includes('<h1') || source.includes('GbsRouteState'), `${file} has route h1 semantics`);
  assert.ok(source.includes(title), `${file} names its route`);
}
for (const file of ['GbsRequestDetail.jsx', 'GbsQuoteDetail.jsx', 'GbsCaseDetail.jsx']) {
  const source = read(`pages/Agent/business-services/${file}`);
  assert.ok(source.includes('GbsRouteState'));
  assert.ok(!source.includes('if (!item) return null'));
}

const providerLayout = read('pages/Agent/business-services/GbsWorkspaceLayout.jsx');
const clientLayout = read('pages/BusinessClient/BusinessClientLayout.jsx');
for (const title of ['Service Requests', 'Request Details', 'Quotes', 'Quote Details', 'Cases', 'Case Details', 'Create Service', 'Edit Service']) assert.ok(providerLayout.includes(title));
for (const title of ['Business Overview', 'Service Requests', 'Request Details', 'Request Service', 'Quotes', 'Quote Details', 'Cases', 'Case Details']) assert.ok(clientLayout.includes(title));
assert.ok(clientLayout.includes('<h1 className={ui.h1}>{routeTitle}</h1>'));
assert.ok(!clientLayout.includes('<h1 className={ui.h1}>Business</h1>'));

console.log('prelaunchP2BBusinessVerificationRouteSemanticsClosure: PASS');
