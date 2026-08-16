import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { agentApi } from '../../services/agentService';
import { PhoneInput } from '../../components/forms/PhoneInput';
import { storedPhoneFromInput } from '@shared/international/phone.js';
import { useAgentAuth } from '../../context/AgentAuthContext';
import { AdminConfirmDialog } from '../../components/admin/AdminConfirmDialog';
import {
  applySafeDraftToProfile,
  clearVerificationDraft,
  extractSafeVerificationDraft,
  extractSensitiveVerificationSnapshot,
  readVerificationDraft,
  verificationDraftKey,
  writeVerificationDraft,
} from '../../auth/verificationDraft';

const EMPTY = {
  legalName: '', displayName: '', countryCode: '', officialEmail: '', officialWebsite: '', phone: '',
  organizationCategory: '', profession: '', registrationNumber: '', registrationAuthority: '',
  registrationCountry: '', taxIdentifier: '', licenseNumber: '', licenseIssuer: '', licenseJurisdiction: '',
  credentialType: '', officialRegistryUrl: '', governmentRegistryUrl: '', professionalRegulatorUrl: '',
  accreditationPageUrl: '', googleBusinessUrl: '',
  registeredAddress: { addressLine1: '', city: '', region: '', countryCode: '', googleMapsUrl: '' },
  authorizedRepresentative: { fullName: '', title: '', email: '', authority: '' },
};
const inputClass = 'mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 px-3 py-2';

