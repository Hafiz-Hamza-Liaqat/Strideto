import { useEffect, useState } from 'react';
import { CountrySelect } from '../../components/forms/CountrySelect';
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
  const [correctionEvidence, setCorrectionEvidence] = useState('');

  const load = () => Promise.all([
    institutionPortalApi.claim(organizationId),
    institutionPortalApi.dashboard(organizationId),
  ]).then(([claimResponse, dash]) => {
    setClaim(claimResponse.data.claim);
    setCompeting(claimResponse.data.competingClaims || []);
    setVerification(dash.data.verificationStatus || '');
    const existingUrl = claimResponse.data.claim?.authorityEvidenceUrls?.[0] || '';
    setCorrectionEvidence(existingUrl);
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

  const switchToPropose = () => {
    setMode('propose');
    setSelectedInstitution(null);
    if (searchTerm.trim()) {
      setForm((current) => ({
        ...current,
        officialName: current.officialName || searchTerm.trim(),
        countryCode: current.countryCode || searchCountry.trim().toUpperCase(),
      }));
    }
  };

  const startClaim = async (event) => {
    event.preventDefault();
    if (mode === 'search' && !selectedInstitution) {
      setError('Select an existing canonical institution, or propose a new institution.');
      return;
    }
    if (mode === 'propose' && !form.countryCode) {
      setError('Select a country.');
      return;
    }
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
      setCorrectionEvidence(data.claim?.authorityEvidenceUrls?.[0] || form.authorityEvidence || '');
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'The canonical claim could not be started.');
    } finally { setBusy(false); }
  };

  const saveCorrection = async () => {
    if (!claim?._id) return;
    setBusy(true); setError('');
    try {
      const body = {
        authorityEvidenceRefs: correctionEvidence.trim() ? [correctionEvidence.trim()] : [],
      };
      if (!claim.canonicalInstitutionId && claim.proposedCanonical) {
        body.proposedCanonical = {
          officialName: claim.proposedCanonical.officialName || '',
          countryCode: claim.proposedCanonical.countryCode || claim.countryCode || '',
          officialDomain: claim.proposedCanonical.officialDomain || claim.officialDomain || '',
        };
      }
      const { data } = await institutionPortalApi.updateClaim(organizationId, claim._id, body);
      setClaim(data.claim);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'The claim could not be updated.');
    } finally { setBusy(false); }
  };

  const submitClaim = async () => {
    if (!claim?._id) return;
    setBusy(true); setError('');
    try {
      if (['draft', 'needs_information'].includes(claim.state) && correctionEvidence.trim()) {
        await institutionPortalApi.updateClaim(organizationId, claim._id, {
          authorityEvidenceRefs: [correctionEvidence.trim()],
        });
      }
      const response = await institutionPortalApi.submitClaim(organizationId, claim._id);
      setClaim(response.data.claim);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'The canonical claim could not be submitted.');
    } finally { setBusy(false); }
  };

  const reopenClaim = async () => {
    if (!claim?._id) return;
    setBusy(true); setError('');
    try {
      const response = await institutionPortalApi.reopenClaim(organizationId, claim._id, {
        authorityEvidenceRefs: correctionEvidence.trim() ? [correctionEvidence.trim()] : undefined,
      });
      setClaim(response.data.claim);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'The claim could not be reopened.');
    } finally { setBusy(false); }
  };

  if (loading) return <PageState>Loading canonical claim…</PageState>;

  const noSearchMatch = mode === 'search' && searchTerm.trim().length >= 2 && !searching && candidates.length === 0;
  const claimLabel = claim?.state || 'not_started';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Canonical Institution claim</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Search for an existing published institution record or propose a new one. You do not need to guess database IDs.
          A canonical claim does not establish legitimacy. Organization verification remains separate.
          Verification Approved with Canonical Claim Not Started is a valid independent state — not an error.
          A claim cannot self-approve.
        </p>
      </div>
      {error ? <PageState tone="error" role="alert">{error}</PageState> : null}
      <div className="flex flex-wrap gap-2">
        <StatusBadge label="Organization verification" value={verification || 'draft'} />
        <StatusBadge label="Canonical claim" value={claimLabel} />
      </div>
      {verification === 'approved' && !claim ? (
        <PageState role="note">
          Organization Verification is approved. Canonical Claim is not started. You still need to claim or propose the canonical institution record before admissions publishing authority is granted.
        </PageState>
      ) : null}
      {competing.length ? (
        <PageState tone="warning">Competing claim(s) exist. Manual review is required. No silent overwrite.</PageState>
      ) : null}
      <Panel title="Current claim">
        {claim ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Candidate: {claim.proposedCanonical?.officialName || claim.normalizedName || 'Existing canonical record'}
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Country: {claim.countryCode || '—'} · Domain: {claim.officialDomain || '—'}
            </p>
            {claim.state === 'approved' ? (
              <PageState role="status">
                Claim approved for this canonical institution. Organization Verification remains a separate trust gate.
              </PageState>
            ) : null}
            {claim.state === 'needs_information' && claim.informationRequestReason ? (
              <PageState tone="warning" role="status">
                More information required: {claim.informationRequestReason}
              </PageState>
            ) : null}
            {claim.state === 'rejected' && claim.rejectedReason ? (
              <PageState tone="error" role="status">
                Claim rejected: {claim.rejectedReason}
              </PageState>
            ) : null}
            {(claim.authorityEvidenceUrls || []).length ? (
              <p className="text-sm text-gray-700 dark:text-gray-300 break-all">
                Submitted evidence: {claim.authorityEvidenceUrls.join(', ')}
              </p>
            ) : null}
            {['draft', 'needs_information'].includes(claim.state) ? (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-800 dark:text-gray-200" htmlFor="institution-claim-correction-evidence">
                  Representative authority evidence URL
                  <input
                    id="institution-claim-correction-evidence"
                    type="url"
                    className={`${fieldClass} mt-1`}
                    value={correctionEvidence}
                    onChange={(e) => setCorrectionEvidence(e.target.value)}
                    placeholder="https://www.example.edu/about/governance"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={primaryButton} disabled={busy} onClick={saveCorrection}>
                    {busy ? 'Saving…' : 'Save evidence update'}
                  </button>
                  <button type="button" className={primaryButton} disabled={busy} onClick={submitClaim}>
                    {busy ? 'Submitting…' : claim.state === 'needs_information' ? 'Resubmit claim for review' : 'Submit claim for review'}
                  </button>
                </div>
              </div>
            ) : null}
            {claim.state === 'rejected' ? (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-800 dark:text-gray-200" htmlFor="institution-claim-reopen-evidence">
                  Updated authority evidence URL (optional)
                  <input
                    id="institution-claim-reopen-evidence"
                    type="url"
                    className={`${fieldClass} mt-1`}
                    value={correctionEvidence}
                    onChange={(e) => setCorrectionEvidence(e.target.value)}
                    placeholder="https://www.example.edu/about/governance"
                  />
                </label>
                <button type="button" className={primaryButton} disabled={busy} onClick={reopenClaim}>
                  {busy ? 'Reopening…' : 'Reopen claim for correction'}
                </button>
              </div>
            ) : null}
            {['submitted', 'under_review'].includes(claim.state) ? (
              <PageState role="status">Claim is with Admin for review. You cannot self-approve.</PageState>
            ) : null}
          </div>
        ) : (
          <form className="grid gap-4" onSubmit={startClaim}>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={`rounded-lg px-3 py-2 text-sm ${mode === 'search' ? 'bg-primary text-white' : 'border border-gray-300 dark:border-gray-600'}`} onClick={() => setMode('search')}>
                Search existing record
              </button>
              <button type="button" className={`rounded-lg px-3 py-2 text-sm ${mode === 'propose' ? 'bg-primary text-white' : 'border border-gray-300 dark:border-gray-600'}`} onClick={switchToPropose}>
                Propose new institution
              </button>
            </div>
            {mode === 'search' ? (
              <>
                <label className="text-sm font-medium text-gray-800 dark:text-gray-200" htmlFor="institution-claim-search-name">
                  Search by institution name
                  <input id="institution-claim-search-name" className={`${fieldClass} mt-1`} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Official institution name" />
                </label>
                <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  <label htmlFor="institution-claim-search-country">Country (optional)</label>
                  <CountrySelect
                    id="institution-claim-search-country"
                    className="mt-1"
                    allowAll
                    allLabel="All countries"
                    placeholder="Search country"
                    value={searchCountry}
                    inputClassName={fieldClass}
                    onChange={(code) => setSearchCountry(code || '')}
                  />
                </div>
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
                ) : null}
                {noSearchMatch ? (
                  <div className="space-y-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4">
                    <p className="text-sm text-amber-900 dark:text-amber-100" role="status">
                      No published match found for this search. You can propose a new institution for Admin review.
                    </p>
                    <button type="button" className={primaryButton} onClick={switchToPropose}>
                      Propose New Institution
                    </button>
                  </div>
                ) : null}
                {mode === 'search' && searchTerm.trim().length >= 2 && candidates.length > 0 && !selectedInstitution ? (
                  <PageState role="note">Select the exact canonical institution above before starting a claim.</PageState>
                ) : null}
              </>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium text-gray-800 dark:text-gray-200 sm:col-span-2" htmlFor="institution-claim-official-name">
                  Official Institution name
                  <input id="institution-claim-official-name" required className={`${fieldClass} mt-1`} value={form.officialName} onChange={(e) => setForm({ ...form, officialName: e.target.value })} placeholder="Official legal name" />
                </label>
                <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  <label htmlFor="institution-claim-country">Country</label>
                  <CountrySelect
                    id="institution-claim-country"
                    className="mt-1"
                    allowAll={false}
                    placeholder="Search country"
                    value={form.countryCode}
                    inputClassName={fieldClass}
                    onChange={(code) => setForm((current) => ({ ...current, countryCode: code || '' }))}
                  />
                </div>
                <label className="text-sm font-medium text-gray-800 dark:text-gray-200" htmlFor="institution-claim-domain">
                  Official domain
                  <input id="institution-claim-domain" className={`${fieldClass} mt-1`} value={form.officialDomain} onChange={(e) => setForm({ ...form, officialDomain: e.target.value })} placeholder="www.example.edu" />
                </label>
                <p className="sm:col-span-2 text-xs text-gray-500 dark:text-gray-400">
                  Propose-new creates a review-controlled claim. It does not auto-publish a canonical institution.
                </p>
              </div>
            )}
            <label className="text-sm font-medium text-gray-800 dark:text-gray-200" htmlFor="institution-claim-evidence">
              Representative authority evidence URL
              <input id="institution-claim-evidence" type="url" className={`${fieldClass} mt-1`} value={form.authorityEvidence} onChange={(e) => setForm({ ...form, authorityEvidence: e.target.value })} placeholder="https://www.example.edu/about/governance" />
            </label>
            <div>
              <button
                className={primaryButton}
                disabled={busy || (mode === 'search' && !selectedInstitution)}
                type="submit"
              >
                {busy ? 'Starting…' : mode === 'propose' ? 'Start propose-new claim' : 'Start canonical claim'}
              </button>
              {mode === 'search' && !selectedInstitution ? (
                <p className="mt-2 text-xs text-gray-500">
                  Start claim stays blocked until an exact search result is selected. If nothing matches, use Propose New Institution.
                </p>
              ) : null}
            </div>
          </form>
        )}
      </Panel>
      <PageState role="note">A claim cannot be self-approved. Competing approved claims remain in conflict for manual review. qa_test does not approve canonical claims.</PageState>
    </div>
  );
}
