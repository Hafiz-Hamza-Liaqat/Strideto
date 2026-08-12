import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { agentPublicApi } from '../../services/agentService';
import { ROUTES } from '../../constants';
import { SeoHead } from '../../components/seo';
import { ui } from '../../design-system/surfaceClasses';
import { CountrySelect } from '../../components/forms/CountrySelect';

function chipList(values, limit = 4) {
  const list = (values || []).filter(Boolean);
  if (!list.length) return null;
  const shown = list.slice(0, limit);
  const extra = list.length - shown.length;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {shown.map((v) => (
        <span key={v} className="rounded-md bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-xs text-gray-700 dark:text-gray-300">
          {v}
        </span>
      ))}
      {extra > 0 ? <span className="text-xs text-gray-500">+{extra}</span> : null}
    </div>
  );
}

export default function AgentDirectory() {
  const [filters, setFilters] = useState({ agentType: '', countryCode: '', destinationCountry: '' });
  const [result, setResult] = useState({ profiles: [], total: 0, page: 1, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = (page = 1) => {
    setLoading(true);
    setError('');
    const params = Object.fromEntries(
      Object.entries({ ...filters, page, limit: 20 }).filter(([, value]) => value !== '')
    );
    return agentPublicApi
      .getDirectory(params)
      .then(({ data }) => setResult(data))
      .catch(() => setError('Unable to load the agent directory.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <SeoHead
        title="Professional Agents & Agencies | Strideto"
        description="Public directory of approved agents and agencies offering professional advisory services on Strideto."
        canonical={ROUTES.AGENT_PUBLIC_DIRECTORY}
      />
      <div className={`mx-auto max-w-6xl px-4 py-10 ${ui.page}`}>
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-primary dark:text-mint mb-2">
            Professional directory
          </p>
          <h1 className={ui.h1}>Verified agents and agencies</h1>
          <p className={`mt-2 max-w-2xl ${ui.muted}`}>
            Browse approved Agent and Agency profiles. Ratings, prices, and credentials appear only when
            the platform has eligible public data — never as placeholders.
          </p>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            load();
          }}
          className={`mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 ${ui.filterPanel}`}
        >
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1" htmlFor="agent-directory-type">
              Type
            </label>
            <select
              id="agent-directory-type"
              value={filters.agentType}
              onChange={(e) => setFilters((f) => ({ ...f, agentType: e.target.value }))}
              className={ui.input}
            >
              <option value="">All types</option>
              <option value="agent">Agent</option>
              <option value="agency">Agency</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1" htmlFor="agent-directory-country">
              Country
            </label>
            <CountrySelect
              id="agent-directory-country"
              value={filters.countryCode}
              onChange={(code) => setFilters((f) => ({ ...f, countryCode: code || '' }))}
              allowAll
              allLabel="All countries"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1" htmlFor="agent-directory-destination">
              Destination expertise
            </label>
            <CountrySelect
              id="agent-directory-destination"
              value={filters.destinationCountry}
              onChange={(code) => setFilters((f) => ({ ...f, destinationCountry: code || '' }))}
              allowAll
              allLabel="All destinations"
            />
          </div>
          <div className="flex items-end">
            <button type="submit" className={`${ui.primaryBtn} w-full`}>
              Filter
            </button>
          </div>
        </form>

        {error ? (
          <p className={`mt-5 ${ui.error}`} role="alert">
            {error}
          </p>
        ) : null}

        {loading ? (
          <p className={`mt-8 ${ui.muted}`} role="status">
            Loading directory…
          </p>
        ) : result.profiles.length === 0 ? (
          <p className={`mt-8 ${ui.empty}`}>No approved profiles match these filters.</p>
        ) : (
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {result.profiles.map((profile) => {
              const typeLabel = profile.agentType === 'agency' ? 'Agency' : 'Agent';
              const specialties = profile.specialties || profile.serviceSpecialties || [];
              const destinations = profile.destinationExpertise || profile.destinationCountries || [];
              const languages = profile.languages || [];
              const location = [profile.city, profile.region || profile.province, profile.countryCode]
                .filter(Boolean)
                .join(', ');
              return (
                <article
                  key={profile.slug}
                  className={`${ui.card} p-5 flex flex-col gap-3 border border-gray-200 dark:border-gray-700`}
                >
                  <div className="flex justify-between gap-3 items-start">
                    <div className="min-w-0">
                      <h2 className="font-semibold break-words text-gray-900 dark:text-white text-lg">
                        {profile.professionalName || profile.displayName || 'Professional'}
                      </h2>
                      <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 mt-1">
                        {typeLabel}
                        {profile.verificationStatus === 'approved' || profile.verified ? ' · Verified' : ''}
                      </p>
                    </div>
                    {profile.logoUrl || profile.avatarUrl ? (
                      <img
                        src={profile.logoUrl || profile.avatarUrl}
                        alt=""
                        className="h-12 w-12 rounded-lg object-cover shrink-0 bg-gray-100 dark:bg-gray-800"
                      />
                    ) : null}
                  </div>
                  {location ? <p className={`text-sm ${ui.muted}`}>{location}</p> : null}
                  <p className="line-clamp-3 text-sm text-slate-600 dark:text-slate-300">
                    {profile.professionalSummary || profile.shortBio || 'Professional advisory profile on Strideto.'}
                  </p>
                  {chipList(specialties)}
                  {chipList(destinations.map((d) => (typeof d === 'string' ? d : d?.code || d?.name)).filter(Boolean))}
                  {languages.length ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400">Languages: {languages.join(', ')}</p>
                  ) : null}
                  {typeof profile.reviewSummary?.average === 'number' && profile.reviewSummary?.count > 0 ? (
                    <p className="text-xs text-slate-500">
                      Reviews: {profile.reviewSummary.average.toFixed(1)} ({profile.reviewSummary.count})
                    </p>
                  ) : null}
                  <div className="mt-auto pt-2 flex flex-wrap gap-2">
                    <Link
                      to={`${ROUTES.AGENT_PUBLIC_DIRECTORY}/${profile.slug}`}
                      className={`${ui.primaryBtn} text-sm`}
                    >
                      View profile
                    </Link>
                    {profile.consultationEligible ? (
                      <Link
                        to={`${ROUTES.AGENT_PUBLIC_DIRECTORY}/${profile.slug}#consult`}
                        className={`${ui.secondaryBtn} text-sm`}
                      >
                        Request consultation
                      </Link>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {result.pages > 1 ? (
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              type="button"
              disabled={result.page <= 1 || loading}
              onClick={() => load(result.page - 1)}
              className={ui.secondaryBtn}
            >
              Previous
            </button>
            <span className="text-sm">
              Page {result.page} of {result.pages}
            </span>
            <button
              type="button"
              disabled={result.page >= result.pages || loading}
              onClick={() => load(result.page + 1)}
              className={ui.secondaryBtn}
            >
              Next
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
}
