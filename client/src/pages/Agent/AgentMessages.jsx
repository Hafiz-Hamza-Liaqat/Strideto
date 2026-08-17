import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { agentApi } from '../../services/agentService';

export default function AgentMessages({
  heading = 'Education messages',
  description = 'Education consultation and ProfessionalCase threads only. Business Request/Quote/GbsCase threads are not shown here.',
}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    agentApi.getMessages().then(({ data: d }) => setData(d)).catch((err) => setError(err.response?.data?.error || 'Unable to load messages.'));
  }, []);
  if (!data && !error) return <p className="text-sm text-slate-500 dark:text-gray-400">Loading messages…</p>;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{heading}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">{description}</p>
      </div>
      {error ? <p className="text-sm text-red-700 dark:text-red-400" role="alert">{error}</p> : null}
      <p className="text-sm text-slate-600 dark:text-gray-300">Unread: {data?.unreadTotal ?? 0}</p>
      {!data?.threads?.length ? (
        <p className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 text-sm text-slate-500">No contextual threads yet.</p>
      ) : (
        <ul className="space-y-2">
          {data.threads.map((thread) => (
            <li key={`${thread.context}-${thread.threadId}`}>
              <Link to={thread.href} className="block rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 hover:border-primary">
                <p className="font-medium text-gray-900 dark:text-white capitalize">{thread.context}</p>
                <p className="text-sm text-slate-500 dark:text-gray-400">{thread.status} · unread {thread.unread}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
