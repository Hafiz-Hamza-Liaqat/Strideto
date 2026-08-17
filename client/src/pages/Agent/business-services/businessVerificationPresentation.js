const LIVE_TRUST_STATUS = 'verified';
const LIVE_GRANT_STATUS = 'active';

export function businessCapabilityPresentation(capability = {}) {
  const trustStatus = capability.trustStatus || 'claimed';
  const grantStatus = capability.status || 'inactive';
  const jurisdictionIds = capability.scope?.jurisdictionIds || [];
  const entityTypeIds = capability.scope?.entityTypeIds || [];
  const protectedTitleIds = capability.scope?.protectedTitleIds || [];
  const productionAuthorized = trustStatus === LIVE_TRUST_STATUS
    && grantStatus === LIVE_GRANT_STATUS
    && capability.productionAuthority === true;
  return {
    ...capability,
    trustStatus,
    grantStatus,
    jurisdictionIds,
    entityTypeIds,
    protectedTitleIds,
    productionAuthorized,
    authorityLabel: productionAuthorized ? 'Verified for current-reviewed scope' : 'Not authorized for live service',
  };
}

export function businessVerificationSummary(capabilities = []) {
  const claims = capabilities.map(businessCapabilityPresentation);
  return {
    claims,
    claimed: claims.length,
    productionVerified: claims.filter((claim) => claim.productionAuthorized).length,
    underReview: claims.filter((claim) => ['evidence_submitted', 'evidence_backed'].includes(claim.trustStatus)).length,
    needsChanges: claims.filter((claim) => claim.review?.decision === 'needs_information').length,
    suspendedOrRevoked: claims.filter((claim) => ['suspended', 'revoked'].includes(claim.trustStatus) || ['suspended', 'revoked'].includes(claim.grantStatus)).length,
    jurisdictionIds: new Set(claims.flatMap((claim) => claim.jurisdictionIds)),
  };
}
