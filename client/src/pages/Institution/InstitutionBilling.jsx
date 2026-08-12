import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useInstitutionAuth } from '../../context/InstitutionAuthContext';
import { institutionPortalApi } from '../../services/institutionPortalService';
import { ROUTES } from '../../constants';
import { PageState, Panel, StatusBadge } from './InstitutionUi';

export default function InstitutionBilling() {
  const { organizationId } = useInstitutionAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    institutionPortalApi.usageBilling(organizationId)
      .then(({ data: d }) => setData(d))
      .catch((err) => setError(err.response?.data?.error || 'Unable to load billing.'));
  }, [organizationId]);

  if (!data && !error) return <PageState>Loading billing…</PageState>;

  const planLabel = data?.plan?.planLabel || 'Free';
  const providerState = data?.provider?.state || 'not_configured';
  const walletState = data?.wallet || 'not_configured';

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Billing / Commerce</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Launch pricing is free. No fabricated payment requirement. No live Stripe. No wallet.</p>
      </div>
      {error ? <PageState tone="error" role="alert">{error}</PageState> : null}

      <Panel title="Current launch plan">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{planLabel}</p>
          <StatusBadge value={planLabel.toLowerCase() === 'free' ? 'approved' : 'draft'} label="Plan" />
        </div>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Provider state: <strong>{providerState}</strong> · Wallet: <strong>{walletState}</strong></p>
        <ul className="mt-3 list-disc pl-5 text-sm text-gray-700 dark:text-gray-300">
          {(data?.plan?.included || [
            'Institution profile',
            'Verification submission',
            'Canonical Program management',
            'Official data maintenance',
          ]).map((item) => <li key={item}>{item}</li>)}
        </ul>
      </Panel>

      <Panel title="Future products">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Paid capabilities are not configured at launch. Nothing below can be purchased yet.</p>
        {(data?.plan?.futureProducts || []).map((p) => (
          <div key={p.code} className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2">
            <span className="text-sm text-gray-800 dark:text-gray-200">{p.label}</span>
            <StatusBadge value={p.state || 'not_configured'} />
          </div>
        ))}
      </Panel>

      <Panel title="Payment provider">
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="text-gray-500">Provider state</dt><dd className="font-semibold text-gray-900 dark:text-white">{providerState}</dd></div>
          <div><dt className="text-gray-500">Live Stripe called</dt><dd className="font-semibold text-gray-900 dark:text-white">{String(data?.provider?.liveStripeCalled ?? false)}</dd></div>
          <div><dt className="text-gray-500">Wallet</dt><dd className="font-semibold text-gray-900 dark:text-white">{walletState}</dd></div>
        </dl>
        <Link className="mt-3 inline-block text-sm text-primary underline" to={ROUTES.INSTITUTION_USAGE}>View usage analytics</Link>
      </Panel>
    </div>
  );
}
