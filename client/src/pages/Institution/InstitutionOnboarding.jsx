import { useEffect, useState } from 'react';
import { useInstitutionAuth } from '../../context/InstitutionAuthContext';
import { institutionPortalApi } from '../../services/institutionPortalService';
import { PageState, Panel, StatusBadge, fieldClass, humanize, primaryButton } from './InstitutionUi';

export default function InstitutionOnboarding() {
  const { organizationId } = useInstitutionAuth();
  const [data, setData] = useState(null);
  const [claim, setClaim] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ officialName: '', countryCode: '', officialDomain: '' });

  const load = () => Promise.all([institutionPortalApi.onboarding(organizationId), institutionPortalApi.claim(organizationId)])
    .then(([onboarding, claimResponse]) => { setData(onboarding.data); setClaim(claimResponse.data.claim); setError(''); })
    .catch((requestError) => setError(requestError.response?.data?.error || 'Verification status is unavailable.'))
    .finally(() => setLoading(false));

  useEffect(() => { load(); }, [organizationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const startClaim = async (event) => {
    event.preventDefault();
    if (!form.officialName.trim() || !form.countryCode.trim()) {
      setError('Official Institution name and two-letter country code are required.');
      return;
    }
    setBusy(true); setError('');
    try {
      const { data: response } = await institutionPortalApi.startClaim(organizationId, {
        proposedCanonical: { officialName: form.officialName.trim(), countryCode: form.countryCode.trim().toUpperCase(), officialDomain: form.officialDomain.trim() },
      });
      setClaim(response.claim);
    } catch (requestError) { setError(requestError.response?.data?.error || 'The canonical claim could not be started.'); }
    finally { setBusy(false); }
  };

  const submitClaim = async () => {
    setBusy(true); setError('');
    try { const response = await institutionPortalApi.submitClaim(organizationId, claim._id); setClaim(response.data.claim); }
    catch (requestError) { setError(requestError.response?.data?.error || 'The canonical claim could not be submitted.'); }
    finally { setBusy(false); }
  };

  if (loading) return <PageState>Loading verification and onboarding…</PageState>;

  return (
    <div className="space-y-6">
      <div><p className="text-sm font-semibold text-blue-700">Authority foundation</p><h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">Verification and onboarding</h1><p className="mt-2 text-sm text-slate-600">Profile completeness, organization verification, and canonical claim approval are separate states.</p></div>
      {error ? <PageState tone="error" role="alert">{error}</PageState> : null}
      {data ? <div className="flex flex-wrap gap-2"><StatusBadge label="Profile completeness" value={`${data.completenessScore}%`} /><StatusBadge label="Organization verification" value={data.verificationStatus} /><StatusBadge label="Canonical claim" value={claim?.state || data.claimState || 'not_started'} /></div> : null}
      <Panel title="Onboarding stages">
        <ul className="grid gap-3 sm:grid-cols-2">
          {(data?.stages || []).map((stage) => <li key={stage.stage} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 text-sm"><span>{humanize(stage.stage)}</span><strong className={stage.complete ? 'text-emerald-700' : 'text-amber-800'}>{stage.complete ? 'Complete' : 'Required'}</strong></li>)}
        </ul>
      </Panel>
      <Panel title="Canonical Institution claim">
        {claim ? <div className="space-y-3"><StatusBadge label="Claim state" value={claim.state} /><p className="text-sm text-slate-700">A claim does not grant authority until an Admin review reaches Approved.</p>{['draft', 'needs_information'].includes(claim.state) ? <button className={primaryButton} disabled={busy} onClick={submitClaim}>{busy ? 'Submitting…' : 'Submit claim for review'}</button> : null}</div> : (
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={startClaim}>
            <label className="text-sm font-medium text-slate-700">Official Institution name<input className={`${fieldClass} mt-1`} value={form.officialName} onChange={(event) => setForm({ ...form, officialName: event.target.value })} required /></label>
            <label className="text-sm font-medium text-slate-700">Country code<input className={`${fieldClass} mt-1`} value={form.countryCode} onChange={(event) => setForm({ ...form, countryCode: event.target.value })} maxLength={2} placeholder="GB" required /></label>
            <label className="text-sm font-medium text-slate-700 sm:col-span-2">Official domain (optional)<input className={`${fieldClass} mt-1`} value={form.officialDomain} onChange={(event) => setForm({ ...form, officialDomain: event.target.value })} placeholder="institution.example" /></label>
            <div className="sm:col-span-2"><button className={primaryButton} disabled={busy}>{busy ? 'Starting…' : 'Start canonical claim'}</button></div>
          </form>
        )}
      </Panel>
      <PageState role="note">Verification decisions remain Admin-controlled. This page cannot self-verify an organization or approve a canonical claim.</PageState>
    </div>
  );
}
