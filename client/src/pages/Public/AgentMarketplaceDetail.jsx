import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { agentPublicApi, studentMarketplaceApi } from '../../services/agentService';
import { checkSaved, saveOpportunity, unsaveOpportunity } from '../../services/actionEngineService';
import { ROUTES } from '../../constants';
import { SeoHead } from '../../components/seo';
import { ui } from '../../design-system/surfaceClasses';

export default function AgentMarketplaceDetail() {
  const { t } = useTranslation('common');
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    agentPublicApi
      .getMarketplacePost(slug)
      .then((r) => {
        setPost(r.data.post);
        return checkSaved('agent_marketplace_post', r.data.post.id)
          .then((x) => setSaved(!!x.saved))
          .catch(() => {});
      })
      .catch((e) => setError(e.response?.status === 404 ? 'This marketplace post is not currently available.' : 'Unable to load post.'))
      .finally(() => setLoading(false));
  }, [slug]);

  const interest = async () => {
    setBusy(true);
    setError('');
    try {
      await studentMarketplaceApi.expressInterest(slug);
      setMessage('Interest recorded. The agent receives only a minimal relationship record.');
    } catch (e) {
      setError(e.response?.data?.error || 'Sign in as a student to request information.');
    } finally {
      setBusy(false);
    }
  };

  const toggleSave = async () => {
    setBusy(true);
    setError('');
    try {
      if (saved) await unsaveOpportunity('agent_marketplace_post', post.id);
      else await saveOpportunity({ entityType: 'agent_marketplace_post', entityId: post.id });
      setSaved(!saved);
      setMessage(saved ? 'Removed from saved items.' : 'Saved privately. No agent relationship was created.');
    } catch {
      setError('Sign in as a student to save this item.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className={`mx-auto max-w-4xl p-8 ${ui.muted}`}>{t('loading', { defaultValue: 'Loading…' })}</div>;
  }

  if (error && !post) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <p className="rounded bg-amber-50 dark:bg-amber-950/40 p-4 text-amber-800 dark:text-amber-200">{error}</p>
      </div>
    );
  }

  const canonical = `${ROUTES.AGENT_PUBLIC_MARKETPLACE}/${post.slug}`;

  return (
    <>
      <SeoHead title={`${post.title} | Agent marketplace`} description={post.summary} canonical={canonical} />
      <div className={`mx-auto max-w-4xl space-y-6 px-4 py-10 min-w-0 ${ui.page}`}>
        <Link to={ROUTES.AGENT_PUBLIC_MARKETPLACE} className="text-sm text-primary dark:text-mint hover:underline">← Marketplace</Link>

        {error ? <p className={ui.error} role="alert">{error}</p> : null}
        {message ? <p className="rounded bg-green-50 dark:bg-green-950/30 p-3 text-green-800 dark:text-green-200">{message}</p> : null}

        <header className={`${ui.card} p-6`}>
          <p className="text-xs uppercase text-blue-700 dark:text-blue-300">{post.postType.replaceAll('_', ' ')}</p>
          <h1 className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white break-words-safe">{post.title}</h1>
          <p className="mt-3 text-slate-600 dark:text-gray-300">{post.summary}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {(post.trustBadges || []).map((b) => (
              <span key={b} className="rounded-full bg-green-50 dark:bg-green-950/40 px-2 py-1 text-xs text-green-800 dark:text-green-200">{b.replaceAll('_', ' ')}</span>
            ))}
          </div>
          <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
            By <Link to={`${ROUTES.AGENT_PUBLIC_DIRECTORY}/${post.agent.slug}`} className="text-primary dark:text-mint hover:underline">{post.agent.professionalName}</Link>
          </p>
        </header>

        <section className="rounded-xl border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-950/30 p-5">
          <p className="text-xs font-bold uppercase text-blue-800 dark:text-blue-200">Agent statement</p>
          <p className="mt-2 whitespace-pre-line text-slate-800 dark:text-gray-200">{post.agentStatement}</p>
        </section>

        {post.canonicalReferences?.length > 0 ? (
          <section className="rounded-xl border-l-4 border-green-600 bg-white dark:bg-gray-800 p-5 border border-gray-200 dark:border-gray-700">
            <p className="text-xs font-bold uppercase text-green-800 dark:text-green-300">Source-backed facts</p>
            <div className="mt-3 space-y-3">
              {post.canonicalReferences.map((ref, i) => (
                <div key={`${ref.referenceType}-${i}`}>
                  <p className="font-medium text-gray-900 dark:text-white">{ref.name || ref.title || ref.officialName}</p>
                  <p className="text-xs text-slate-500 dark:text-gray-400">Canonical {ref.referenceType.replaceAll('_', ' ')} record</p>
                </div>
              ))}
              {(post.factualClaims || []).map((c) => (
                <p key={c.claimKey} className="text-sm text-slate-700 dark:text-gray-300">{c.statement}</p>
              ))}
            </div>
            {(post.sources || []).map((s) => (
              <a key={s._id} href={s.url} target="_blank" rel="noreferrer" className="mt-3 block text-sm text-primary dark:text-mint hover:underline">
                Source: {s.label || s.publisher || 'Official reference'} · Last verified {s.lastVerifiedAt ? new Date(s.lastVerifiedAt).toLocaleDateString() : 'unknown'}
              </a>
            ))}
            {post.freshnessWarning ? (
              <p className="mt-3 rounded bg-amber-50 dark:bg-amber-950/40 p-2 text-sm text-amber-800 dark:text-amber-200">{post.freshnessWarning}</p>
            ) : null}
          </section>
        ) : null}

        {post.relatedService ? (
          <section className={`${ui.card} p-5`}>
            <p className="text-xs font-bold uppercase text-slate-500 dark:text-gray-400">Related professional service</p>
            <h2 className="mt-1 font-semibold text-gray-900 dark:text-white">{post.relatedService.title}</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-gray-300">
              {post.relatedService.deliveryMode} · {post.relatedService.pricingMode.replaceAll('_', ' ')}
            </p>
            <Link to={`/consultations/new?serviceId=${post.relatedService._id}&marketplacePostId=${post.id}`} className={`${ui.primaryBtn} mt-4 inline-flex`}>
              Request consultation
            </Link>
          </section>
        ) : null}

        <section className="rounded-xl border-l-4 border-slate-500 bg-slate-50 dark:bg-gray-800/60 p-5">
          <p className="text-xs font-bold uppercase text-slate-600 dark:text-gray-400">Platform information</p>
          <p className="mt-2 text-sm text-slate-700 dark:text-gray-300">{post.platformInformation}</p>
        </section>

        <div className="flex flex-wrap gap-3">
          <button type="button" disabled={busy} onClick={interest} className={ui.primaryBtn}>I&apos;m interested — request information</button>
          <button type="button" disabled={busy} onClick={toggleSave} className={ui.secondaryBtn}>{saved ? 'Remove saved item' : 'Save privately'}</button>
        </div>
        <p className="text-xs text-slate-500 dark:text-gray-400">
          Requesting information does not share your full profile or Vault documents and does not open messaging or booking.
        </p>
      </div>
    </>
  );
}
