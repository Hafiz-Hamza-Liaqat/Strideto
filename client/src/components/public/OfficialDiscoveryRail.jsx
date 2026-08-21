import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { canonicalScholarshipsApi, programIntelligenceApi } from '../../services/listingsService';
import { ROUTES } from '../../constants';
import { PublicTrustBadge } from './PublicTrustBadge';
import { AUTHORITY_KINDS } from '@shared/publicDiscovery/publicTruth.js';
import { formatPublicDateOnly } from '@shared/publicDiscovery/publicTruth.js';

export function OfficialScholarshipsRail() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    canonicalScholarshipsApi.list({ limit: 6 })
      .then(({ data }) => setItems(data.data || data.items || []))
      .catch(() => setError('Official scholarship records are unavailable right now.'));
  }, []);

  if (error) {
    return <p className="text-sm text-gray-500 dark:text-gray-400 mb-6" role="status">{error}</p>;
  }
  if (!items.length) return null;

  return (
    <section className="mb-8 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Official &amp; source-backed scholarships</h2>
        <Link to={ROUTES.CANONICAL_SCHOLARSHIPS} className="text-sm text-primary dark:text-mint hover:underline">View scholarship intelligence</Link>
      </div>
      <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">Institution-owned and source-backed records. Agent advice is never scholarship authority.</p>
      <ul className="grid sm:grid-cols-2 gap-3">
        {items.slice(0, 6).map((s) => (
          <li key={s._id || s.slug}>
            <Link to={`${ROUTES.CANONICAL_SCHOLARSHIPS}/${s.slug}`} className="block p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 min-w-0">
              <p className="font-medium text-gray-900 dark:text-white break-words-safe">{s.title}</p>
              <p className="text-sm text-gray-500 break-words-safe">{typeof s.provider === 'string' ? s.provider : (s.provider?.name || '')}</p>
              <div className="mt-1">
                <PublicTrustBadge
                  kind={s.institutionId || s.organizationId ? AUTHORITY_KINDS.INSTITUTION_SCHOLARSHIP : AUTHORITY_KINDS.SOURCE_BACKED}
                />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function OfficialIntakesRail() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    programIntelligenceApi.list({ limit: 6 })
      .then(({ data }) => setItems(data.data || []))
      .catch(() => setError('Official Institution intakes are unavailable right now.'));
  }, []);

  if (error) {
    return <p className="text-sm text-gray-500 dark:text-gray-400 mb-6" role="status">{error}</p>;
  }
  if (!items.length) return null;

  return (
    <section className="mb-8 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Official Institution intakes</h2>
        <Link to={ROUTES.PROGRAM_EXPLORER} className="text-sm text-primary dark:text-mint hover:underline">View programs</Link>
      </div>
      <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">Dates are Institution-provided. Missing dates are not treated as “admissions open”.</p>
      <ul className="grid sm:grid-cols-2 gap-3">
        {items.slice(0, 6).map((p) => {
          const intake = (p.intakes || [])[0];
          return (
            <li key={p._id || p.slug}>
              <Link to={`${ROUTES.PROGRAM_EXPLORER}/${p.slug}`} className="block p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 min-w-0">
                <p className="font-medium text-gray-900 dark:text-white break-words-safe">{p.name}</p>
                <p className="text-sm text-gray-500 break-words-safe">{p.institutionId?.officialName || ''}</p>
                {intake ? (
                  <p className="text-xs text-gray-500 mt-1">
                    {intake.cycleLabel || 'Intake'}
                    {intake.deadlineDate || formatPublicDateOnly(intake.deadlineAt) ? ` · Deadline ${intake.deadlineDate || formatPublicDateOnly(intake.deadlineAt)}` : ' · Deadline not specified'}
                  </p>
                ) : (
                  <p className="text-xs text-gray-500 mt-1">Upcoming intake not specified</p>
                )}
                <div className="mt-1"><PublicTrustBadge kind={AUTHORITY_KINDS.OFFICIAL_INSTITUTION} /></div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
