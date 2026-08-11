import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { agentPublicApi } from '../../services/agentService';
import { ROUTES } from '../../constants';
import { SeoHead } from '../../components/seo';
import { ui } from '../../design-system/surfaceClasses';

export default function AgentDirectory() {
  const [filters, setFilters] = useState({ agentType: '', countryCode: '', destinationCountry: '' });
  const [result, setResult] = useState({ profiles: [], total: 0, page: 1, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = (page = 1) => {
    setLoading(true);
    setError('');
    const params = Object.fromEntries(Object.entries({ ...filters, page, limit: 20 }).filter(([, value]) => value !== ''));
    return agentPublicApi.getDirectory(params).then(({ data }) => setResult(data)).catch(() => setError('Unable to load the agent directory.')).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <SeoHead title="Professional Services | Strideto" description="Public directory of approved agents and agencies on Strideto." canonical={ROUTES.AGENT_PUBLIC_DIRECTORY} />
      <div className={`mx-auto max-w-6xl px-4 py-10 ${ui.page}`}>
        <div>
          <h1 className={ui.h1}>Verified agents and agencies</h1>
          <p className={`mt-2 ${ui.muted}`}>Only organizations with current approved verification appear here.</p>
        </div>
        <form onSubmit={(event) => { event.preventDefault(); load(); }} className={`mt-6 grid gap-3 sm:grid-cols-4 ${ui.filterPanel}`}>
          <label className="sr-only" htmlFor="agent-directory-type">Agent type</label>
          <select id="agent-directory-type" aria-label="Agent type" value={filters.agentType} onChange={(e) => setFilters((f) => ({ ...f, agentType: e.target.value }))} className={ui.input}>
            <option value="">All types</option>
            <option value="agent">Agent</option>
            <option value="agency">Agency</option>
          </select>
          <label className="sr-only" htmlFor="agent-directory-country">Country code</label>
          <input id="agent-directory-country" aria-label="Country code" value={filters.countryCode} onChange={(e) => setFilters((f) => ({ ...f, countryCode: e.target.value.toUpperCase() }))} maxLength="2" placeholder="Country code" className={ui.input} />
          <label className="sr-only" htmlFor="agent-directory-destination">Destination code</label>
          <input id="agent-directory-destination" aria-label="Destination code" value={filters.destinationCountry} onChange={(e) => setFilters((f) => ({ ...f, destinationCountry: e.target.value.toUpperCase() }))} maxLength="2" placeholder="Destination code" className={ui.input} />
          <button className={ui.primaryBtn}>Filter</button>
        </form>
        {error ? <p className={`mt-5 ${ui.error}`} role="alert">{error}</p> : null}
        {loading ? (
          <p className={`mt-8 ${ui.muted}`} role="status">Loading directory…</p>
        ) : result.profiles.length === 0 ? (
          <p className={`mt-8 ${ui.empty}`}>No approved profiles match these filters.</p>
        ) : (
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {result.profiles.map((profile) => (
              <Link key={profile.slug} to={`${ROUTES.AGENT_PUBLIC_DIRECTORY}/${profile.slug}`} className={`${ui.card} p-5 transition hover:border-blue-400 dark:hover:border-blue-500`}>
                <div className="flex justify-between gap-3">
                  <h2 className="font-semibold break-words text-gray-900 dark:text-white">{profile.professionalName}</h2>
                  <span className="text-xs uppercase text-slate-500 dark:text-slate-400">{profile.agentType}</span>
                </div>
                <p className="mt-2 line-clamp-3 text-sm text-slate-600 dark:text-slate-300">{profile.professionalSummary || 'Professional profile'}</p>
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{profile.countryCode} · {(profile.languages || []).join(', ')}</p>
              </Link>
            ))}
          </div>
        )}
        {result.pages > 1 ? (
          <div className="mt-6 flex items-center justify-center gap-3">
            <button disabled={result.page <= 1 || loading} onClick={() => load(result.page - 1)} className={ui.secondaryBtn}>Previous</button>
            <span className="text-sm">Page {result.page} of {result.pages}</span>
            <button disabled={result.page >= result.pages || loading} onClick={() => load(result.page + 1)} className={ui.secondaryBtn}>Next</button>
          </div>
        ) : null}
      </div>
    </>
  );
}
