import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../../constants';
import { gbsProviderApi } from '../../../services/gbsProviderApi';
import { useGbsProvider } from './GbsProviderContext';
import { card, emptyBox, errorBox, muted } from './gbsUi';

const routes = {
  request: ROUTES.AGENT_BUSINESS_SERVICES_REQUESTS,
  quote: ROUTES.AGENT_BUSINESS_SERVICES_QUOTES,
  case: ROUTES.AGENT_BUSINESS_SERVICES_CASES,
};

export default function GbsMessages() {
  const { selected } = useGbsProvider();
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selected) { setLoading(false); return undefined; }
    let cancelled = false;
    setLoading(true);
    gbsProviderApi.listMessageThreads(selected, { page: 1, limit: 50 })
      .then(({ data }) => { if (!cancelled) setItems(data.items || []); })
      .catch(() => { if (!cancelled) setError('Unable to load Business Services conversations.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selected]);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Business Services messages</h1>
        <p className={`mt-1 text-sm ${muted}`}>
          Conversations stay bound to their Business Request, Quote, or Case. Education threads are never shown here.
        </p>
      </header>
      {!selected ? <p className={emptyBox}>Select an authorized provider subject first.</p> : null}
      {loading ? <p className={card} aria-busy="true">Loading conversations…</p> : null}
      {error ? <p className={errorBox} role="alert">{error}</p> : null}
      {!loading && selected && !error && items.length === 0 ? <p className={emptyBox}>No Business Services conversations yet.</p> : null}
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id} className={card}>
            <p className="text-xs font-medium uppercase">Business {item.contextType}</p>
            <p className="font-medium break-words-safe">{item.title}</p>
            <p className={muted}>Reference {item.contextPublicRef}</p>
            <Link className="text-primary underline" to={`${routes[item.contextType]}/${item.contextPublicRef}`}>
              Open {item.contextType} conversation
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