export default function AgentVerification() {
  const navigate = useNavigate();
  const { agent } = useAgentAuth();
  const [summary, setSummary] = useState(null);
  const [details, setDetails] = useState(null);
  const [profile, setProfile] = useState(EMPTY);
  const [phoneValue, setPhoneValue] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [draftNotice, setDraftNotice] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const pendingHref = useRef(null);
  const sensitiveBaseline = useRef('');
  const skipNextDraftWrite = useRef(false);

  const accountId = agent?._id || agent?.id || '';
  const subjectType = summary?.accountType === 'agency' ? 'agency' : 'agent';
  const subjectId = summary?.organizationId || '';
  const draftKey = useMemo(() => {
    if (!accountId || !subjectId) return '';
    return verificationDraftKey({
      realm: 'agent',
      accountId,
      subjectType,
      subjectId,
    });
  }, [accountId, subjectId, subjectType]);

  const captureSensitive = (nextProfile, nextPhone) => JSON.stringify(
    extractSensitiveVerificationSnapshot(
      nextProfile,
      nextPhone,
      nextProfile.registeredAddress || {},
      nextProfile.authorizedRepresentative || {}
    )
  );

  const load = async ({ restoreDraft = true } = {}) => {
    const { data } = await agentApi.getVerification();
    setSummary(data);
    const response = await agentApi.getVerificationDetails(data.organizationId);
    setDetails(response.data);
    const existing = response.data?.profile || {};
    let next = {
      ...EMPTY,
      ...existing,
      registeredAddress: { ...EMPTY.registeredAddress, ...(existing.registeredAddress || {}) },
      authorizedRepresentative: typeof existing.authorizedRepresentative === 'object'
        ? { ...EMPTY.authorizedRepresentative, ...existing.authorizedRepresentative }
        : { ...EMPTY.authorizedRepresentative, fullName: existing.authorizedRepresentative || '' },
    };
    let restored = false;
    const key = verificationDraftKey({
      realm: 'agent',
      accountId,
      subjectType: data.accountType === 'agency' ? 'agency' : 'agent',
      subjectId: data.organizationId,
    });
    if (restoreDraft && accountId && key) {
      const draft = readVerificationDraft(key);
      const serverVersion = Number(response.data?.verificationVersion || data.verificationVersion || 0);
      if (draft && serverVersion > draft.verificationVersion) {
        clearVerificationDraft(key);
      } else if (draft) {
        next = applySafeDraftToProfile(next, draft.fields);
        restored = true;
      }
    }
    skipNextDraftWrite.current = true;
    setProfile(next);
    setPhoneValue(existing.phone || '');
    setPhoneError('');
    sensitiveBaseline.current = captureSensitive(next, existing.phone || '');
    setDraftNotice(restored);
  };

  useEffect(() => {
    load().catch((err) => setError(err.response?.data?.error || 'Unable to load verification.')).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  useEffect(() => {
    if (!draftKey || loading || skipNextDraftWrite.current) {
      skipNextDraftWrite.current = false;
      return undefined;
    }
    const timer = setTimeout(() => {
      writeVerificationDraft(draftKey, {
        verificationStatus: details?.status || summary?.verificationStatus || '',
        verificationVersion: details?.verificationVersion || summary?.verificationVersion || 0,
        fields: extractSafeVerificationDraft(profile, profile.registeredAddress || {}),
      });
      setDraftNotice(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [draftKey, loading, profile, details, summary]);

  const sensitiveDirty = captureSensitive(profile, phoneValue) !== sensitiveBaseline.current;

  useEffect(() => {
    if (!sensitiveDirty) return undefined;
    const onBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [sensitiveDirty]);

  useEffect(() => {
    if (!sensitiveDirty) return undefined;
    const onClick = (event) => {
      const anchor = event.target.closest?.('a[href]');
      if (!anchor || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      event.preventDefault();
      pendingHref.current = href;
      setLeaveOpen(true);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [sensitiveDirty]);

  const set = (key) => (event) => setProfile((current) => ({ ...current, [key]: event.target.value }));
  const canEdit = ['draft', 'email_verified', 'needs_information', 'rejected', 'expired', 'revoked'].includes(details?.status || summary?.verificationStatus);
  const isAgency = summary?.accountType === 'agency';
  const policy = summary?.credentialPolicy || details?.credentialPolicyHint || 'optional';

  const discardDraft = () => {
    if (draftKey) clearVerificationDraft(draftKey);
    setDraftNotice(false);
    load({ restoreDraft: false }).catch(() => {});
  };

  const submit = async (event) => {
    event.preventDefault();
    const stored = storedPhoneFromInput(phoneValue);
    if (stored.incomplete) {
      setPhoneError('Enter a valid phone number. Letters are not accepted.');
      return;
    }
    setBusy(true); setError(''); setMessage(''); setPhoneError('');
    try {
      const method = details?.status === 'needs_information' ? agentApi.respondToVerification : agentApi.submitVerification;
      await method(summary.organizationId, { ...profile, phone: stored.e164 });
      if (draftKey) clearVerificationDraft(draftKey);
      setDraftNotice(false);
      await load({ restoreDraft: false });
      setMessage('Verification submitted for review. Admin will review the dossier. Maps/Business cannot alone verify you.');
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to submit verification.');
    } finally { setBusy(false); }
  };

  if (loading) return <p className="text-sm text-slate-500 dark:text-gray-400">Loading verification…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Professional Verification</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">
          Submit identity, organization, and professional credential evidence for Education & Mobility review.
          Registration or license numbers alone are not proof. Maps/Business is supporting evidence only and can never alone result in VERIFIED.
        </p>
        <p className="mt-2 text-sm text-gray-800 dark:text-gray-200">
          <a href="#professional-credentials" className="text-primary underline-offset-2 hover:underline">
            Jump to professional credentials &amp; evidence
          </a>
        </p>
      </div>
      {error && <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-300 break-words" role="alert">{error}</p>}
      {message && <p className="rounded-lg bg-green-50 dark:bg-green-950/40 p-3 text-sm text-green-800 break-words" role="status">{message}</p>}
      {draftNotice && canEdit ? (
        <p className="text-xs text-slate-500 dark:text-gray-400" aria-live="polite">
          Draft saved for this browser tab. This is not a submitted verification.
        </p>
      ) : null}
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <p className="text-sm text-gray-900 dark:text-white">Status: <strong>{details?.status || summary?.verificationStatus || 'draft'}</strong></p>
        <p className="text-sm mt-1">Account type: {summary?.accountType || 'professional'} · Credential policy: {policy}</p>
        {details?.informationRequestReason && <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">Information requested: {details.informationRequestReason}</p>}
        {details?.rejectionReason && <p className="mt-2 text-sm text-red-700 dark:text-red-300">Outcome: {details.rejectionReason}</p>}
        {details?.status === 'revoked' ? (
          <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">Previous verification was revoked and remains on record. Submit a new re-verification attempt to start Attempt #{(details?.verificationVersion || 1) + 1}. Revoked badges are not current.</p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {details?.status !== 'revoked' && (details?.earnedBadges || summary?.trustBadges || []).map((badge) => (
            <span key={badge} className="rounded-full bg-green-50 dark:bg-green-950 px-2 py-1 text-xs text-green-800 dark:text-green-200">{badge.replaceAll('_', ' ')}</span>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">Self-approval is denied. AI cannot approve. {summary?.verificationSources?.manualVerificationNote}</p>
      </section>
      {canEdit && (
        <form onSubmit={submit} className="grid gap-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 md:grid-cols-2">
          <h2 className="md:col-span-2 font-semibold text-gray-900 dark:text-white">Identity</h2>
          <label className="text-sm text-gray-900 dark:text-white">{isAgency ? 'Legal entity name' : 'Legal / professional name'}<input required value={profile.legalName} onChange={set('legalName')} className={inputClass} /></label>
          <label className="text-sm text-gray-900 dark:text-white">Display name<input required value={profile.displayName} onChange={set('displayName')} className={inputClass} /></label>
          <label className="text-sm text-gray-900 dark:text-white">Country (ISO)<input required maxLength={2} value={profile.countryCode} onChange={set('countryCode')} className={inputClass} /></label>
          <label className="text-sm text-gray-900 dark:text-white">{isAgency ? 'Organization category' : 'Professional category'}<input value={profile.organizationCategory || profile.profession} onChange={set(isAgency ? 'organizationCategory' : 'profession')} className={inputClass} /></label>
          <label className="text-sm text-gray-900 dark:text-white">Official email<input required type="email" value={profile.officialEmail} onChange={set('officialEmail')} className={inputClass} /></label>
          <div className="text-sm text-gray-900 dark:text-white md:col-span-2">
            <span>Phone</span>
            <PhoneInput
              id="agent-verification-phone"
              className="mt-1"
              value={phoneValue}
              defaultCountry={profile.countryCode || ''}
              onChange={(next) => {
                setPhoneValue(next);
                setPhoneError('');
              }}
              error={Boolean(phoneError)}
            />
            {phoneError ? <p className="mt-1 text-xs text-red-600 dark:text-red-300" role="alert">{phoneError}</p> : (
              <p className="mt-1 text-xs text-slate-500">Contact evidence only. Phone is not verified and does not verify the organization.</p>
            )}
          </div>
          <label className="text-sm text-gray-900 dark:text-white md:col-span-2">Official website / domain<input required value={profile.officialWebsite} onChange={set('officialWebsite')} className={inputClass} /></label>
          <label className="text-sm text-gray-900 dark:text-white md:col-span-2">Registered address<input required value={profile.registeredAddress.addressLine1} onChange={(e) => setProfile((p) => ({ ...p, registeredAddress: { ...p.registeredAddress, addressLine1: e.target.value } }))} className={inputClass} /></label>
          <label className="text-sm text-gray-900 dark:text-white">City / region<input value={profile.registeredAddress.city} onChange={(e) => setProfile((p) => ({ ...p, registeredAddress: { ...p.registeredAddress, city: e.target.value } }))} className={inputClass} /></label>
          <h2 className="md:col-span-2 font-semibold text-gray-900 dark:text-white">Business / registration</h2>
          <label className="text-sm text-gray-900 dark:text-white">Registration jurisdiction<input value={profile.registrationCountry} onChange={set('registrationCountry')} className={inputClass} /></label>
          <label className="text-sm text-gray-900 dark:text-white">Registration authority<input value={profile.registrationAuthority} onChange={set('registrationAuthority')} className={inputClass} /></label>
          <label className="text-sm text-gray-900 dark:text-white">Registration number{isAgency && policy === 'required' ? ' (required for agencies where applicable)' : ' (optional if not applicable)'}<input value={profile.registrationNumber} onChange={set('registrationNumber')} className={inputClass} /></label>
          <label className="text-sm text-gray-900 dark:text-white">Business / tax identifier<input value={profile.taxIdentifier} onChange={set('taxIdentifier')} className={inputClass} /></label>
          <h2 id="professional-credentials" className="md:col-span-2 font-semibold text-gray-900 dark:text-white scroll-mt-24">
            Professional credentials &amp; evidence
          </h2>
          <p className="md:col-span-2 text-xs text-slate-500 dark:text-gray-400">
            Credential fields are review evidence only. Providers cannot self-mark Professional Credential Verified.
          </p>
          <label className="text-sm text-gray-900 dark:text-white">Profession / regulator<input value={profile.profession} onChange={set('profession')} className={inputClass} /></label>
          <label className="text-sm text-gray-900 dark:text-white">Credential / license type<input value={profile.credentialType} onChange={set('credentialType')} className={inputClass} /></label>
          <label className="text-sm text-gray-900 dark:text-white">Issuing authority<input value={profile.licenseIssuer} onChange={set('licenseIssuer')} className={inputClass} /></label>
          <label className="text-sm text-gray-900 dark:text-white">License number{policy === 'required' ? '' : ` (${policy})`}<input required={policy === 'required'} value={profile.licenseNumber} onChange={set('licenseNumber')} className={inputClass} /></label>
          {isAgency ? (
            <>
              <h2 className="md:col-span-2 font-semibold text-gray-900 dark:text-white">Representative</h2>
              <label className="text-sm text-gray-900 dark:text-white">Representative name<input required value={profile.authorizedRepresentative.fullName} onChange={(e) => setProfile((p) => ({ ...p, authorizedRepresentative: { ...p.authorizedRepresentative, fullName: e.target.value } }))} className={inputClass} /></label>
              <label className="text-sm text-gray-900 dark:text-white">Role / title<input value={profile.authorizedRepresentative.title} onChange={(e) => setProfile((p) => ({ ...p, authorizedRepresentative: { ...p.authorizedRepresentative, title: e.target.value } }))} className={inputClass} /></label>
            </>
          ) : (
            <label className="text-sm text-gray-900 dark:text-white md:col-span-2">Authorized representative (your name)<input required value={profile.authorizedRepresentative.fullName} onChange={(e) => setProfile((p) => ({ ...p, authorizedRepresentative: { ...p.authorizedRepresentative, fullName: e.target.value } }))} className={inputClass} /></label>
          )}
          <h2 className="md:col-span-2 font-semibold text-gray-900 dark:text-white">Supporting location (not authoritative)</h2>
          <label className="text-sm text-gray-900 dark:text-white md:col-span-2">Google Maps URL<input value={profile.registeredAddress.googleMapsUrl} onChange={(e) => setProfile((p) => ({ ...p, registeredAddress: { ...p.registeredAddress, googleMapsUrl: e.target.value } }))} className={inputClass} placeholder="https://maps.google.com/..." /></label>
          <label className="text-sm text-gray-900 dark:text-white md:col-span-2">Google Business profile URL<input value={profile.googleBusinessUrl} onChange={set('googleBusinessUrl')} className={inputClass} placeholder="https://..." /></label>
          <h2 className="md:col-span-2 font-semibold text-gray-900 dark:text-white">Official source URLs (reviewer opens manually; no scraping)</h2>
          <label className="text-sm text-gray-900 dark:text-white md:col-span-2">Official registry lookup URL<input value={profile.officialRegistryUrl} onChange={set('officialRegistryUrl')} className={inputClass} /></label>
          <label className="text-sm text-gray-900 dark:text-white md:col-span-2">Government / company registry URL<input value={profile.governmentRegistryUrl} onChange={set('governmentRegistryUrl')} className={inputClass} /></label>
          <label className="text-sm text-gray-900 dark:text-white md:col-span-2">Professional regulator URL<input value={profile.professionalRegulatorUrl} onChange={set('professionalRegulatorUrl')} className={inputClass} /></label>
          <label className="text-sm text-gray-900 dark:text-white md:col-span-2">Accreditation / licensing page URL<input value={profile.accreditationPageUrl} onChange={set('accreditationPageUrl')} className={inputClass} /></label>
          <div className="md:col-span-2 flex flex-col sm:flex-row gap-3">
            <button type="submit" disabled={busy} aria-busy={busy} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50 min-h-[44px]">{busy ? 'Submitting…' : 'Submit for verification'}</button>
            <button
              type="button"
              disabled={busy}
              onClick={discardDraft}
              className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm min-h-[44px] text-gray-800 dark:text-gray-200"
            >
              Discard draft
            </button>
          </div>
        </form>
      )}
      {(details?.evidence || []).length ? (
        <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white">Submitted evidence provenance</h2>
          {details.evidence.map((e) => (
            <p key={e._id} className="mt-2 text-sm text-gray-800 dark:text-gray-200 break-words-safe">{e.evidenceType} · {e.status} · {e.claimedAuthority || 'n/a'} · {e.sourceUrl || 'no URL'} · {e.submittedAt ? new Date(e.submittedAt).toLocaleString() : ''}</p>
          ))}
        </section>
      ) : null}
      <AdminConfirmDialog
        open={leaveOpen}
        title="You have unsaved verification changes."
        message="Sensitive fields are kept only in this page until you submit. Stay to keep them, or discard the sensitive edits and leave."
        confirmLabel="Discard changes"
        danger
        onCancel={() => {
          pendingHref.current = null;
          setLeaveOpen(false);
        }}
        onConfirm={() => {
          const href = pendingHref.current;
          pendingHref.current = null;
          setLeaveOpen(false);
          sensitiveBaseline.current = captureSensitive(profile, phoneValue);
          if (href) navigate(href);
        }}
      />
    </div>
  );
}
