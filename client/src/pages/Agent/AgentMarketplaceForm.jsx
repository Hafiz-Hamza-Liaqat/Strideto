import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { agentApi } from '../../services/agentService';
import { ROUTES } from '../../constants';
import { btnPrimary, cardClass, inputClass, labelClass, muted } from './agentUi';

const EMPTY = {
  postType: 'service_announcement', title: '', summary: '', contentKind: 'agent_statement', agentStatement: '',
  relatedAgentServiceId: '', targetCountries: '', destinationCountries: '', journeyCategories: '', languages: '',
  referenceType: '', referenceId: '', factualStatement: '', sourceIds: '', effectiveAt: '', endsAt: '',
};
const csv = (v, upper = false) => String(v || '').split(',').map((x) => (upper ? x.trim().toUpperCase() : x.trim())).filter(Boolean);

export default function AgentMarketplaceForm() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(!!postId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    Promise.all([agentApi.getServices(), postId ? agentApi.getMarketplacePost(postId) : Promise.resolve(null)])
      .then(([s, p]) => {
        setServices(s.data.services || []);
        if (p) {
          const x = p.data.post;
          const ref = x.canonicalReferences?.[0] || {};
          setForm({
            ...EMPTY, ...x,
            targetCountries: (x.targetCountries || []).join(', '),
            destinationCountries: (x.destinationCountries || []).join(', '),
            journeyCategories: (x.journeyCategories || []).join(', '),
            languages: (x.languages || []).join(', '),
            referenceType: ref.referenceType || '',
            referenceId: ref.referenceId || '',
            factualStatement: x.factualClaims?.[0]?.statement || '',
            sourceIds: (x.sourceIds || []).join(', '),
            effectiveAt: x.effectiveAt?.slice?.(0, 10) || '',
            endsAt: x.endsAt?.slice?.(0, 10) || '',
          });
        }
      })
      .catch((e) => setError(e.response?.data?.error || 'Unable to load form.'))
      .finally(() => setLoading(false));
  }, [postId]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    const sources = csv(form.sourceIds);
    const refs = form.referenceType && form.referenceId ? [{ referenceType: form.referenceType, referenceId: form.referenceId }] : [];
    const factual = form.contentKind === 'source_backed_fact' && form.factualStatement ? [{ claimKey: 'agent_referenced_fact', statement: form.factualStatement, sourceIds: sources }] : [];
    const body = {
      postType: form.postType, title: form.title, summary: form.summary, contentKind: form.contentKind, agentStatement: form.agentStatement,
      relatedAgentServiceId: form.relatedAgentServiceId || null, targetCountries: csv(form.targetCountries, true), destinationCountries: csv(form.destinationCountries, true),
      journeyCategories: csv(form.journeyCategories), languages: csv(form.languages), canonicalReferences: refs, factualClaims: factual, sourceIds: sources,
      effectiveAt: form.effectiveAt || null, endsAt: form.endsAt || null,
    };
    try {
      if (postId) await agentApi.updateMarketplacePost(postId, body);
      else await agentApi.createMarketplacePost(body);
      navigate(ROUTES.AGENT_MARKETPLACE);
    } catch (err) { setError(err.response?.data?.error || 'Unable to save draft.'); }
    finally { setBusy(false); }
  };
  if (loading) return <p className={muted}>Loading…</p>;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{postId ? 'Edit marketplace post' : 'Create marketplace draft'}</h1>
        <p className={`mt-1 ${muted}`}>Agent statements are never converted into official facts. Do not claim guaranteed visa, admission, scholarship, or job outcomes.</p>
      </div>
      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300" role="alert">{error}</p> : null}
      <form onSubmit={submit} className={`grid gap-4 ${cardClass} md:grid-cols-2`}>
        <label className={labelClass}>Post type<select value={form.postType} onChange={set('postType')} className={inputClass}>{['service_announcement', 'consultation_availability', 'application_support', 'scholarship_guidance', 'university_guidance', 'test_guidance', 'career_guidance', 'informational_update', 'verified_opportunity_reference', 'event_or_session', 'other'].map((v) => <option key={v} value={v}>{v.replaceAll('_', ' ')}</option>)}</select></label>
        <label className={labelClass}>Content classification<select value={form.contentKind} onChange={set('contentKind')} className={inputClass}><option value="agent_statement">Agent statement</option><option value="source_backed_fact">Official/source-backed fact reference</option></select></label>
        <label className={`${labelClass} md:col-span-2`}>Title<input required value={form.title} onChange={set('title')} className={inputClass} /></label>
        <label className={`${labelClass} md:col-span-2`}>Summary<textarea required value={form.summary} onChange={set('summary')} className={inputClass} /></label>
        <label className={`${labelClass} md:col-span-2`}>Agent/Agency statement<textarea required rows="5" value={form.agentStatement} onChange={set('agentStatement')} className={inputClass} placeholder="Describe how you can assist. Do not state guaranteed outcomes." /></label>
        <label className={labelClass}>Related active service<select value={form.relatedAgentServiceId || ''} onChange={set('relatedAgentServiceId')} className={inputClass}><option value="">None</option>{services.filter((s) => s.status === 'active').map((s) => <option key={s._id} value={s._id}>{s.title}</option>)}</select></label>
        <label className={labelClass}>Destination countries<input value={form.destinationCountries} onChange={set('destinationCountries')} className={inputClass} placeholder="GB, CA" /></label>
        <label className={labelClass}>Service countries<input value={form.targetCountries} onChange={set('targetCountries')} className={inputClass} /></label>
        <label className={labelClass}>Journey categories<input value={form.journeyCategories} onChange={set('journeyCategories')} className={inputClass} /></label>
        <label className={labelClass}>Languages<input value={form.languages} onChange={set('languages')} className={inputClass} /></label>
        <label className={labelClass}>End date<input type="date" value={form.endsAt || ''} onChange={set('endsAt')} className={inputClass} /></label>
        {form.contentKind === 'source_backed_fact' ? (
          <>
            <label className={labelClass}>Canonical reference type<select required value={form.referenceType} onChange={set('referenceType')} className={inputClass}><option value="">Select</option><option value="program">Program</option><option value="canonical_scholarship">Scholarship</option><option value="test">Test</option><option value="canonical_institution">Institution</option></select></label>
            <label className={labelClass}>Canonical record ID<input required value={form.referenceId} onChange={set('referenceId')} className={inputClass} /></label>
            <label className={`${labelClass} md:col-span-2`}>Referenced factual statement<textarea required value={form.factualStatement} onChange={set('factualStatement')} className={inputClass} /></label>
            <label className={`${labelClass} md:col-span-2`}>Canonical source IDs (comma separated)<input required value={form.sourceIds} onChange={set('sourceIds')} className={inputClass} /></label>
          </>
        ) : null}
        <button disabled={busy} className={`${btnPrimary} md:col-span-2`}>{busy ? 'Saving…' : 'Save draft'}</button>
      </form>
    </div>
  );
}
