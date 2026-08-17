import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { studentTrustApi } from '../../services/agentService';
import { ui } from '../../design-system/surfaceClasses';

const reportCategories = ['misleading_claim', 'guarantee_claim', 'misconduct', 'harassment', 'privacy_concern', 'fraud_suspicion', 'impersonation', 'unauthorized_document_request', 'poor_service', 'spam', 'inaccurate_information', 'other'];
const disputeCategories = ['service_not_delivered', 'service_quality', 'scope_disagreement', 'unauthorized_action', 'document_access', 'communication', 'cancellation', 'outcome_misrepresentation', 'other'];
const label = (value) => (value || '').replaceAll('_', ' ');

export default function TrustCenter() {
  const [params] = useSearchParams();
  const requestedAction = params.get('action') || '';
  const contextType = params.get('contextType') || '';
  const contextId = params.get('contextId') || '';
  const [tab, setTab] = useState(requestedAction === 'report' ? 'reports' : requestedAction === 'dispute' ? 'disputes' : 'reviews');
  const [data, setData] = useState({ reviews: [], reports: [], disputes: [] });
  const [eligibility, setEligibility] = useState(null);
  const [form, setForm] = useState({ rating: '5', title: '', body: '', category: requestedAction === 'dispute' ? 'service_quality' : 'poor_service', description: '', summary: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const load = () => Promise.all([studentTrustApi.reviews(), studentTrustApi.reports(), studentTrustApi.disputes()]).then(([reviews, reports, disputes]) => setData({ reviews: reviews.data.reviews || [], reports: reports.data.reports || [], disputes: disputes.data.disputes || [] }));
  useEffect(() => { void load().catch(() => setError('Unable to load Trust Center history.')); }, []);
  useEffect(() => {
    if (requestedAction !== 'review' || !contextType || !contextId) return;
    studentTrustApi.eligibility(contextType, contextId).then((response) => setEligibility(response.data)).catch((e) => setEligibility({ eligible: false, reason: e.response?.data?.error || 'Eligibility unavailable' }));
  }, [requestedAction, contextType, contextId]);
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true); setError(''); setNotice('');
    try {
      if (requestedAction === 'review') {
        if (!eligibility?.eligible) throw new Error('This interaction is not review eligible.');
        await studentTrustApi.createReview({ interactionType: contextType, interactionId: contextId, rating: Number(form.rating), title: form.title, body: form.body });
        setEligibility({ eligible: false, reason: 'already_reviewed' });
        setNotice('Verified-interaction review published.');
      } else if (requestedAction === 'report') {
        await studentTrustApi.createReport({ targetType: contextType, targetId: contextId, category: form.category, description: form.description });
        setNotice('Private report submitted for moderation.');
      } else if (requestedAction === 'dispute') {
        await studentTrustApi.openDispute({ contextType, contextId, category: form.category, summary: form.summary });
        setNotice('Professional service dispute opened.');
      }
      await load();
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Trust action failed.');
    } finally {
      setBusy(false);
    }
  };
  const validContext = ['consultation', 'professional_case'].includes(contextType) && /^[a-f0-9]{24}$/i.test(contextId);
  return (
    <div className={`mx-auto max-w-4xl space-y-6 px-4 py-10 ${ui.page}`}>
      <header><h1 className={ui.h1}>Reviews, reports and disputes</h1><p className={`mt-2 ${ui.muted}`}>Reviews are available only after an eligible completed interaction. Reports are allegations until reviewed and do not prove guilt. Professional disputes are separate from payment disputes.</p></header>
      {error ? <p className={ui.error} role="alert">{error}</p> : null}
      {notice ? <p className="rounded-lg bg-emerald-50 p-3 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200" role="status">{notice}</p> : null}

      {requestedAction && validContext ? (
        <section className={`${ui.card} p-5`} aria-labelledby="trust-action-heading">
          <h2 id="trust-action-heading" className="text-lg font-semibold">{requestedAction === 'review' ? 'Review verified interaction' : requestedAction === 'report' ? 'Report this interaction' : 'Open professional dispute'}</h2>
          <p className={`mt-1 ${ui.muted}`}>Context: {label(contextType)}. The server verifies that this exact interaction belongs to you.</p>
          {requestedAction === 'review' && eligibility && !eligibility.eligible ? <p className={`mt-3 ${ui.warning}`}>Review unavailable: {eligibility.reason || 'not eligible'}.</p> : null}
          <form onSubmit={submit} className="mt-4 grid gap-3">
            {requestedAction === 'review' ? (
              <>
                <label className="text-sm font-medium">Rating<select className={ui.input} value={form.rating} onChange={(e) => setForm((old) => ({ ...old, rating: e.target.value }))}>{[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} / 5</option>)}</select></label>
                <label className="text-sm font-medium">Title (optional)<input className={ui.input} maxLength={120} value={form.title} onChange={(e) => setForm((old) => ({ ...old, title: e.target.value }))} /></label>
                <label className="text-sm font-medium">Review<textarea required minLength={10} maxLength={4000} rows={5} className={ui.input} value={form.body} onChange={(e) => setForm((old) => ({ ...old, body: e.target.value }))} /></label>
              </>
            ) : (
              <>
                <label className="text-sm font-medium">Category<select className={ui.input} value={form.category} onChange={(e) => setForm((old) => ({ ...old, category: e.target.value }))}>{(requestedAction === 'dispute' ? disputeCategories : reportCategories).map((category) => <option key={category} value={category}>{label(category)}</option>)}</select></label>
                {requestedAction === 'report' ? <label className="text-sm font-medium">Private report description<textarea required minLength={10} maxLength={3000} rows={5} className={ui.input} value={form.description} onChange={(e) => setForm((old) => ({ ...old, description: e.target.value }))} /></label> : <label className="text-sm font-medium">Dispute summary<textarea required minLength={10} maxLength={3000} rows={5} className={ui.input} value={form.summary} onChange={(e) => setForm((old) => ({ ...old, summary: e.target.value }))} /></label>}
              </>
            )}
            <button disabled={busy || (requestedAction === 'review' && !eligibility?.eligible)} className={ui.primaryBtn}>{requestedAction === 'review' ? 'Publish review' : requestedAction === 'report' ? 'Submit private report' : 'Open professional dispute'}</button>
          </form>
        </section>
      ) : requestedAction ? <p className={ui.error} role="alert">This Trust action does not contain a valid supported interaction context.</p> : null}

      <nav className="flex flex-wrap gap-2" aria-label="Trust Center sections">{['reviews', 'reports', 'disputes'].map((value) => <button key={value} onClick={() => setTab(value)} className={tab === value ? ui.primaryBtn : ui.secondaryBtn} aria-current={tab === value ? 'page' : undefined}>{label(value)}</button>)}</nav>
      <section aria-live="polite" aria-labelledby="trust-history-heading"><h2 id="trust-history-heading" className="text-lg font-semibold">My {tab}</h2><div className="mt-3 space-y-3">{data[tab].map((item) => <article key={item._id || item.id} className={`${ui.card} p-4`}><p className="font-medium">{item.title || label(item.category) || label(item.contextType)}</p><p className={ui.muted}>Status: {label(item.status)}</p>{item.rating ? <p className="text-sm">Rating: {item.rating}/5 · Verified interaction</p> : null}{item.body ? <p className="mt-2 whitespace-pre-wrap">{item.body}</p> : null}{item.description ? <p className="mt-2 whitespace-pre-wrap">{item.description}</p> : null}{item.summary ? <p className="mt-2 whitespace-pre-wrap">{item.summary}</p> : null}</article>)}{data[tab].length === 0 ? <p className={ui.empty}>No {tab} yet.</p> : null}</div></section>
      <p className={`text-xs ${ui.muted}`}>A verified review is linked to a real STRIDETO interaction. It does not mean STRIDETO endorses every statement or guarantees future conduct.</p>
    </div>
  );
}
