import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../constants';
import { studentConsultationApi } from '../../services/agentService';
import { ui } from '../../design-system/surfaceClasses';

export default function Consultations() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    studentConsultationApi.list()
      .then((r) => setItems(r.data.consultations || []))
      .catch((e) => setError(e.response?.data?.error || 'Unable to load consultations.'))
      .finally(() => setLoading(false));
  }, []);
  if (loading) {
    return <div className={`mx-auto max-w-4xl p-8 ${ui.muted}`} role="status">Loading consultations…</div>;
  }
  return (
    <div className={`mx-auto max-w-4xl space-y-5 px-4 py-10 ${ui.page}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className={ui.h1}>My consultations</h1>
          <p className={`mt-1 ${ui.muted}`}>Requests, upcoming appointments, and consultation history.</p>
        </div>
        <Link to={ROUTES.AGENT_PUBLIC_DIRECTORY} className={ui.primaryBtn}>Find an Agent</Link>
      </div>
      {error ? <p className={ui.error} role="alert">{error}</p> : null}
      {items.length === 0 ? (
        <div className={ui.empty}>No consultations yet. Choose an active service from a verified Agent to request one.</div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Link key={item.id} to={`/consultations/${item.id}`} className={`block ${ui.card} p-5 hover:border-blue-400 dark:hover:border-blue-500`}>
              <div className="flex justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium break-words">{item.purpose}</p>
                  <p className={`mt-1 ${ui.muted}`}>{new Date(item.requestedWindow.start).toLocaleString([], { timeZone: item.timezone })} · {item.timezone}</p>
                </div>
                <span className={ui.badge}>{item.status.replaceAll('_', ' ')}</span>
              </div>
              {item.restricted ? <p className={`mt-3 text-xs ${ui.warning}`}>Organization verification is restricted; meeting access is withheld pending review.</p> : null}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
