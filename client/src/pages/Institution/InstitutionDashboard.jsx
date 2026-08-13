import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useInstitutionAuth } from '../../context/InstitutionAuthContext';
import { ROUTES } from '../../constants';
import { institutionPortalApi } from '../../services/institutionPortalService';
import { PageState, Panel, StatusBadge, humanize, primaryButton, secondaryButton } from './InstitutionUi';
import { canSubmitOrPublish } from './InstitutionPublishingGate';
import { PortalWelcomeBanner } from '../../components/welcome/PortalWelcomeBanner';
import { MilestoneDelight } from '../../components/welcome/MilestoneDelight';
import { AnnouncementFeed } from '../../components/announcements/AnnouncementFeed';

function buildNextActions(data) {
  if (!data) return [];
  const actions = [];
  const publishingActive = canSubmitOrPublish(data);

  if ((data.profileCompleteness ?? 0) < 85) {
    actions.push({
      title: 'Complete organization profile',
      detail: `${data.profileCompleteness}% complete — completeness is not verification.`,
      to: ROUTES.INSTITUTION_PROFILE,
      tone: 'neutral',
    });
  }

  if (data.verificationStatus !== 'approved') {
    actions.push({
      title: data.verificationStatus === 'draft' ? 'Start verification dossier' : 'Continue verification review',
      detail: `Organization verification is ${humanize(data.verificationStatus || 'draft')}.`,
      to: ROUTES.INSTITUTION_VERIFICATION,
      tone: 'warning',
    });
  }

  if (!data.claimState || data.claimState === 'not_started' || data.claimState === 'draft') {
    actions.push({
      title: 'Start canonical claim',
      detail: 'Link your verified organization to the canonical Institution record you represent.',
      to: ROUTES.INSTITUTION_CLAIM,
      tone: 'warning',
    });
  } else if (data.claimState !== 'approved') {
    actions.push({
      title: 'Track canonical claim review',
      detail: `Claim state: ${humanize(data.claimState)}.`,
      to: ROUTES.INSTITUTION_CLAIM,
      tone: 'warning',
    });
  }

  if (publishingActive && (data.draftPrograms ?? 0) > 0) {
    actions.push({
      title: 'Review Program drafts',
      detail: `${data.draftPrograms} draft Program(s) ready for submit/review.`,
      to: ROUTES.INSTITUTION_PROGRAMS,
      tone: 'success',
    });
  }

  if ((data.internalApplications ?? 0) > 0) {
    actions.push({
      title: 'Review internal applications',
      detail: `${data.internalApplications} Strideto-internal admission record(s) need attention.`,
      to: ROUTES.INSTITUTION_APPLICATIONS,
      tone: 'neutral',
    });
  }

  if ((data.openConflicts ?? 0) > 0) {
    actions.push({
      title: 'Resolve data conflicts',
      detail: `${data.openConflicts} open conflict(s) awaiting review.`,
      to: ROUTES.INSTITUTION_DATA_QUALITY,
      tone: 'warning',
    });
  }

  if ((data.staleFacts ?? 0) + (data.reviewDueFacts ?? 0) > 0) {
    actions.push({
      title: 'Reconfirm stale official facts',
      detail: `${(data.staleFacts ?? 0) + (data.reviewDueFacts ?? 0)} Program freshness item(s) need explicit reconfirmation.`,
      to: ROUTES.INSTITUTION_DATA_QUALITY,
      tone: 'warning',
    });
  }

  if (publishingActive && (data.institutionOwnedScholarships ?? 0) === 0) {
    actions.push({
      title: 'Add institution-owned scholarship',
      detail: 'Optional — publish only source-backed awards you directly administer.',
      to: ROUTES.INSTITUTION_SCHOLARSHIPS,
      tone: 'neutral',
    });
  }

  return actions.slice(0, 6);
}

