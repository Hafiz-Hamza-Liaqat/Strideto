import { useEffect, useState } from 'react';
import { INSTITUTION_TYPES } from '@shared/education/taxonomy.js';
import { CountrySelect } from '../../components/forms/CountrySelect';
import { PhoneInput } from '../../components/forms/PhoneInput';
import { DateInput } from '../../components/forms/NativeTemporalInput';
import { useInstitutionAuth } from '../../context/InstitutionAuthContext';
import { institutionPortalApi } from '../../services/institutionPortalService';
import { PageState, Panel, StatusBadge, fieldClass, primaryButton } from './InstitutionUi';

const OTHER_ORG_TYPE = INSTITUTION_TYPES.OTHER;
const OTHER_ORG_TYPE_PREFIX = /^Other:\s*(.+)$/i;
const ORG_TYPE_OPTIONS = Object.values(INSTITUTION_TYPES);
const TYPE_LABELS = Object.freeze({
  university: 'University',
  college: 'College',
  institute: 'Institute',
  school: 'School',
  training_center: 'Training center',
  other: 'Other',
});

function parseOrganizationType(raw) {
  const value = (raw || '').trim();
  if (!value) return { organizationCategory: '', organizationTypeOther: '' };
  const otherMatch = value.match(OTHER_ORG_TYPE_PREFIX);
  if (otherMatch) return { organizationCategory: OTHER_ORG_TYPE, organizationTypeOther: otherMatch[1].trim() };
  if (value === OTHER_ORG_TYPE) return { organizationCategory: OTHER_ORG_TYPE, organizationTypeOther: '' };
  if (Object.values(INSTITUTION_TYPES).includes(value)) return { organizationCategory: value, organizationTypeOther: '' };
  return { organizationCategory: OTHER_ORG_TYPE, organizationTypeOther: value };
}

function serializeOrganizationType(organizationCategory, organizationTypeOther) {
  if (organizationCategory === OTHER_ORG_TYPE) {
    return `Other: ${(organizationTypeOther || '').trim()}`;
  }
  return organizationCategory;
}

