import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { SeoHead } from '../../components/seo';
import { ROUTES } from '../../constants';
import { ui } from '../../design-system/surfaceClasses';
import { gbsBuyerApi } from '../../services/gbsBuyerApi';

function ActivationCard({ onActivated, busy, error }) {
  return (
    <section className={`${ui.card} p-6 space-y-4 min-w-0`}>
      <h1 className={ui.h1}>Activate Business Services</h1>
      <p className={`${ui.muted} break-words-safe`}>
        This enables your Business Services request workspace. It does not verify your identity, create a
        business, grant provider authority, or create an Agent account.
      </p>
      {error ? <p className={ui.error} role="alert">{error}</p> : null}
      <button type="button" className={ui.primaryBtn} onClick={onActivated} disabled={busy} aria-busy={busy}>
        {busy ? 'Activating…' : 'Activate Business Services'}
      </button>
    </section>
  );
}

export default function BusinessClientLayout() {
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [activated, setActivated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await gbsBuyerApi.enabled();
      setUnavailable(false);
      setActivated(data.activated === true);
    } catch (err) {
      const status = err.response?.status;
      if (status === 403) setUnavailable(true);
      else setError('Unable to load Business Services.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const activate = async () => {
    setBusy(true);
    setError('');
    try {
      await gbsBuyerApi.activate();
      setActivated(true);
    } catch (err) {
      if (err.response?.status === 403) setUnavailable(true);
      else setError('Unable to activate Business Services.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SeoHead title="Business | Strideto" noindex />
      <div className={`mx-auto max-w-5xl px-4 py-8 space-y-6 ${ui.page}`}>
        {loading ? (
          <div className={`${ui.card} p-6 ${ui.muted}`} role="status" aria-busy="true">
            Loading Business workspace…
          </div>
        ) : unavailable ? (
          <section className={`${ui.card} p-6`}>
            <h1 className={ui.h1}>Business Services unavailable</h1>
            <p className={`mt-3 ${ui.muted}`}>This workspace is not available for this account.</p>
          </section>
        ) : !activated ? (
          <ActivationCard onActivated={activate} busy={busy} error={error} />
        ) : (
          <>
            <header className="space-y-2 min-w-0">
              <h1 className={ui.h1}>Business</h1>
              <p className={`${ui.muted} break-words-safe`}>
                Request Business Services from approved providers. This workspace does not create quotes,
                payments, or formation cases.
              </p>
            </header>
            <nav aria-label="Business sections" className="flex flex-wrap gap-2">
              <NavLink
                to={ROUTES.BUSINESS}
                end
                className={({ isActive }) =>
                  `inline-flex min-h-[44px] items-center rounded-lg px-3 py-2 text-sm font-medium ${
                    isActive ? 'bg-blue-700 text-white dark:bg-blue-600' : 'border border-gray-200 dark:border-gray-600'
                  }`
                }
              >
                Overview
              </NavLink>
              <NavLink
                to={`${ROUTES.BUSINESS}/requests`}
                className={({ isActive }) =>
                  `inline-flex min-h-[44px] items-center rounded-lg px-3 py-2 text-sm font-medium ${
                    isActive ? 'bg-blue-700 text-white dark:bg-blue-600' : 'border border-gray-200 dark:border-gray-600'
                  }`
                }
              >
                Service Requests
              </NavLink>
            </nav>
            <Outlet />
            <p>
              <Link to={ROUTES.BUSINESS_SERVICES} className={ui.link}>Browse Business Services marketplace</Link>
            </p>
          </>
        )}
      </div>
    </>
  );
}
