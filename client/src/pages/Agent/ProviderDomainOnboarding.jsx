import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Logo } from '../../components/brand/Logo';
import { ProviderDomainCards } from '../../components/provider/ProviderDomainCards.jsx';
import { agentApi, agentAuthApi } from '../../services/agentService';
import { ROUTES } from '../../constants';
import { btnPrimary } from './agentUi';

const DRAFT_KEY = 'strideto-provider-domain-onboarding';

export default function ProviderDomainOnboarding() {
  const navigate = useNavigate();
  const [domains, setDomains] = useState([]);
  const [selected, setSelected] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setSelected(parsed);
      }
    } catch { /* ignore */ }
    agentAuthApi.providerDomainCatalog()
      .then(({ data }) => setDomains(data?.domains || []))
      .catch(() => setError('Unable to load provider domains.'));
  }, []);

  useEffect(() => {
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(selected)); } catch { /* ignore */ }
  }, [selected]);

  const canContinue = selected.length > 0;
  const selectable = useMemo(
    () => domains.map((d) => ({ ...d, comingSoon: d.comingSoon || d.selectable === false })),
    [domains]
  );

  const submit = async (event) => {
    event.preventDefault();
    if (!canContinue) {
      setError('Select at least one professional area to continue.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await agentApi.completeProviderDomainOnboarding(selected);
      sessionStorage.removeItem(DRAFT_KEY);
      navigate(ROUTES.AGENT_DASHBOARD, { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to save provider domains.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-main dark:bg-secondary p-4 sm:p-8">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <Logo height={32} />
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Required provider setup</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Choose the professional services you want to provide. This is required and cannot be skipped.
        </p>
        <form onSubmit={submit} className="space-y-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-6">
          <ProviderDomainCards
            domains={selectable}
            selectedIds={selected}
            error={error}
            onToggle={(id) => {
              setError('');
              setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
            }}
          />
          <button type="submit" disabled={busy || !canContinue} className={btnPrimary}>
            {busy ? 'Saving…' : 'Continue'}
          </button>
        </form>
        <Link to={ROUTES.AGENT_LOGIN} className="text-sm text-primary">Back to login</Link>
      </div>
    </div>
  );
}
