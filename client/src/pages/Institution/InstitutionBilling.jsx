import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useInstitutionAuth } from '../../context/InstitutionAuthContext';
import { institutionPortalApi } from '../../services/institutionPortalService';
import { ROUTES } from '../../constants';
import { PageState, Panel } from './InstitutionUi';

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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Billing / Commerce</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Launch pricing is free. No fabricated payment requirement. No live Stripe. No wallet.</p>
      </div>
      {error ? <PageState tone="error" role="alert">{error}</PageState> : null}
      <Panel title="Current launch plan">
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{data?.plan?.planLabel || 'Free'}</p>
        <ul className="mt-3 list-disc pl-5 text-sm text-gray-700 dark:text-gray-300">
          {(data?.plan?.included || []).map((item) => <li key={item}>{item}</li>)}
        </ul>
      </Panel>
      <Panel title="Future products">
        {(data?.plan?.futureProducts || []).map((p) => (
          <p key={p.code} className="text-sm text-gray-800 dark:text-gray-200">{p.label}: <strong>Not configured</strong></p>
        ))}
      </Panel>
      <Panel title="Provider">
        <p className="text-sm">State: {data?.provider?.state || 'not_configured'}</p>
        <p className="text-sm">Live Stripe called: {String(data?.provider?.liveStripeCalled ?? false)}</p>
        <p className="text-sm">Wallet: {data?.wallet || 'not_configured'}</p>
        <Link className="text-sm text-primary underline" to={ROUTES.INSTITUTION_USAGE}>Usage</Link>
      </Panel>
    </div>
  );
}
