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
  const [mode, setMode] = useState('search');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchCountry, setSearchCountry] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedInstitution, setSelectedInstitution] = useState(null);
  const [form, setForm] = useState({ officialName: '', countryCode: '', officialDomain: '', authorityEvidence: '' });

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

  useEffect(() => {
    if (mode !== 'search' || searchTerm.trim().length < 2) {
      setCandidates([]);
      return undefined;
    }
    const handle = setTimeout(() => {
      setSearching(true);
      institutionPortalApi.searchInstitutions({
        name: searchTerm.trim(),
        countryCode: searchCountry.trim() || undefined,
        limit: 10,
      })
        .then(({ data }) => setCandidates(data.results || []))
        .catch(() => setCandidates([]))
        .finally(() => setSearching(false));
    }, 350);
    return () => clearTimeout(handle);
  }, [mode, searchTerm, searchCountry]);

  const startClaim = async (event) => {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      const payload = mode === 'search' && selectedInstitution
        ? {
            canonicalInstitutionId: selectedInstitution._id,
            authorityEvidenceRefs: form.authorityEvidence ? [form.authorityEvidence.trim()] : [],
          }
        : {
            proposedCanonical: {
              officialName: form.officialName.trim(),
              countryCode: form.countryCode.trim().toUpperCase(),
              officialDomain: form.officialDomain.trim(),
            },
            authorityEvidenceRefs: form.authorityEvidence ? [form.authorityEvidence.trim()] : [],
          };
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
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Search for an existing published institution record or propose a new one. You do not need to guess database IDs.</p>
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
          <form className="grid gap-4" onSubmit={startClaim}>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={`rounded-lg px-3 py-2 text-sm ${mode === 'search' ? 'bg-primary text-white' : 'border border-gray-300 dark:border-gray-600'}`} onClick={() => setMode('search')}>
                Search existing record
              </button>
              <button type="button" className={`rounded-lg px-3 py-2 text-sm ${mode === 'propose' ? 'bg-primary text-white' : 'border border-gray-300 dark:border-gray-600'}`} onClick={() => setMode('propose')}>
                Propose new institution
              </button>
            </div>
            {mode === 'search' ? (
              <>
                <label className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  Search by institution name
                  <input className={`${fieldClass} mt-1`} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Official institution name" />
                </label>
                <label className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  Country code (optional)
                  <input className={`${fieldClass} mt-1`} value={searchCountry} onChange={(e) => setSearchCountry(e.target.value)} maxLength={2} placeholder="GB" />
                </label>
                {searching ? <p className="text-sm text-gray-500">Searching…</p> : null}
                {candidates.length > 0 ? (
                  <ul className="space-y-2 rounded-lg border border-gray-200 dark:border-gray-700 p-3" role="list">
                    {candidates.map((item) => (
                      <li key={item._id}>
                        <button
                          type="button"
                          className={`w-full text-left rounded-lg px-3 py-2 text-sm ${selectedInstitution?._id === item._id ? 'bg-primary/10 border border-primary' : 'hover:bg-gray-50 dark:hover:bg-gray-900'}`}
                          onClick={() => setSelectedInstitution(item)}
                        >
                          <span className="font-medium">{item.officialName}</span>
                          <span className="text-gray-500"> · {item.countryCode || '—'}{item.city ? ` · ${item.city}` : ''}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : searchTerm.trim().length >= 2 && !searching ? (
                  <PageState role="note">No published match found. Switch to “Propose new institution” if yours is not listed.</PageState>
                ) : null}
              </>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium text-gray-800 dark:text-gray-200 sm:col-span-2">Official Institution name<input required className={`${fieldClass} mt-1`} value={form.officialName} onChange={(e) => setForm({ ...form, officialName: e.target.value })} /></label>
                <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Country code<input required className={`${fieldClass} mt-1`} value={form.countryCode} onChange={(e) => setForm({ ...form, countryCode: e.target.value })} maxLength={2} placeholder="GB" /></label>
                <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Official domain<input className={`${fieldClass} mt-1`} value={form.officialDomain} onChange={(e) => setForm({ ...form, officialDomain: e.target.value })} placeholder="institution.example" /></label>
              </div>
            )}
            <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Representative authority evidence URL<input className={`${fieldClass} mt-1`} value={form.authorityEvidence} onChange={(e) => setForm({ ...form, authorityEvidence: e.target.value })} /></label>
            <div>
              <button className={primaryButton} disabled={busy || (mode === 'search' && !selectedInstitution)}>
                {busy ? 'Starting…' : 'Start canonical claim'}
              </button>
            </div>
          </form>
        )}
      </Panel>
      <PageState role="note">A claim cannot be self-approved. Competing approved claims remain in conflict for manual review.</PageState>
    </div>
  );
}
