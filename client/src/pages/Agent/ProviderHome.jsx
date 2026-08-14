import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { agentApi } from '../../services/agentService';
import { ROUTES } from '../../constants';
import { PROVIDER_DOMAIN_IDS } from '@shared/provider/providerDomains.js';
import { btnPrimary, btnSecondary, cardClass, muted } from './agentUi';
import { PortalWelcomeBanner } from '../../components/welcome/PortalWelcomeBanner';
import { useAgentAuth } from '../../context/AgentAuthContext';

const PREF_KEY = 'strideto-provider-workspace';

function readPref() {
  try {
    return JSON.parse(localStorage.getItem(PREF_KEY) || 'null');
  } catch {
    return null;
  }
}

function workspaceKey(row) {
  return `${row.subjectType}:${row.subjectId}:${row.domainId}`;
}

export default function ProviderHome() {
  const { agent } = useAgentAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const stayHome = params.get('home') === '1';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => agentApi.getProviderHome()
    .then(({ data: payload }) => setData(payload))
    .catch((err) => setError(err.response?.data?.error || 'Unable to load Provider Home.'));

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const cards = data?.cards || [];
  const groups = useMemo(() => {
    const map = new Map();
    for (const card of cards) {
      const key = `${card.subjectType}:${card.subjectId}`;
      if (!map.has(key)) map.set(key, { label: card.label, kind: card.kind, items: [] });
      map.get(key).items.push(card);
    }
    return [...map.values()];
  }, [cards]);

  useEffect(() => {
    if (!data || stayHome || data.needsOnboarding) return;
    if (data.needsOnboarding) {
      navigate(ROUTES.AGENT_DOMAIN_ONBOARDING, { replace: true });
      return;
    }
    if (cards.length === 1) {
      navigate(cards[0].path + `?subjectType=${cards[0].subjectType}&subjectId=${cards[0].subjectId}`, { replace: true });
      return;
    }
    const pref = readPref();
    if (pref && cards.length > 1) {
      const match = cards.find((c) => workspaceKey(c) === `${pref.subjectType}:${pref.subjectId}:${pref.domainId}`);
      if (match) navigate(`${match.path}?subjectType=${match.subjectType}&subjectId=${match.subjectId}`, { replace: true });
    }
  }, [data, stayHome, cards, navigate]);

  const addDomain = async (domainId, subject) => {
    setBusy(domainId);
    setError('');
    try {
      await agentApi.addProviderDomain({
        subjectType: subject.subjectType,
        subjectId: subject.subjectId,
        domainId,
      });
      await load();
      if (domainId === PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES) {
        navigate(`${ROUTES.AGENT_BUSINESS_SERVICES_CAPABILITIES}?subjectType=${subject.subjectType}&subjectId=${subject.subjectId}`);
      } else {
        navigate(ROUTES.AGENT_VERIFICATION);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to add provider domain.');
    } finally {
      setBusy('');
    }
  };

  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true">
        <div className="h-7 w-48 rounded bg-gray-200 dark:bg-gray-700" />
        <div className={`${cardClass} h-28`} />
      </div>
    );
  }

  const independent = cards.find((c) => c.kind === 'independent') || {
    subjectType: 'agent',
    subjectId: data?.accountId,
    kind: 'independent',
  };

  return (
    <div className="space-y-6 min-w-0">
      <PortalWelcomeBanner
        realm="agent"
        userId={agent?._id || agent?.agentProfileId}
        displayName={agent?.professionalName || agent?.displayName}
      />
      <header className="min-w-0">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Provider Home</h1>
        <p className={`${muted} mt-1 break-words`}>
          Choose the professional area you are managing. Independent and Agency identities stay separate.
        </p>
      </header>
      {error ? <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-300" role="alert">{error}</p> : null}

      {groups.map((group) => (
        <section key={group.label} className="space-y-3 min-w-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white break-words">{group.label}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {group.items.map((card) => (
              <article key={workspaceKey(card)} className={`${cardClass} min-w-0`}>
                <h3 className="font-semibold text-gray-900 dark:text-white break-words">{card.domain?.publicName}</h3>
                <p className={`mt-1 ${muted} break-words`}>
                  {card.domainId === PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES
                    ? `Verified capabilities: ${card.counters?.verifiedCapabilities ?? 0} · Listings: ${card.counters?.listings ?? 0}`
                    : `Verification: ${card.counters?.verificationStatus || 'draft'} · Active services: ${card.counters?.activeServices ?? 0} · Leads: ${card.counters?.leads ?? 0}`}
                </p>
                <Link
                  to={`${card.path}?subjectType=${card.subjectType}&subjectId=${card.subjectId}`}
                  className={`${btnPrimary} mt-4`}
                  onClick={() => {
                    try {
                      localStorage.setItem(PREF_KEY, JSON.stringify({
                        subjectType: card.subjectType,
                        subjectId: card.subjectId,
                        domainId: card.domainId,
                      }));
                    } catch { /* UX only */ }
                  }}
                >
                  Open {card.domain?.shortName || 'workspace'}
                </Link>
              </article>
            ))}
          </div>
        </section>
      ))}

      {(data?.addableDomains || []).length > 0 ? (
        <section className={`${cardClass} space-y-3 min-w-0`}>
          <h2 className="font-semibold text-gray-900 dark:text-white">Add another provider category</h2>
          <p className={muted}>Adding a domain does not verify professional capabilities.</p>
          {(data.addableDomains || []).map((domain) => (
            <div key={domain.domainId} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium text-gray-900 dark:text-white break-words">{domain.publicName}</p>
                <p className={`${muted} break-words`}>{domain.description}</p>
              </div>
              <button
                type="button"
                className={btnSecondary}
                disabled={Boolean(busy)}
                onClick={() => addDomain(domain.domainId, independent)}
              >
                + Add {domain.shortName}
              </button>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
