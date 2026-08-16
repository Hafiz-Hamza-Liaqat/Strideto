import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { agentApi } from '../../services/agentService';
import { ROUTES } from '../../constants';
import { PROVIDER_DOMAIN_IDS, publicProviderDomainProjection } from '@shared/provider/providerDomains.js';
import { btnPrimary, btnSecondary, cardClass, muted } from './agentUi';
import { PortalWelcomeBanner } from '../../components/welcome/PortalWelcomeBanner';
import { useAgentAuth } from '../../context/AgentAuthContext';
import {
  kindLabel,
  subjectKey,
  withProviderSubject,
  writeProviderWorkspacePref,
} from '../../config/providerWorkspacePref';
// Workspace preference remains UX-only (strideto-provider-workspace).

function workspaceKey(row) {
  return `${row.subjectType}:${row.subjectId}:${row.domainId}`;
}

function addableDomainsForGroup(items, businessEnabled) {
  const have = new Set((items || []).map((card) => card.domainId));
  const ids = [PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY];
  if (businessEnabled) ids.push(PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES);
  return ids
    .map(publicProviderDomainProjection)
    .filter((domain) => domain && !have.has(domain.domainId));
}

function domainCardTitle(card) {
  if (card.domainId === PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES) return 'Business Services';
  return 'Education & Mobility';
}

export default function ProviderHome() {
  const { agent } = useAgentAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => agentApi.getProviderHome()
    .then(({ data: payload }) => setData(payload))
    .catch((err) => setError(err.response?.data?.error || 'Unable to load Provider Dashboard.'));

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const cards = useMemo(() => data?.cards || [], [data]);
  const groups = useMemo(() => {
    const map = new Map();
    for (const card of cards) {
      const key = subjectKey(card);
      if (!map.has(key)) {
        map.set(key, {
          key,
          label: card.label,
          kind: card.kind,
          subjectType: card.subjectType,
          subjectId: card.subjectId,
          items: [],
        });
      }
      map.get(key).items.push(card);
    }
    return [...map.values()];
  }, [cards]);

  useEffect(() => {
    if (!data) return;
    if (data.needsOnboarding) {
      navigate(ROUTES.AGENT_DOMAIN_ONBOARDING, { replace: true });
    }
  }, [data, navigate]);

  const addDomain = async (domainId, subject) => {
    setBusy(`${subject.subjectType}:${subject.subjectId}:${domainId}`);
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

  const displayName = agent?.professionalName || agent?.displayName || 'Provider';
  const bothDomains = cards.some((c) => c.domainId === PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY)
    && cards.some((c) => c.domainId === PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES);

  return (
    <div className="space-y-6 min-w-0">
      <PortalWelcomeBanner
        realm="agent"
        userId={agent?._id || agent?.agentProfileId}
        displayName={displayName}
      />
      <header className="min-w-0">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Provider Dashboard</h1>
        <p className="mt-2 text-lg text-gray-900 dark:text-white break-words">Welcome back, {displayName}</p>
        <p className={`${muted} mt-1 break-words`}>
          Choose who you are acting as, then open a professional dashboard. Independent and Agency identities stay separate.
        </p>
      </header>
      {error ? <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-300" role="alert">{error}</p> : null}

      {groups.map((group) => {
        const addable = addableDomainsForGroup(group.items, data?.businessServicesProviderEnabled);
        const subject = { subjectType: group.subjectType, subjectId: group.subjectId };
        return (
          <section key={group.key} className="space-y-3 min-w-0">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Acting as</p>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white break-words">{group.label}</h2>
              <p className={`${muted} break-words`}>{kindLabel(group.kind)}</p>
            </div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Your workspaces</h3>
            <div className={`grid gap-3 ${bothDomains || group.items.length > 1 ? 'md:grid-cols-2' : 'md:grid-cols-1'}`}>
              {group.items.map((card) => (
                <article key={workspaceKey(card)} className={`${cardClass} min-w-0`}>
                  <h3 className="font-semibold text-gray-900 dark:text-white break-words">{domainCardTitle(card)}</h3>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 break-words">{card.domain?.publicName}</p>
                  <p className={`mt-1 ${muted} break-words`}>
                    {card.domainId === PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES
                      ? `Verified capabilities: ${card.counters?.verifiedCapabilities ?? 0} · Listings: ${card.counters?.listings ?? 0}`
                      : `Verification: ${card.counters?.verificationStatus || 'draft'} · Active services: ${card.counters?.activeServices ?? 0} · Leads: ${card.counters?.leads ?? 0}`}
                  </p>
                  <Link
                    to={withProviderSubject(card.path, subject)}
                    className={`${btnPrimary} mt-4`}
                    onClick={() => {
                      writeProviderWorkspacePref({
                        subjectType: card.subjectType,
                        subjectId: card.subjectId,
                        domainId: card.domainId,
                      });
                    }}
                  >
                    Open {domainCardTitle(card)}
                  </Link>
                </article>
              ))}
            </div>
            {addable.length > 0 ? (
              <div className={`${cardClass} space-y-3 min-w-0`}>
                <h3 className="font-semibold text-gray-900 dark:text-white">Add another provider category</h3>
                <p className={`${muted} break-words`}>
                  Adding a domain does not verify professional capabilities. This changes {group.label} only.
                  Independent and Agency identities stay separate.
                </p>
                {addable.map((domain) => (
                  <div key={domain.domainId} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white break-words">{domain.publicName}</p>
                      <p className={`${muted} break-words`}>{domain.description}</p>
                    </div>
                    <button
                      type="button"
                      className={btnSecondary}
                      disabled={Boolean(busy)}
                      aria-label={`Add ${domain.publicName} for ${group.label}`}
                      onClick={() => addDomain(domain.domainId, {
                        subjectType: group.subjectType,
                        subjectId: group.subjectId,
                      })}
                    >
                      + Add {domain.shortName}
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
