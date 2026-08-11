import { useEffect, useState } from 'react';
import { useInstitutionAuth } from '../../context/InstitutionAuthContext';
import { institutionPortalApi } from '../../services/institutionPortalService';
import { PageState, Panel, StatusBadge, fieldClass, primaryButton } from './InstitutionUi';

export default function InstitutionClaim() {
  const { organizationId } = useInstitutionAuth();
  const [claim, setClaim] = useState(null);
  const [competing, setCompeting] = useState([]);
  const [verification, setVerification] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ officialName: '', countryCode: '', officialDomain: '', canonicalInstitutionId: '', authorityEvidence: '' });

  const load = () => Promise.all([
    institutionPortalApi.claim(organizationId),
    institutionPortalApi.dashboard(organizationId),
  ]).then(([claimResponse, dash]) => {
    setClaim(claimResponse.data.claim);
    setCompeting(claimResponse.data.competingClaims || []);
    setVerification(dash.data.verificationStatus || '');
    setError('');
  }).catch((requestError) => setError(requestError.response?.data?.error || 'Claim status is unavailable.'))
    .finally(() => setLoading(false));

  useEffect(() => { load(); }, [organizationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const startClaim = async (event) => {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      const payload = form.canonicalInstitutionId.trim()
        ? { canonicalInstitutionId: form.canonicalInstitutionId.trim(), authorityEvidenceRefs: form.authorityEvidence ? [form.authorityEvidence.trim()] : [] }
        : { proposedCanonical: { officialName: form.officialName.trim(), countryCode: form.countryCode.trim().toUpperCase(), officialDomain: form.officialDomain.trim() }, authorityEvidenceRefs: form.authorityEvidence ? [form.authorityEvidence.trim()] : [] };
      const { data } = await institutionPortalApi.startClaim(organizationId, payload);
      setClaim(data.claim);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'The canonical claim could not be started.');
    } finally { setBusy(false); }
  };

  const submitClaim = async () => {
    setBusy(true); setError('');
    try {
      const response = await institutionPortalApi.submitClaim(organizationId, claim._id);
      setClaim(response.data.claim);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'The canonical claim could not be submitted.');
    } finally { setBusy(false); }
  };

  if (loading) return <PageState>Loading canonical claim…</PageState>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Canonical Institution claim</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">This answers which canonical Institution record this organization represents. It does not establish legitimacy by itself. Organization verification remains separate.</p>
      </div>
      {error ? <PageState tone="error" role="alert">{error}</PageState> : null}
      <div className="flex flex-wrap gap-2">
        <StatusBadge label="Organization verification" value={verification || 'draft'} />
        <StatusBadge label="Canonical claim" value={claim?.state || 'not_started'} />
      </div>
      {competing.length ? (
        <PageState tone="warning">Competing claim(s) exist. Manual review is required. No silent overwrite.</PageState>
      ) : null}
      <Panel title="Current claim">
        {claim ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-700 dark:text-gray-300">Candidate: {claim.proposedCanonical?.officialName || claim.normalizedName || 'Existing canonical record'}</p>
            <p className="text-sm text-gray-700 dark:text-gray-300">Country: {claim.countryCode || '—'} · Domain: {claim.officialDomain || '—'}</p>
            {claim.rejectedReason ? <p className="text-sm text-red-700 dark:text-red-300">{claim.rejectedReason}</p> : null}
            {['draft', 'needs_information'].includes(claim.state) ? (
              <button className={primaryButton} disabled={busy} onClick={submitClaim}>{busy ? 'Submitting…' : 'Submit claim for review'}</button>
            ) : null}
          </div>
        ) : (
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={startClaim}>
            <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Official Institution name<input className={`${fieldClass} mt-1`} value={form.officialName} onChange={(e) => setForm({ ...form, officialName: e.target.value })} /></label>
            <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Country code<input className={`${fieldClass} mt-1`} value={form.countryCode} onChange={(e) => setForm({ ...form, countryCode: e.target.value })} maxLength={2} placeholder="GB" /></label>
            <label className="text-sm font-medium text-gray-800 dark:text-gray-200 sm:col-span-2">Official domain<input className={`${fieldClass} mt-1`} value={form.officialDomain} onChange={(e) => setForm({ ...form, officialDomain: e.target.value })} placeholder="institution.example" /></label>
            <label className="text-sm font-medium text-gray-800 dark:text-gray-200 sm:col-span-2">Existing canonical Institution ID (optional)<input className={`${fieldClass} mt-1`} value={form.canonicalInstitutionId} onChange={(e) => setForm({ ...form, canonicalInstitutionId: e.target.value })} /></label>
            <label className="text-sm font-medium text-gray-800 dark:text-gray-200 sm:col-span-2">Representative authority evidence URL<input className={`${fieldClass} mt-1`} value={form.authorityEvidence} onChange={(e) => setForm({ ...form, authorityEvidence: e.target.value })} /></label>
            <div className="sm:col-span-2"><button className={primaryButton} disabled={busy}>{busy ? 'Starting…' : 'Start canonical claim'}</button></div>
          </form>
        )}
      </Panel>
      <PageState role="note">A claim cannot be self-approved. Competing approved claims remain in conflict for manual review.</PageState>
    </div>
  );
}
