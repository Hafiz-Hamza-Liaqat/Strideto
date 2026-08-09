import { useEffect, useState } from 'react';
import { getAdminAiStatus } from '../../services/adminSuperControlApi';

export default function AdminAiOps() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    getAdminAiStatus()
      .then(setData)
      .catch(e => setError(e?.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-gray-500 p-4">Loading AI status…</p>;
  if (error) return <p className="text-red-600 text-sm p-4" role="alert">Error: {error}</p>;

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">AI Operational Status</h1>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Safe in-process config status only. No external provider calls made here.
        Student Copilot conversations are private and not shown.
      </p>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 mb-4">
        <p className="text-xs text-gray-500 mb-1">Generated</p>
        <p className="text-sm text-gray-700 dark:text-gray-200">{data?.generatedAt ? new Date(data.generatedAt).toLocaleString() : '—'}</p>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 mb-4">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Copilot Provider</h2>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-gray-500">State</dt>
          <dd className="text-gray-900 dark:text-white font-medium">{data?.copilot?.providerStatus?.state ?? '—'}</dd>
          {Object.entries(data?.copilot?.providerStatus ?? {}).filter(([k]) => k !== 'state').map(([k, v]) => (
            <>
              <dt key={`dt-${k}`} className="text-gray-500 capitalize">{k.replace(/_/g, ' ')}</dt>
              <dd key={`dd-${k}`} className="text-gray-900 dark:text-white">{String(v)}</dd>
            </>
          ))}
        </dl>
        {data?.copilot?.note && (
          <p className="text-xs text-gray-400 mt-2">{data.copilot.note}</p>
        )}
      </div>

      {data?.excluded?.length > 0 && (
        <div className="rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3">
          <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Excluded from this view (privacy boundaries):</p>
          <ul className="list-disc list-inside text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
            {data.excluded.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
