import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { employerApi } from '../../services/employerService';

export default function EmployerBilling() {
  const { t } = useTranslation(['employer', 'common']);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    employerApi
      .billing()
      .then(({ data: d }) => setData(d))
      .catch((err) => setError(err.response?.data?.error || t('employer:billingLoadFailed')))
      .finally(() => setLoading(false));
  }, [t]);

  if (loading) return <p>{t('common:loading')}</p>;

  return (
    <>
      <SeoHead title={t('employer:billingSeoTitle')} description={t('employer:billingSeoDesc')} noindex />
      <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white mb-2">
        {t('employer:navBilling')}
      </h1>
      <p className="text-sm text-slate-600 dark:text-gray-400 mb-6 max-w-2xl">{t('employer:billingIntro')}</p>
      {error ? <p className="mb-4 text-sm text-red-700" role="alert">{error}</p> : null}
      <p className="mb-4 text-sm">
        {t('employer:paymentProvider')}: <strong>{data?.provider?.state || 'not_configured'}</strong>
      </p>
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 dark:bg-gray-900">
            <tr>
              <th className="p-3">{t('employer:orderId')}</th>
              <th className="p-3">{t('employer:jobStatus')}</th>
              <th className="p-3">{t('employer:amount')}</th>
              <th className="p-3">{t('employer:created')}</th>
            </tr>
          </thead>
          <tbody>
            {(data?.orders || []).length === 0 ? (
              <tr><td className="p-4" colSpan={4}>{t('employer:noBillingHistory')}</td></tr>
            ) : (data.orders || []).map((o) => (
              <tr key={o._id} className="border-t border-gray-200 dark:border-gray-700">
                <td className="p-3 break-all">{o._id}</td>
                <td className="p-3">{o.status}</td>
                <td className="p-3">{o.currency} {o.amountMinor}</td>
                <td className="p-3">{o.createdAt ? new Date(o.createdAt).toLocaleString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(data?.refunds || []).length > 0 ? (
        <div className="mt-6">
          <h2 className="font-semibold mb-2">{t('employer:refunds')}</h2>
          <ul className="text-sm space-y-1">
            {data.refunds.map((r) => (
              <li key={r._id}>{r.status} · {r.currency} {r.amountMinor}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}
