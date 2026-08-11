import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { agentApi } from '../../services/agentService';
import { ROUTES } from '../../constants';

const card = 'rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5';

export default function AgentUsageBilling() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    agentApi.getUsageBilling().then(({ data: d }) => setData(d)).catch((err) => setError(err.response?.data?.error || 'Unable to load usage.')).finally(() => {});
  }, []);
  if (!data && !error) return <p className="text-sm text-slate-500 dark:text-gray-400">Loading usage & billing…</p>;
  const orders = (data?.orders || []).filter((o) => !q || String(o.orderNumber || '').toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Usage & Billing</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">Actual configured policy only. No invented pricing, wallet, or escrow.</p>
      </div>
      {error ? <p className="text-sm text-red-700 dark:text-red-400" role="alert">{error}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className={card}><p className="text-sm text-slate-500">Current policy</p><p className="font-semibold text-gray-900 dark:text-white mt-1">{data?.policy?.code || 'not_configured'}</p><p className="text-xs mt-2">{data?.policy?.note}</p></div>
        <div className={card}><p className="text-sm text-slate-500">Commission</p><p className="font-semibold text-gray-900 dark:text-white mt-1">{data?.commission?.configured ? 'Configured' : 'Commission not configured'}</p></div>
        <div className={card}><p className="text-sm text-slate-500">Provider</p><p className="font-semibold text-gray-900 dark:text-white mt-1">{data?.provider?.state || 'not_configured'}</p></div>
        <div className={card}><p className="text-sm text-slate-500">KYC</p><p className="font-semibold text-gray-900 dark:text-white mt-1">{data?.kyc?.state || 'not_started'}</p><p className="text-xs mt-2">Charges {data?.kyc?.chargesCapability || 'inactive'} · Transfers {data?.kyc?.transfersCapability || 'inactive'}</p></div>
        <div className={card}><p className="text-sm text-slate-500">Payout</p><p className="font-semibold text-gray-900 dark:text-white mt-1">{data?.payout?.state || 'not_configured'}</p></div>
        <div className={card}><p className="text-sm text-slate-500">Usage</p><p className="text-sm mt-2 text-gray-900 dark:text-white">Services {data?.usage?.activeServices ?? 0} · Published posts {data?.usage?.marketplacePublished ?? 0}</p><Link to={ROUTES.AGENT_COMMERCE} className="text-sm text-primary mt-2 inline-block">Commerce / payouts →</Link></div>
      </div>
      <label className="block text-sm text-gray-900 dark:text-white">Search transactions
        <input value={q} onChange={(e) => setQ(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 px-3 py-2" placeholder="Order number" />
      </label>
      <section className={card}>
        <h2 className="font-semibold text-gray-900 dark:text-white">Orders</h2>
        {orders.length ? orders.map((o) => (
          <p key={o._id} className="mt-2 text-sm text-gray-800 dark:text-gray-200">{o.orderNumber} · {o.currency} {o.amountMinor} minor units · {o.status}</p>
        )) : <p className="mt-2 text-sm text-slate-500">No orders. Pending balance is not a homemade wallet.</p>}
      </section>
      <section className={card}>
        <h2 className="font-semibold text-gray-900 dark:text-white">Refunds / disputes</h2>
        {(data?.refunds || []).length ? data.refunds.map((r) => (
          <p key={r._id} className="mt-2 text-sm">{r.status} · {r.currency} {r.amountMinor}</p>
        )) : <p className="mt-2 text-sm text-slate-500">No refunds. Professional dispute is not a financial dispute.</p>}
      </section>
    </div>
  );
}
