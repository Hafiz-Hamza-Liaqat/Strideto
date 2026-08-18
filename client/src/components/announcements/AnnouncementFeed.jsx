import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { announcementsApi } from '../../services/announcementsService';

const TYPE_STYLES = {
  info: 'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30',
  policy: 'border-purple-200 bg-purple-50 dark:border-purple-900 dark:bg-purple-950/30',
  maintenance: 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30',
  action_required: 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30',
  survey: 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30',
};

export function AnnouncementFeed({
  title = 'Announcements',
  limit = 5,
  className = '',
  api = announcementsApi,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = () => {
    setLoading(true);
    api
      .feed({ limit })
      .then(({ data }) => setItems(data.items || []))
      .catch(() => setError('Announcements are unavailable right now.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [limit, api]);

  const markRead = async (id) => {
    try {
      await api.read(id);
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, read: true } : item)));
    } catch {
      /* non-blocking */
    }
  };

  const acknowledge = async (id) => {
    setBusyId(id);
    try {
      await api.ack(id);
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, read: true, acknowledged: true } : item)));
    } finally {
      setBusyId(null);
    }
  };

  const vote = async (id, voteValue) => {
    setBusyId(id);
    try {
      await api.vote(id, voteValue);
      setItems((prev) => prev.map((item) => (
        item.id === id ? { ...item, read: true, acknowledged: true, surveyVote: voteValue } : item
      )));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <section className={`rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 ${className}`}>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Loading…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className={`rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 ${className}`} role="alert">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{error}</p>
      </section>
    );
  }

  if (!items.length) return null;

  return (
    <section className={`rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 ${className}`}>
      <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">{title}</h2>
      <ul className="space-y-3">
        {items.map((item) => (
          <li
            key={item.id}
            className={`rounded-lg border px-3 py-3 text-sm ${TYPE_STYLES[item.type] || TYPE_STYLES.info}`}
            onMouseEnter={() => { if (!item.read) markRead(item.id); }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-gray-900 dark:text-white break-words-safe">{item.title}</p>
                <p className="text-gray-700 dark:text-gray-300 mt-1 break-words-safe">{item.body}</p>
                {item.link ? (
                  <Link to={item.link} className="inline-block mt-2 text-primary dark:text-mint hover:underline">
                    Learn more
                  </Link>
                ) : null}
              </div>
              {!item.read ? <span className="text-xs font-semibold uppercase text-primary shrink-0">New</span> : null}
            </div>

            {item.type === 'action_required' && !item.acknowledged ? (
              <button
                type="button"
                disabled={busyId === item.id}
                onClick={() => acknowledge(item.id)}
                className="mt-3 min-h-[44px] px-3 py-2 rounded-lg bg-primary text-white text-xs font-medium disabled:opacity-50"
              >
                Acknowledge
              </button>
            ) : null}

            {item.type === 'survey' && item.surveyOptions?.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {item.surveyOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={busyId === item.id || Boolean(item.surveyVote)}
                    onClick={() => vote(item.id, opt.value)}
                    className={`min-h-[44px] px-3 py-2 rounded-lg border text-xs font-medium ${
                      item.surveyVote === opt.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
