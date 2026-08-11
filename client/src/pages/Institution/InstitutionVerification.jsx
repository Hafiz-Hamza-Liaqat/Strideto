import { useEffect, useState } from 'react';
import { useInstitutionAuth } from '../../context/InstitutionAuthContext';
import { institutionPortalApi } from '../../services/institutionPortalService';
import { PageState, Panel, StatusBadge, fieldClass, primaryButton } from './InstitutionUi';

const EMPTY = {
  legalName: '', displayName: '', organizationCategory: '', countryCode: '',
  officialEmail: '', officialWebsite: '', officialDomain: '', phone: '', logoUrl: '',
  registrationAuthority: '', registrationNumber: '', registrationCountry: '',
  accreditationBody: '', accreditationNumber: '', licenseNumber: '', licenseIssuer: '',
  licenseJurisdiction: '', licenseIssuedAt: '', licenseExpiresAt: '', credentialPolicy: 'optional',
  officialRegistryUrl: '', governmentRegistryUrl: '', accreditationPageUrl: '',
  googleBusinessUrl: '', identityEvidenceUrl: '', authorityEvidenceUrl: '', campusEvidenceUrl: '',
  registeredAddress: { addressLine1: '', city: '', region: '', countryCode: '', googleMapsUrl: '' },
  authorizedRepresentative: { fullName: '', title: '', email: '', authority: '' },
};

