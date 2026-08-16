import { CaseFilingAuthorizationPanel } from '../../components/gbs/CaseFilingAuthorizationPanel';
import { ProviderFilingAuthorizationPanel } from '../../components/gbs/ProviderFilingAuthorizationPanel';
import { THEME_STORAGE_KEY, useOptionalTheme } from '../../context/ThemeContext';
import { ui } from '../../design-system/surfaceClasses';

const LONG_NAME = 'North Range Registered Agent and Formation Counsel LLP of Cheyenne Wyoming Professional Services';
const LONG_TEXT = [
  'TEST ONLY. This is not production legal authorization wording and is not a power of attorney.',
  `${'This paragraph is intentionally long so wrapping can be verified at 320 pixels. '.repeat(8)}`,
  'This is not a Wyoming statutory signature, registered-agent signature, government filing, or government acceptance.',
];

function baseAuth(overrides = {}) {
  return {
    available: false,
    reason: 'requirement_pack_not_active',
    message: 'Filing authorization is not yet available for this Case.',
    canGrant: false,
    canRevoke: false,
    authorizedForExternalFiling: false,
    externalSubmissionEligible: false,
    externalSubmissionState: 'none',
    current: null,
    eligibleLegalText: null,
    history: [],
    providerDisplayName: 'Cheyenne Formation Co',
    purpose: 'gbs.case_filing_authorization.initial_formation',
    purposeLabel: 'Authorize the named Provider to use this Case information for the described initial external formation filing.',
    jurisdictionId: 'j:US-WY',
    entityTypeId: 'et:US-WY:LLC',
    capabilityId: 'business_formation',
    packVersion: 1,
    ...overrides,
  };
}

const STATES = {
  unavailable: baseAuth(),
  available: baseAuth({
    available: true,
    reason: null,
    message: '',
    canGrant: true,
    eligibleLegalText: {
      legalTextId: 'gbs.legal_text.test_only.case_filing_authorization.initial_formation',
      legalTextVersion: 1,
      legalTextHash: 'a'.repeat(64),
      paragraphs: [
        'TEST ONLY. This is not production legal authorization wording and is not a power of attorney.',
        'This synthetic text authorizes the named Provider subject to use this Case information for the described initial external formation filing.',
        'This is not a Wyoming statutory signature or government filing.',
      ],
      testOnly: true,
    },
  }),
  authorized: baseAuth({
    canRevoke: true,
    filingAuthorizationActive: true,
    authorizedForExternalFiling: true,
    current: {
      publicAuthorizationRef: 'authref-test',
      status: 'active',
      recordVersion: 0,
      legalTextVersion: 1,
    },
  }),
  revoked: baseAuth({
    current: { publicAuthorizationRef: 'authref-test', status: 'revoked', recordVersion: 1 },
  }),
  invalidated: baseAuth({
    current: { publicAuthorizationRef: 'authref-test', status: 'invalidated', invalidationReasonCode: 'provider_changed', recordVersion: 1 },
  }),
  error: baseAuth({ available: true, canGrant: true, eligibleLegalText: {
    legalTextId: 'gbs.legal_text.test_only.case_filing_authorization.initial_formation',
    legalTextVersion: 1,
    legalTextHash: 'a'.repeat(64),
    paragraphs: ['TEST ONLY.'],
    testOnly: true,
  } }),
  longProvider: baseAuth({
    available: true,
    canGrant: true,
    providerDisplayName: LONG_NAME,
    eligibleLegalText: {
      legalTextId: 'gbs.legal_text.test_only.case_filing_authorization.initial_formation',
      legalTextVersion: 1,
      legalTextHash: 'a'.repeat(64),
      paragraphs: LONG_TEXT,
      testOnly: true,
    },
  }),
  xss: baseAuth({
    available: true,
    canGrant: true,
    providerDisplayName: '<img src=x onerror=alert(1)> <script>alert(1)</script>',
    eligibleLegalText: {
      legalTextId: 'gbs.legal_text.test_only.case_filing_authorization.initial_formation',
      legalTextVersion: 1,
      legalTextHash: 'a'.repeat(64),
      paragraphs: ['TEST ONLY. <script>alert(1)</script> is not production wording.'],
      testOnly: true,
    },
  }),
  providerNotAuthorized: baseAuth({ statusLabel: 'Not authorized', canAttest: false }),
  providerAuthorized: baseAuth({
    statusLabel: 'Authorized',
    canAttest: true,
    requirementsReady: true,
    authorizedForExternalFiling: true,
    externalSubmissionEligible: true,
    filingAuthorizationActive: true,
    current: { publicAuthorizationRef: 'authref-test', status: 'active', recordVersion: 0 },
  }),
  providerSubmitted: baseAuth({
    statusLabel: 'Submitted externally — Provider attested',
    canAttest: false,
    externalSubmissionState: 'submitted_externally',
    current: { publicAuthorizationRef: 'authref-test', status: 'used', recordVersion: 2 },
  }),
  providerRevoked: baseAuth({
    statusLabel: 'Revoked',
    canAttest: false,
    current: { publicAuthorizationRef: 'authref-test', status: 'revoked', recordVersion: 1 },
  }),
  providerAuthorityLost: baseAuth({
    statusLabel: 'Authorized (not currently usable)',
    canAttest: false,
    current: { publicAuthorizationRef: 'authref-test', status: 'active', recordVersion: 0 },
  }),
};

export default function GbsFilingAuthorizationVisualFixture({ role = 'customer' }) {
  const theme = useOptionalTheme();
  const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const stateKey = params.get('state') || (role === 'provider' ? 'providerAuthorized' : 'available');
  const auth = STATES[stateKey] || STATES.available;
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(THEME_STORAGE_KEY) : null;

  return (
    <main className={`${ui.page} p-4 max-w-3xl mx-auto min-w-0`} data-testid="gbs-filing-auth-fixture">
      <p className={ui.muted}>DEV fixture · stored theme {stored || 'unset'} · resolved {theme?.resolvedTheme || 'unknown'}</p>
      <h1 className="text-xl font-semibold mb-4">Filing authorization fixture ({role})</h1>
      {role === 'provider' ? (
        <ProviderFilingAuthorizationPanel
          auth={auth}
          caseRecordVersion={1}
          busy={false}
          error={stateKey === 'error' ? 'External filing could not be recorded.' : ''}
          onAttest={() => {}}
        />
      ) : (
        <CaseFilingAuthorizationPanel
          auth={auth}
          caseRecordVersion={1}
          busy={false}
          error={stateKey === 'error' ? 'Filing authorization could not be updated.' : ''}
          onGrant={() => {}}
          onRevoke={() => {}}
        />
      )}
    </main>
  );
}
