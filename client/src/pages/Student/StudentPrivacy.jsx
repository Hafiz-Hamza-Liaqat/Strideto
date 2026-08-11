import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { ROUTES } from '../../constants';
import { privacyApi } from '../../services/privacyApi';
import { authApi } from '../../services/authService';
import { NOTIFICATION_CATEGORIES } from '@shared/international/notificationPreferences.js';

const OPTIONAL_CATEGORIES = [
  NOTIFICATION_CATEGORIES.JOBS,
  NOTIFICATION_CATEGORIES.SCHOLARSHIPS,
  NOTIFICATION_CATEGORIES.TESTS,
  NOTIFICATION_CATEGORIES.PROMOTIONS,
];

export default function StudentPrivacy() {
  const { t } = useTranslation(['student', 'common']);
  const [overview, setOverview] = useState(null);
  const [prefs, setPrefs] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = () => privacyApi.overview().then(({ data }) => {
    setOverview(data);
    setPrefs(data.notificationPreferences || {});
  });

  useEffect(() => {
    load()
      .catch((err) => setError(err.response?.data?.error || 'Unable to load privacy settings'))
      .finally(() => setLoading(false));
  }, []);

  async function savePrefs(e) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await authApi.updateProfile({ notificationPreferences: prefs });
      setMessage(t('common:saved', { defaultValue: 'Saved' }));
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save preferences');
    } finally {
      setBusy(false);
    }
  }

  async function requestExport() {
    setBusy(true);
    setError('');
    try {
      await privacyApi.requestExport();
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create export request');
    } finally {
      setBusy(false);
    }
  }

  async function requestDeletion() {
    if (!confirmDelete) return;
    setBusy(true);
    setError('');
    try {
      await privacyApi.requestDeletion();
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create deletion request');
    } finally {
      setBusy(false);
    }
  }

  async function cancel(id) {
    setBusy(true);
    try {
      await privacyApi.cancelRequest(id);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not cancel');
    } finally {
      setBusy(false);
    }
  }

  function togglePref(category) {
    setPrefs((prev) => {
      const currentlyOn = prev[category]?.in_app !== false;
      return { ...prev, [category]: { in_app: !currentlyOn } };
    });
  }

  return (
    <>
      <SeoHead title={t('student:privacy.title')} noindex />
      <div className="max-w-3xl mx-auto px-4 py-8 min-w-0 w-full space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('student:privacy.title')}</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">{t('student:privacy.intro')}</p>
        </header>
        {loading ? <p role="status">Loading…</p> : null}
        {error ? <p className="text-red-600 dark:text-red-400" role="alert">{error}</p> : null}
        {message ? <p className="text-emerald-700 dark:text-emerald-400" role="status">{message}</p> : null}

        <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('student:privacy.scopesTitle')}</h2>
          <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{t('student:privacy.scopesBody')}</p>
          <ul className="mt-3 list-disc list-inside text-sm text-gray-700 dark:text-gray-300">
            {(overview?.consentScopes || []).map((scope) => (
              <li key={scope}>{scope.replaceAll('_', ' ')}</li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('student:privacy.grantsTitle')}</h2>
          {(overview?.consents || []).length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">{t('student:privacy.noGrants')}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {overview.consents.map((g) => (
                <li key={g.id} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-sm">
                  <p><strong>{t('student:privacy.grantee')}:</strong> {g.counterpartyType} · {g.counterpartyId}</p>
                  <p className="text-gray-500">{t('student:privacy.expires')}: {g.expiresAt ? new Date(g.expiresAt).toLocaleDateString() : '—'}</p>
                  <Link to={`${ROUTES.VAULT}/${g.documentId}`} className="inline-flex min-h-[44px] items-center text-primary dark:text-mint hover:underline">
                    {t('student:privacy.openVault')}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 space-y-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('student:privacy.requestsTitle')}</h2>
          {(overview?.requests || []).length === 0 ? (
            <p className="text-sm text-gray-500">{t('student:privacy.noRequests')}</p>
          ) : (
            <ul className="space-y-2">
              {overview.requests.map((req) => (
                <li key={req.id} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-sm">
                  <p className="font-medium capitalize">{req.type} · {req.status.replaceAll('_', ' ')}</p>
                  <p className="text-gray-500">Requested {new Date(req.requestedAt).toLocaleString()}</p>
                  {req.type === 'export' && req.status === 'completed' && !req.artifactAvailable ? (
                    <p>{t('student:privacy.noArtifact')}</p>
                  ) : null}
                  {req.type === 'deletion' && req.status === 'requested' ? (
                    <button type="button" disabled={busy} onClick={() => cancel(req.id)} className="min-h-[44px] text-red-600 hover:underline">
                      {t('student:privacy.cancel')}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-3">
            <button type="button" disabled={busy} onClick={requestExport} className="min-h-[44px] px-4 rounded-lg bg-primary text-white">
              {t('student:privacy.requestExport')}
            </button>
          </div>
          <p className="text-sm text-amber-800 dark:text-amber-200">{t('student:privacy.deletionWarning')}</p>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={confirmDelete} onChange={(e) => setConfirmDelete(e.target.checked)} />
            {t('student:privacy.confirmDeletion')}
          </label>
          <button type="button" disabled={busy || !confirmDelete} onClick={requestDeletion} className="min-h-[44px] px-4 rounded-lg border border-red-600 text-red-700 disabled:opacity-50">
            {t('student:privacy.requestDeletion')}
          </button>
        </section>

        <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('student:privacy.channelsTitle')}</h2>
          <p className="mt-2 text-sm">{t('student:privacy.inAppOn')}</p>
          {['email', 'sms', 'push', 'whatsapp'].map((ch) => (
            overview?.channelsConfigured?.[ch] ? null : (
              <p key={ch} className="text-sm text-gray-500">{t('student:privacy.channelOff', { channel: ch })}</p>
            )
          ))}
          <p className="mt-3 text-sm">{t('student:privacy.mandatoryNote')}</p>
          <form onSubmit={savePrefs} className="mt-4 space-y-2">
            <p className="font-medium">{t('student:privacy.prefsTitle')}</p>
            {OPTIONAL_CATEGORIES.map((cat) => (
              <label key={cat} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={prefs[cat]?.in_app !== false}
                  onChange={() => togglePref(cat)}
                />
                {cat.replaceAll('_', ' ')}
              </label>
            ))}
            <button type="submit" disabled={busy} className="min-h-[44px] px-4 rounded-lg bg-primary text-white">
              {t('student:privacy.savePrefs')}
            </button>
          </form>
        </section>

        <Link to={`${ROUTES.PROFILE}#account-settings`} className="inline-flex min-h-[44px] items-center text-primary dark:text-mint hover:underline">
          {t('student:privacy.accountLink')}
        </Link>
      </div>
    </>
  );
}
