import { useEffect, useState } from 'react';
import { agentApi } from '../../services/agentService';

export default function AgentCommerce() {
  const [data, setData] = useState({ orders: [], transactions: [] });
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const load = () => Promise.all([agentApi.getCommerceHistory(), agentApi.getCommerceReadiness()])
    .then(([h, s]) => { setData(h.data); setStatus(s.data); })
    .catch((e) => setError(e.response?.data?.error || 'Payment status unavailable.'));
  useEffect(() => { load(); }, []);
  const onboard = async () => {
    setError('');
    try {
      const key = crypto.randomUUID();
      const r = await agentApi.startPaymentOnboarding('', key);
      window.location.assign(r.data.onboardingUrl);
    } catch (e) {
      setError(e.response?.data?.error || 'Provider onboarding is unavailable (not_configured or KYC incomplete).');
    }
  };
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Commerce / Payouts</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-gray-400">Strideto verification and Stripe KYC are separate. No live provider call on this page. Secrets are never shown.</p>
      </header>
      {error && <p className="rounded bg-amber-50 dark:bg-amber-950/40 p-3 text-amber-800">{error}</p>}
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <h2 className="font-semibold text-gray-900 dark:text-white">Connect / KYC readiness</h2>
        <p className="mt-2 text-sm">Provider: {status?.providerState || 'not_configured'} · KYC: {status?.providerKycStatus || 'not started'}</p>
        <p className="mt-1 text-sm">Charges: {status?.chargesCapability || 'inactive'} · Transfers: {status?.transfersCapability || 'inactive'} · Payout: {status?.payoutState || 'pending_kyc'}</p>
        <p className="mt-1 text-sm">Payment ready: {status?.ready ? 'Yes' : 'No'}</p>
        {status?.requirementsSummary?.length > 0 && <p className="mt-2 text-sm text-amber-700">Action required: {status.requirementsSummary.join(', ')}</p>}
        <button type="button" onClick={onboard} className="mt-3 rounded bg-primary px-3 py-2 text-sm text-white min-h-[44px]">Start or resume hosted onboarding</button>
        <button type="button" onClick={load} className="ml-2 mt-3 rounded border px-3 py-2 text-sm min-h-[44px]">Refresh stored status</button>
      </section>
      <section>
        <h2 className="font-semibold text-gray-900 dark:text-white">Orders</h2>
        {data.orders?.length ? data.orders.map((x) => <p key={x._id} className="mt-2 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">{x.orderNumber} · {x.currency} {x.amountMinor} minor units · {x.status}</p>) : <p className="mt-2 text-sm text-slate-500">No orders. Agents cannot mark paid, refunded, or payout paid.</p>}
      </section>
    </div>
  );
}