export default function InstitutionDashboard() {
  const { organizationId } = useInstitutionAuth();
  const [state, setState] = useState({ loading: true, data: null, profile: null, error: '' });

  useEffect(() => {
    let active = true;
    Promise.all([institutionPortalApi.dashboard(organizationId), institutionPortalApi.profile(organizationId)])
      .then(([dashboard, profile]) => active && setState({ loading: false, data: dashboard.data, profile: profile.data.profile, error: '' }))
      .catch((error) => active && setState({ loading: false, data: null, profile: null, error: error.response?.data?.error || 'Dashboard data is unavailable.' }));
    return () => { active = false; };
  }, [organizationId]);

  const nextActions = useMemo(() => buildNextActions(state.data), [state.data]);

  if (state.loading) return <PageState>Loading Institution dashboard…</PageState>;
  if (state.error) return <PageState tone="error" role="alert">{state.error} Refresh the page to retry.</PageState>;

  const { data, profile } = state;
  const cards = [
    ['Profile completeness', `${data.profileCompleteness}%`, 'Completeness is not verification.', ROUTES.INSTITUTION_PROFILE],
    ['Published Programs', data.publishedPrograms ?? 0, 'Canonical published records.', ROUTES.INSTITUTION_PROGRAMS],
    ['Draft Programs', data.draftPrograms ?? 0, 'Institution-owned drafts.', ROUTES.INSTITUTION_PROGRAMS],
    ['Internal applications', data.internalApplications ?? 0, 'Strideto-internal submissions only.', ROUTES.INSTITUTION_APPLICATIONS],
    ['Open conflicts', data.openConflicts ?? 0, 'Records awaiting data review.', ROUTES.INSTITUTION_DATA_QUALITY],
    ['Test Acceptance', data.testAcceptanceRecords ?? 0, 'Institution/program scope only.', ROUTES.INSTITUTION_TEST_ACCEPTANCE],
    ['Own scholarships', data.institutionOwnedScholarships ?? 0, 'Institution-owned awards only.', ROUTES.INSTITUTION_SCHOLARSHIPS],
    ['Launch plan', data.launchPlan || 'Free', 'Basic capabilities are free at launch.', ROUTES.INSTITUTION_BILLING],
  ];

  return (
    <div className="space-y-6">
      <PortalWelcomeBanner
        realm="institution"
        userId={organizationId}
        displayName={profile?.officialDisplayName || profile?.legalName}
      />
      <MilestoneDelight
        userId={organizationId}
        eventKey={`verification-approved:${data.verificationStatus}`}
        ready={data.verificationStatus === 'approved'}
        title="Verification approved"
        body="Institution verification is approved. This congratulations appears once."
      />
      <MilestoneDelight
        userId={organizationId}
        eventKey={`canonical-claim-approved:${data.claimState}`}
        ready={data.claimState === 'approved'}
        title="Canonical claim approved"
        body="Your canonical claim is approved. This congratulations appears once."
      />
      <AnnouncementFeed title="Institution announcements" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-primary">Institution dashboard</p>
        <h1 className="mt-1 break-words text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">{profile?.officialDisplayName || profile?.legalName || 'Your Institution'}</h1>
        <p className="mt-2 max-w-3xl text-sm text-gray-600 dark:text-gray-400">Manage source-backed Institution information. Completeness is not verification. Canonical claim is separate from organization verification.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <StatusBadge label="Organization verification" value={data.verificationStatus} />
        <StatusBadge label="Canonical claim" value={data.claimState || 'not_started'} />
        <StatusBadge label="Portal role" value={data.membership?.role} />
      </div>
      {data.verificationStatus !== 'approved' || data.claimState !== 'approved' ? (
        <PageState tone="warning"><strong>Publishing authority is not active.</strong> Verification is {humanize(data.verificationStatus)} and the canonical claim is {humanize(data.claimState || 'not started')}. Privileged canonical publication remains server-blocked.</PageState>
      ) : <PageState tone="success">Approved verification and canonical claim authority are active. Program changes still follow review and provenance controls.</PageState>}

      {nextActions.length ? (
        <Panel title="Suggested next actions">
          <div className="grid gap-3 lg:grid-cols-2">
            {nextActions.map((action) => (
              <article key={action.title} className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white">{action.title}</h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{action.detail}</p>
                <Link className={`${secondaryButton} mt-3 inline-flex`} to={action.to}>Open</Link>
              </article>
            ))}
          </div>
        </Panel>
      ) : (
        <Panel title="Suggested next actions">
          <PageState tone="success">Core onboarding steps look complete. Continue maintaining Programs, admissions, and official facts.</PageState>
        </Panel>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value, note, to]) => (
          <Panel key={label}>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{label}</p>
            <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{note}</p>
            {to ? <Link className="mt-2 inline-block text-sm text-primary underline" to={to}>Open</Link> : null}
          </Panel>
        ))}
      </div>
      <Panel title="Capability boundaries">
        <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
          <li>External application traffic: {data.externalApplicationTraffic || 'not_tracked'}.</li>
          <li>Student private data and Vault access: never available in this portal.</li>
          <li>Commerce provider: not_configured. No wallet.</li>
        </ul>
        <Link className={`${primaryButton} mt-4 inline-flex`} to={ROUTES.INSTITUTION_GUIDELINES}>Read guidelines</Link>
      </Panel>
    </div>
  );
}
