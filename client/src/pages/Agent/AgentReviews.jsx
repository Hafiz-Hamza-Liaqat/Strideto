import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { agentApi } from '../../services/agentService';
import { ROUTES } from '../../constants';
import { btnPrimary, cardClass, inputClass, muted } from './agentUi';

/**
 * Education & Mobility verified-interaction reviews.
 * Trust Center remains the shared summary and links here.
 */
export default function AgentReviews() {
  const [reviews, setReviews] = useState([]);
  const [reply, setReply] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => agentApi.getReviews().then((r) => setReviews(r.data.reviews || []));

  useEffect(() => {
    load()
      .catch((e) => setError(e.response?.data?.error || 'Unable to load reviews.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className={muted}>Loading reviews…</p>;

  return (
    <div className="space-y-6 min-w-0">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Reviews</h1>
        <p className={`mt-1 ${muted}`}>
          Education &amp; Mobility verified-interaction reviews only. Reviews require a completed verified interaction;
          they are not general public ratings and do not grant professional verification.
        </p>
        <Link to={ROUTES.AGENT_TRUST} className="mt-2 inline-block text-sm text-primary">← Trust Center summary</Link>
      </header>
      {error ? <p className="rounded bg-red-50 dark:bg-red-950/40 p-3 text-red-700 dark:text-red-300" role="alert">{error}</p> : null}
      {reviews.length === 0 ? (
        <p className={`${cardClass} ${muted}`}>
          No verified-interaction reviews yet. Eligible reviews appear after completed Education consultations or cases
          that support the review provenance model.
        </p>
      ) : reviews.map((x) => (
        <article key={x._id} className={cardClass}>
          <p className="text-gray-900 dark:text-white break-words">{x.rating}/5 · {x.body}</p>
          {x.response ? (
            <p className={`mt-2 ${muted} break-words`}>Agent response: {x.response.body}</p>
          ) : (
            <form
              className="mt-3 flex flex-wrap gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                setError('');
                try {
                  await agentApi.respondToReview(x._id, reply[x._id]);
                  await load();
                } catch (err) {
                  setError(err.response?.data?.error || 'Unable to respond.');
                }
              }}
            >
              <input
                aria-label="Professional response"
                maxLength={1500}
                className={`${inputClass} flex-1 min-w-0`}
                onChange={(e) => setReply({ ...reply, [x._id]: e.target.value })}
              />
              <button type="submit" className={btnPrimary}>Respond</button>
            </form>
          )}
        </article>
      ))}
    </div>
  );
}