const EMPTY = {
  legalName: '', displayName: '', organizationCategory: '', organizationTypeOther: '', countryCode: '',
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
  const [phoneValue, setPhoneValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    const { data } = await institutionPortalApi.getVerification(organizationId);
    setDetails(data);
    const existing = data.profile || {};
    const orgType = parseOrganizationType(existing.organizationCategory);
    setProfile({
      ...EMPTY,
      ...existing,
      ...orgType,
      registeredAddress: { ...EMPTY.registeredAddress, ...(existing.registeredAddress || {}) },
      authorizedRepresentative: typeof existing.authorizedRepresentative === 'object'
        ? { ...EMPTY.authorizedRepresentative, ...existing.authorizedRepresentative }
        : { ...EMPTY.authorizedRepresentative, fullName: existing.authorizedRepresentative || '', title: existing.representativeRole || '' },
      licenseIssuedAt: existing.licenseIssuedAt ? String(existing.licenseIssuedAt).slice(0, 10) : '',
      licenseExpiresAt: existing.licenseExpiresAt ? String(existing.licenseExpiresAt).slice(0, 10) : '',
    });
    setPhoneValue(existing.phone || '');
  };

  useEffect(() => {
    load().catch((err) => setError(err.response?.data?.error || 'Unable to load verification.')).finally(() => setLoading(false));
  }, [organizationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (key) => (event) => setProfile((current) => ({ ...current, [key]: event.target.value }));
  const canEdit = ['draft', 'email_verified', 'needs_information', 'rejected', 'expired', 'revoked'].includes(details?.status);

  const submit = async (event) => {
    event.preventDefault();
    if (!profile.countryCode) {
      setError('Select a country.');
      return;
    }
    if (profile.organizationCategory === OTHER_ORG_TYPE && !profile.organizationTypeOther?.trim()) {
      setError('Please specify your organization type.');
      document.getElementById('institution-verification-org-type-other')?.focus();
      return;
    }
    if (profile.licenseIssuedAt && profile.licenseExpiresAt && profile.licenseExpiresAt <= profile.licenseIssuedAt) {
      setError('Expiry date must be after the issue date.');
      document.getElementById('institution-verification-expiry-date')?.focus();
      return;
    }
    const phone = typeof phoneValue === 'object'
      ? (phoneValue.e164 || '')
      : String(phoneValue || '');
    setBusy(true); setError(''); setMessage('');
    try {
      const method = details?.status === 'needs_information' ? institutionPortalApi.respondToVerification : institutionPortalApi.submitVerification;
      await method(organizationId, {
        ...profile,
        organizationCategory: serializeOrganizationType(profile.organizationCategory, profile.organizationTypeOther),
        phone,
        registeredAddress: {
          ...profile.registeredAddress,
          countryCode: profile.registeredAddress.countryCode || profile.countryCode,
        },
      });
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
        {details?.status === 'revoked' ? (
          <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">Previous verification was revoked and remains on record. Request re-verification to start a new attempt. Revoked badges are not current.</p>
        ) : null}
        {details?.informationRequestReason ? <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">Information requested: {details.informationRequestReason}</p> : null}
        {details?.rejectionReason ? <p className="mt-2 text-sm text-red-700 dark:text-red-300">Outcome: {details.rejectionReason}</p> : null}
        <p className="mt-3 text-xs text-gray-500">Self-approval is denied. You cannot set status, verifiedBy, or verifiedAt.</p>
      </Panel>
      {canEdit ? (
        <form onSubmit={submit} className="grid gap-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 md:grid-cols-2">
          <h2 className="md:col-span-2 font-semibold text-gray-900 dark:text-white">Identity</h2>
          <label className="text-sm text-gray-900 dark:text-white" htmlFor="institution-verification-legal-name">
            Legal name
            <input id="institution-verification-legal-name" required value={profile.legalName} onChange={set('legalName')} className={fieldClass} placeholder="Registered legal name" />
          </label>
          <label className="text-sm text-gray-900 dark:text-white" htmlFor="institution-verification-display-name">
            Display name
            <input id="institution-verification-display-name" required value={profile.displayName} onChange={set('displayName')} className={fieldClass} placeholder="Public display name" />
          </label>
          <label className="text-sm text-gray-900 dark:text-white" htmlFor="institution-verification-org-type">
            Organization type
            <select
              id="institution-verification-org-type"
              value={profile.organizationCategory}
              onChange={(event) => {
                const nextType = event.target.value;
                setProfile((current) => ({
                  ...current,
                  organizationCategory: nextType,
                  organizationTypeOther: nextType === OTHER_ORG_TYPE ? current.organizationTypeOther : '',
                }));
              }}
              className={fieldClass}
            >
              <option value="">Select type</option>
              {ORG_TYPE_OPTIONS.map((type) => (
                <option key={type} value={type}>{TYPE_LABELS[type] || type.replaceAll('_', ' ')}</option>
              ))}
            </select>
          </label>
          <div className={profile.organizationCategory === OTHER_ORG_TYPE ? '' : 'hidden'}>
            <label className="text-sm text-gray-900 dark:text-white" htmlFor="institution-verification-org-type-other">
              Specify organization type
              <input
                id="institution-verification-org-type-other"
                value={profile.organizationTypeOther}
                onChange={set('organizationTypeOther')}
                className={fieldClass}
                placeholder="e.g. vocational academy"
              />
            </label>
          </div>
          <div className="text-sm text-gray-900 dark:text-white">
            <label htmlFor="institution-verification-country">Country</label>
            <CountrySelect
              id="institution-verification-country"
              className="mt-1"
              allowAll={false}
              placeholder="Search country"
              value={profile.countryCode}
              inputClassName={fieldClass}
              onChange={(code) => setProfile((current) => ({
                ...current,
                countryCode: code || '',
                registeredAddress: { ...current.registeredAddress, countryCode: code || '' },
              }))}
            />
          </div>
          <label className="text-sm text-gray-900 dark:text-white" htmlFor="institution-verification-email">
            Official email
            <input id="institution-verification-email" required type="email" value={profile.officialEmail} onChange={set('officialEmail')} className={fieldClass} placeholder="admissions@example.edu" autoComplete="email" />
          </label>
          <div className="text-sm text-gray-900 dark:text-white">
            <span>Phone</span>
            <PhoneInput
              id="institution-verification-phone"
              className="mt-1"
              value={phoneValue}
              defaultCountry={profile.countryCode || ''}
              onChange={setPhoneValue}
            />
          </div>
          <label className="text-sm text-gray-900 dark:text-white md:col-span-2" htmlFor="institution-verification-website">
            Official website
            <input id="institution-verification-website" required type="url" value={profile.officialWebsite} onChange={set('officialWebsite')} className={fieldClass} placeholder="https://www.example.edu" />
          </label>
          <label className="text-sm text-gray-900 dark:text-white" htmlFor="institution-verification-domain">
            Official domain
            <input id="institution-verification-domain" value={profile.officialDomain} onChange={set('officialDomain')} className={fieldClass} placeholder="www.example.edu" />
          </label>
          <label className="text-sm text-gray-900 dark:text-white md:col-span-2" htmlFor="institution-verification-logo">
            Logo URL
            <input id="institution-verification-logo" type="url" value={profile.logoUrl} onChange={set('logoUrl')} className={fieldClass} placeholder="https://www.example.edu/logo.png" />
          </label>
          <label className="text-sm text-gray-900 dark:text-white md:col-span-2" htmlFor="institution-verification-address">
            Registered address
            <input id="institution-verification-address" required value={profile.registeredAddress.addressLine1} onChange={(e) => setProfile((p) => ({ ...p, registeredAddress: { ...p.registeredAddress, addressLine1: e.target.value } }))} className={fieldClass} placeholder="Street address" />
          </label>
          <label className="text-sm text-gray-900 dark:text-white" htmlFor="institution-verification-city">
            City
            <input id="institution-verification-city" value={profile.registeredAddress.city} onChange={(e) => setProfile((p) => ({ ...p, registeredAddress: { ...p.registeredAddress, city: e.target.value } }))} className={fieldClass} placeholder="City" />
          </label>
          <label className="text-sm text-gray-900 dark:text-white" htmlFor="institution-verification-region">
            Region
            <input id="institution-verification-region" value={profile.registeredAddress.region} onChange={(e) => setProfile((p) => ({ ...p, registeredAddress: { ...p.registeredAddress, region: e.target.value } }))} className={fieldClass} placeholder="State, province, or region" />
          </label>
          <h2 className="md:col-span-2 font-semibold text-gray-900 dark:text-white">Registration / regulatory</h2>
          <label className="text-sm text-gray-900 dark:text-white" htmlFor="institution-verification-reg-authority">
            Registration authority
            <input id="institution-verification-reg-authority" value={profile.registrationAuthority} onChange={set('registrationAuthority')} className={fieldClass} placeholder="Issuing authority name" />
          </label>
          <div>
            <label className="text-sm text-gray-900 dark:text-white" htmlFor="institution-verification-reg-number">
              Registration number
              <input id="institution-verification-reg-number" value={profile.registrationNumber} onChange={set('registrationNumber')} className={fieldClass} placeholder="Registration or licence number" />
            </label>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Enter the number issued by the listed authority</p>
          </div>
          <label className="text-sm text-gray-900 dark:text-white" htmlFor="institution-verification-accred-body">
            Accreditation authority
            <input id="institution-verification-accred-body" value={profile.accreditationBody} onChange={set('accreditationBody')} className={fieldClass} placeholder="Accreditation body name" />
          </label>
          <label className="text-sm text-gray-900 dark:text-white" htmlFor="institution-verification-accred-number">
            Accreditation / license identifier
            <input id="institution-verification-accred-number" value={profile.accreditationNumber || profile.licenseNumber} onChange={set('accreditationNumber')} className={fieldClass} placeholder="Accreditation or licence ID" />
          </label>
          <label className="text-sm text-gray-900 dark:text-white" htmlFor="institution-verification-jurisdiction">
            Jurisdiction
            <input id="institution-verification-jurisdiction" value={profile.licenseJurisdiction || profile.registrationCountry} onChange={set('licenseJurisdiction')} className={fieldClass} placeholder="Licensing jurisdiction" />
          </label>
          <label className="text-sm text-gray-900 dark:text-white" htmlFor="institution-verification-credential-policy">
            Credential policy
            <select id="institution-verification-credential-policy" value={profile.credentialPolicy} onChange={set('credentialPolicy')} className={fieldClass}>
              <option value="required">Required</option>
              <option value="optional">Optional</option>
              <option value="not_applicable">Not applicable</option>
            </select>
          </label>
          <label className="text-sm text-gray-900 dark:text-white" htmlFor="institution-verification-issue-date">
            Issue date
            <DateInput id="institution-verification-issue-date" value={profile.licenseIssuedAt || ''} onChange={set('licenseIssuedAt')} className={fieldClass} />
          </label>
          <label className="text-sm text-gray-900 dark:text-white" htmlFor="institution-verification-expiry-date">
            Expiry date
            <DateInput id="institution-verification-expiry-date" value={profile.licenseExpiresAt || ''} onChange={set('licenseExpiresAt')} className={fieldClass} />
          </label>
          <h2 className="md:col-span-2 font-semibold text-gray-900 dark:text-white">Representative</h2>
          <label className="text-sm text-gray-900 dark:text-white" htmlFor="institution-verification-rep-name">
            Representative name
            <input id="institution-verification-rep-name" required value={profile.authorizedRepresentative.fullName} onChange={(e) => setProfile((p) => ({ ...p, authorizedRepresentative: { ...p.authorizedRepresentative, fullName: e.target.value } }))} className={fieldClass} placeholder="Full name" autoComplete="name" />
          </label>
          <label className="text-sm text-gray-900 dark:text-white" htmlFor="institution-verification-rep-title">
            Role / title
            <input id="institution-verification-rep-title" value={profile.authorizedRepresentative.title} onChange={(e) => setProfile((p) => ({ ...p, authorizedRepresentative: { ...p.authorizedRepresentative, title: e.target.value } }))} className={fieldClass} placeholder="Registrar, director, or authorised officer" />
          </label>
          <label className="text-sm text-gray-900 dark:text-white md:col-span-2" htmlFor="institution-verification-identity-url">
            Identity evidence URL
            <input id="institution-verification-identity-url" type="url" value={profile.identityEvidenceUrl} onChange={set('identityEvidenceUrl')} className={fieldClass} placeholder="https://www.example.edu/about/identity" />
          </label>
          <label className="text-sm text-gray-900 dark:text-white md:col-span-2" htmlFor="institution-verification-authority-url">
            Authority evidence URL
            <input id="institution-verification-authority-url" type="url" value={profile.authorityEvidenceUrl} onChange={set('authorityEvidenceUrl')} className={fieldClass} placeholder="https://www.example.edu/about/governance" />
          </label>
          <label className="text-sm text-gray-900 dark:text-white md:col-span-2" htmlFor="institution-verification-campus-url">
            Campus / location evidence URL
            <input id="institution-verification-campus-url" type="url" value={profile.campusEvidenceUrl} onChange={set('campusEvidenceUrl')} className={fieldClass} placeholder="https://www.example.edu/campus" />
          </label>
          <h2 className="md:col-span-2 font-semibold text-gray-900 dark:text-white">Location (supporting only)</h2>
          <label className="text-sm text-gray-900 dark:text-white md:col-span-2" htmlFor="institution-verification-maps-url">
            Google Maps URL
            <input id="institution-verification-maps-url" type="url" value={profile.registeredAddress.googleMapsUrl} onChange={(e) => setProfile((p) => ({ ...p, registeredAddress: { ...p.registeredAddress, googleMapsUrl: e.target.value } }))} className={fieldClass} placeholder="https://maps.google.com/..." />
          </label>
          <label className="text-sm text-gray-900 dark:text-white md:col-span-2" htmlFor="institution-verification-gmb-url">
            Google Business URL
            <input id="institution-verification-gmb-url" type="url" value={profile.googleBusinessUrl} onChange={set('googleBusinessUrl')} className={fieldClass} placeholder="https://www.google.com/maps?cid=" />
          </label>
          <p className="md:col-span-2 text-xs text-gray-500">Maps/Business is supporting evidence only and can never alone result in VERIFIED. No live scraping.</p>
          <h2 className="md:col-span-2 font-semibold text-gray-900 dark:text-white">Official sources (reviewer opens manually)</h2>
          <label className="text-sm text-gray-900 dark:text-white md:col-span-2" htmlFor="institution-verification-registry-url">
            Official registry URL
            <input id="institution-verification-registry-url" type="url" value={profile.officialRegistryUrl} onChange={set('officialRegistryUrl')} className={fieldClass} placeholder="https://www.example.edu" />
          </label>
          <label className="text-sm text-gray-900 dark:text-white md:col-span-2" htmlFor="institution-verification-gov-url">
            Government / education authority URL
            <input id="institution-verification-gov-url" type="url" value={profile.governmentRegistryUrl} onChange={set('governmentRegistryUrl')} className={fieldClass} placeholder="https://www.example.gov/education" />
          </label>
          <label className="text-sm text-gray-900 dark:text-white md:col-span-2" htmlFor="institution-verification-accred-url">
            Accreditation body URL
            <input id="institution-verification-accred-url" type="url" value={profile.accreditationPageUrl} onChange={set('accreditationPageUrl')} className={fieldClass} placeholder="https://www.example.edu/accreditation" />
          </label>
          <button disabled={busy} className={`${primaryButton} md:col-span-2`}>{busy ? 'Submitting…' : details?.status === 'needs_information' ? 'Resubmit' : 'Submit for verification'}</button>
        </form>
      ) : <PageState>This dossier is locked while status is {details?.status}. You cannot self-approve.</PageState>}
      {details?.evidence?.length > 0 ? (
        <Panel>
          <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Submitted evidence</h2>
          <ul className="space-y-2">
            {details.evidence.map((ev) => (
              <li key={ev.id} className="text-xs border border-gray-200 dark:border-gray-700 rounded p-2 space-y-1">
                <div className="flex justify-between">
                  <span className="font-medium text-gray-900 dark:text-white">{ev.evidenceType}</span>
                  <span className={ev.status === 'rejected' ? 'text-red-600' : ev.status === 'approved' ? 'text-green-600' : 'text-amber-600'}>{ev.status}</span>
                </div>
                {ev.sourceUrl ? <div className="text-gray-500 truncate">{ev.sourceUrl}</div> : null}
                {ev.rejectionReason ? (
                  <p className="text-red-700 dark:text-red-300">Admin feedback: {ev.rejectionReason}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
