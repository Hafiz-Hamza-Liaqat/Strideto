import { CaseRequirementPackPanel } from '../../components/gbs/CaseRequirementPackPanel';
import { ProviderRequirementPackPanel } from '../../components/gbs/ProviderRequirementPackPanel';
import { THEME_STORAGE_KEY, useOptionalTheme } from '../../context/ThemeContext';
import { ui } from '../../design-system/surfaceClasses';

const SYNTHETIC_PACK = {
  attached: true,
  displayName: 'Wyoming LLC formation pack v1',
  identity: {
    packId: 'gbs.requirement_pack.US-WY.LLC',
    packVersion: 1,
    sourceSetId: 'srcset:US-WY-LLC-formation-v1',
    documentRequirementCount: 0,
    hsiRequirementCount: 0,
  },
  facts: [
    {
      factKey: 'proposed_entity_name',
      label: 'Proposed company name',
      help: 'Must include a Wyoming LLC ending such as LLC. This is not a reservation and does not guarantee availability.',
      class: 'FACT',
      optional: false,
      whoSupplies: 'customer',
      valueType: 'string',
      value: 'Peak Range LLC',
      canEdit: true,
    },
    {
      factKey: 'close_llc_election',
      label: 'Close limited liability company election',
      help: 'This first pack supports ordinary Wyoming LLCs only. Leave this as no.',
      class: 'FACT',
      optional: false,
      whoSupplies: 'customer',
      valueType: 'boolean',
      value: false,
      canEdit: true,
    },
    {
      factKey: 'organizer_print_name',
      label: 'Organizer name for external filing preparation',
      help: 'STRIDETO does not capture the Wyoming statutory filing signature in this step.',
      class: 'FACT',
      optional: false,
      whoSupplies: 'provider',
      valueType: 'string',
      value: '',
      canEdit: false,
    },
    {
      factKey: 'ra_registered_office_street',
      label: 'Registered office street address',
      help: 'Must be a physical Wyoming street address.',
      class: 'FACT',
      optional: false,
      whoSupplies: 'either',
      valueType: 'string',
      value: '',
      canEdit: true,
    },
    {
      factKey: 'delayed_effective_date',
      label: 'Delayed effective date (optional)',
      help: 'Optional. Not later than the 90th day after filing. STRIDETO does not file.',
      class: 'OPTIONAL_FACT',
      optional: true,
      whoSupplies: 'either',
      valueType: 'date',
      value: null,
      canEdit: true,
    },
  ],
  checks: [
    {
      checkKey: 'name_distinguishability_search_performed',
      label: 'Official name search performed',
      help: 'Confirms a WyoBiz search was performed. It does not guarantee the name is available or reserved.',
      mode: 'manual',
      status: 'missing',
      canAttest: true,
    },
    {
      checkKey: 'filing_method_selected',
      label: 'External filing method selected',
      help: 'WyoBiz online or paper mail. STRIDETO does not file.',
      mode: 'manual',
      status: 'missing',
      canAttest: true,
    },
  ],
  raConsent: {
    consentKey: 'ra_written_consent',
    label: 'Registered agent written consent',
    status: 'missing',
    canAttest: true,
    waivable: false,
    helper: "Confirm that the registered agent's written consent has been obtained and will be retained or included as required for the external Wyoming filing.",
  },
  readiness: {
    b2bRequirementsReady: false,
    authorizedForExternalFiling: false,
    reasons: ['fact_missing:ra_registered_office_street', 'ra_written_consent_missing'],
    copy: 'Required for STRIDETO pre-submission preparation.',
  },
};

export default function GbsRequirementPackVisualFixture({ role = 'customer' }) {
  const theme = useOptionalTheme();
  const stored = (() => {
    try {
      return localStorage.getItem(THEME_STORAGE_KEY) || 'system';
    } catch {
      return 'system';
    }
  })();
  const preference = theme?.preference || stored;
  const resolved = theme?.resolvedTheme || (document.documentElement.classList.contains('dark') ? 'dark' : 'light');

  return (
    <main className={`${ui.page} space-y-6 min-w-0`} data-theme-preference={preference} data-resolved-theme={resolved}>
      <h1 className={ui.h1}>Formation requirements fixture</h1>
      <p className={ui.muted}>Synthetic active snapshot only. Production pack remains draft.</p>
      <p data-testid="theme-preference">Stored appearance preference: {preference}</p>
      <p data-testid="resolved-theme">Resolved theme: {resolved}</p>
      <nav>
        <a className={ui.link} href="/business/cases">Cases</a>
        {' · '}
        <a className={ui.link} href="/agent/business-services/cases">Provider Cases</a>
        {' · '}
        <a className={ui.link} href="/agent/business-services/quotes">Quotes</a>
      </nav>
      {role === 'provider' ? (
        <ProviderRequirementPackPanel
          pack={SYNTHETIC_PACK}
          recordVersion={1}
          busy={false}
          error=""
          onSaveFact={() => {}}
          onAttestCheck={() => {}}
          onAttestRaConsent={() => {}}
        />
      ) : (
        <CaseRequirementPackPanel
          pack={SYNTHETIC_PACK}
          recordVersion={1}
          busy={false}
          error=""
          onSaveFact={() => {}}
        />
      )}
    </main>
  );
}