export default function InstitutionVerification() {
  const { organizationId } = useInstitutionAuth();
  const [details, setDetails] = useState(null);
  const [profile, setProfile] = useState(EMPTY);
  const [policy, setPolicy] = useState('optional');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    const { data } = await institutionPortalApi.getVerification(organizationId);
    setDetails(data);
    const existing = data.profile || {};
    setProfile({
      ...EMPTY,
      ...existing,
      registeredAddress: { ...EMPTY.registeredAddress, ...(existing.registeredAddress || {}) },
      authorizedRepresentative: typeof existing.authorizedRepresentative === 'object'
        ? { ...EMPTY.authorizedRepresentative, ...existing.authorizedRepresentative }
        : { ...EMPTY.authorizedRepresentative, fullName: existing.authorizedRepresentative || '', title: existing.representativeRole || '' },
      licenseIssuedAt: existing.licenseIssuedAt ? String(existing.licenseIssuedAt).slice(0, 10) : '',
      licenseExpiresAt: existing.licenseExpiresAt ? String(existing.licenseExpiresAt).slice(0, 10) : '',
    });
    try {
      const pol = await institutionPortalApi.getCredentialPolicy(organizationId);
      setPolicy(pol.data.credentialPolicy || data.credentialPolicyHint || 'optional');
    } catch { setPolicy(data.credentialPolicyHint || 'optional'); }
  };

  useEffect(() => {
    load().catch((err) => setError(err.response?.data?.error || 'Unable to load verification.')).finally(() => setLoading(false));
  }, [organizationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (key) => (event) => setProfile((current) => ({ ...current, [key]: event.target.value }));
  const canEdit = ['draft', 'email_verified', 'needs_information', 'rejected', 'expired'].includes(details?.status);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true); setError(''); setMessage('');
    try {
      const method = details?.status === 'needs_information' ? institutionPortalApi.respondToVerification : institutionPortalApi.submitVerification;
      await method(organizationId, profile);
      await load();
      setMessage('Verification submitted for Admin review. Maps/Business cannot alone verify this Institution. AI cannot approve.');
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to submit verification.');
    } finally { setBusy(false); }
  };

  if (loading) return <PageState>Loading verification dossier…</PageState>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Organization verification</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">This is not a canonical Institution claim. Registration numbers and Maps URLs are supporting evidence only.</p>
      </div>
      {error ? <PageState tone="error" role="alert">{error}</PageState> : null}
      {message ? <PageState tone="success">{message}</PageState> : null}
      <Panel>
        <StatusBadge label="Organization verification" value={details?.status || 'draft'} />
        <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">Credential policy: {policy}</p>
        {details?.informationRequestReason ? <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">Information requested: {details.informationRequestReason}</p> : null}
        {details?.rejectionReason ? <p className="mt-2 text-sm text-red-700 dark:text-red-300">Outcome: {details.rejectionReason}</p> : null}
        <p className="mt-3 text-xs text-gray-500">Self-approval is denied. You cannot set status, verifiedBy, or verifiedAt.</p>
      </Panel>
      {canEdit ? (
        <form onSubmit={submit} className="grid gap-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 md:grid-cols-2">
          <h2 className="md:col-span-2 font-semibold text-gray-900 dark:text-white">Identity</h2>
          <label className="text-sm text-gray-900 dark:text-white">Legal name<input required value={profile.legalName} onChange={set('legalName')} className={fieldClass} /></label>
          <label className="text-sm text-gray-900 dark:text-white">Display name<input required value={profile.displayName} onChange={set('displayName')} className={fieldClass} /></label>
          <label className="text-sm text-gray-900 dark:text-white">Organization type<input value={profile.organizationCategory} onChange={set('organizationCategory')} className={fieldClass} /></label>
          <label className="text-sm text-gray-900 dark:text-white">Country (ISO)<input required maxLength={2} value={profile.countryCode} onChange={set('countryCode')} className={fieldClass} /></label>
          <label className="text-sm text-gray-900 dark:text-white">Official email<input required type="email" value={profile.officialEmail} onChange={set('officialEmail')} className={fieldClass} /></label>
          <label className="text-sm text-gray-900 dark:text-white">Phone<input value={profile.phone} onChange={set('phone')} className={fieldClass} /></label>
          <label className="text-sm text-gray-900 dark:text-white md:col-span-2">Official website<input required value={profile.officialWebsite} onChange={set('officialWebsite')} className={fieldClass} /></label>
          <label className="text-sm text-gray-900 dark:text-white">Official domain<input value={profile.officialDomain} onChange={set('officialDomain')} className={fieldClass} /></label>
          <label className="text-sm text-gray-900 dark:text-white md:col-span-2">Logo URL<input value={profile.logoUrl} onChange={set('logoUrl')} className={fieldClass} /></label>
          <label className="text-sm text-gray-900 dark:text-white md:col-span-2">Registered address<input required value={profile.registeredAddress.addressLine1} onChange={(e) => setProfile((p) => ({ ...p, registeredAddress: { ...p.registeredAddress, addressLine1: e.target.value } }))} className={fieldClass} /></label>
          <label className="text-sm text-gray-900 dark:text-white">City<input value={profile.registeredAddress.city} onChange={(e) => setProfile((p) => ({ ...p, registeredAddress: { ...p.registeredAddress, city: e.target.value } }))} className={fieldClass} /></label>
          <label className="text-sm text-gray-900 dark:text-white">Region<input value={profile.registeredAddress.region} onChange={(e) => setProfile((p) => ({ ...p, registeredAddress: { ...p.registeredAddress, region: e.target.value } }))} className={fieldClass} /></label>
          <h2 className="md:col-span-2 font-semibold text-gray-900 dark:text-white">Registration / regulatory</h2>
          <label className="text-sm text-gray-900 dark:text-white">Registration authority<input value={profile.registrationAuthority} onChange={set('registrationAuthority')} className={fieldClass} /></label>
          <label className="text-sm text-gray-900 dark:text-white">Registration number<input value={profile.registrationNumber} onChange={set('registrationNumber')} className={fieldClass} /></label>
          <label className="text-sm text-gray-900 dark:text-white">Accreditation authority<input value={profile.accreditationBody} onChange={set('accreditationBody')} className={fieldClass} /></label>
          <label className="text-sm text-gray-900 dark:text-white">Accreditation / license identifier<input value={profile.accreditationNumber || profile.licenseNumber} onChange={set('accreditationNumber')} className={fieldClass} /></label>
          <label className="text-sm text-gray-900 dark:text-white">Jurisdiction<input value={profile.licenseJurisdiction || profile.registrationCountry} onChange={set('licenseJurisdiction')} className={fieldClass} /></label>
          <label className="text-sm text-gray-900 dark:text-white">Credential policy<select value={profile.credentialPolicy} onChange={set('credentialPolicy')} className={fieldClass}><option value="required">required</option><option value="optional">optional</option><option value="not_applicable">not_applicable</option></select></label>
          <label className="text-sm text-gray-900 dark:text-white">Issue date<input type="date" value={profile.licenseIssuedAt || ''} onChange={set('licenseIssuedAt')} className={fieldClass} /></label>
          <label className="text-sm text-gray-900 dark:text-white">Expiry date<input type="date" value={profile.licenseExpiresAt || ''} onChange={set('licenseExpiresAt')} className={fieldClass} /></label>
          <h2 className="md:col-span-2 font-semibold text-gray-900 dark:text-white">Representative</h2>
          <label className="text-sm text-gray-900 dark:text-white">Representative name<input required value={profile.authorizedRepresentative.fullName} onChange={(e) => setProfile((p) => ({ ...p, authorizedRepresentative: { ...p.authorizedRepresentative, fullName: e.target.value } }))} className={fieldClass} /></label>
          <label className="text-sm text-gray-900 dark:text-white">Role / title<input value={profile.authorizedRepresentative.title} onChange={(e) => setProfile((p) => ({ ...p, authorizedRepresentative: { ...p.authorizedRepresentative, title: e.target.value } }))} className={fieldClass} /></label>
          <label className="text-sm text-gray-900 dark:text-white md:col-span-2">Identity evidence URL<input value={profile.identityEvidenceUrl} onChange={set('identityEvidenceUrl')} className={fieldClass} /></label>
          <label className="text-sm text-gray-900 dark:text-white md:col-span-2">Authority evidence URL<input value={profile.authorityEvidenceUrl} onChange={set('authorityEvidenceUrl')} className={fieldClass} /></label>
          <label className="text-sm text-gray-900 dark:text-white md:col-span-2">Campus / location evidence URL<input value={profile.campusEvidenceUrl} onChange={set('campusEvidenceUrl')} className={fieldClass} /></label>
          <h2 className="md:col-span-2 font-semibold text-gray-900 dark:text-white">Location (supporting only)</h2>
          <label className="text-sm text-gray-900 dark:text-white md:col-span-2">Google Maps URL<input value={profile.registeredAddress.googleMapsUrl} onChange={(e) => setProfile((p) => ({ ...p, registeredAddress: { ...p.registeredAddress, googleMapsUrl: e.target.value } }))} className={fieldClass} placeholder="https://maps.google.com/..." /></label>
          <label className="text-sm text-gray-900 dark:text-white md:col-span-2">Google Business URL<input value={profile.googleBusinessUrl} onChange={set('googleBusinessUrl')} className={fieldClass} placeholder="https://..." /></label>
          <p className="md:col-span-2 text-xs text-gray-500">Maps/Business is supporting evidence only and can never alone result in VERIFIED. No live scraping.</p>
          <h2 className="md:col-span-2 font-semibold text-gray-900 dark:text-white">Official sources (reviewer opens manually)</h2>
          <label className="text-sm text-gray-900 dark:text-white md:col-span-2">Official registry URL<input value={profile.officialRegistryUrl} onChange={set('officialRegistryUrl')} className={fieldClass} /></label>
          <label className="text-sm text-gray-900 dark:text-white md:col-span-2">Government / education authority URL<input value={profile.governmentRegistryUrl} onChange={set('governmentRegistryUrl')} className={fieldClass} /></label>
          <label className="text-sm text-gray-900 dark:text-white md:col-span-2">Accreditation body URL<input value={profile.accreditationPageUrl} onChange={set('accreditationPageUrl')} className={fieldClass} /></label>
          <button disabled={busy} className={`${primaryButton} md:col-span-2`}>{busy ? 'Submitting…' : details?.status === 'needs_information' ? 'Resubmit' : 'Submit for verification'}</button>
        </form>
      ) : <PageState>This dossier is locked while status is {details?.status}. You cannot self-approve.</PageState>}
    </div>
  );
}
