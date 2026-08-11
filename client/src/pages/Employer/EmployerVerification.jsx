import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { employerApi } from '../../services/employerService';
import { useEmployerAuth } from '../../context/EmployerAuthContext';

const EMPTY = {
  legalName: '',
  displayName: '',
  organizationType: 'employer',
  countryCode: '',
  officialEmail: '',
  officialPhone: '',
  officialWebsite: '',
  registrationAuthority: '',
  registrationNumber: '',
  licenseNumber: '',
  googleMapsUrl: '',
  registeredAddress: { addressLine1: '', city: '', region: '', countryCode: '' },
  authorizedRepresentative: { fullName: '', title: '', email: '', authority: '' },
};

function hydrateProfile(saved) {
  if (!saved || typeof saved !== 'object') return EMPTY;
  const rep = saved.authorizedRepresentative;
  return {
    ...EMPTY,
    legalName: saved.legalName || '',
    displayName: saved.displayName || '',
    organizationType: saved.organizationType || 'employer',
    countryCode: saved.countryCode || '',
    officialEmail: saved.officialEmail || '',
    officialPhone: saved.phone || saved.officialPhone || '',
    officialWebsite: saved.officialWebsite || '',
    registrationAuthority: saved.registrationAuthority || '',
    registrationNumber: saved.registrationNumber || '',
    licenseNumber: saved.licenseNumber || '',
    googleMapsUrl: saved.registeredAddress?.googleMapsUrl || saved.googleMapsUrl || '',
    registeredAddress: {
      addressLine1: saved.registeredAddress?.addressLine1 || '',
      city: saved.registeredAddress?.city || '',
      region: saved.registeredAddress?.region || '',
      countryCode: saved.registeredAddress?.countryCode || saved.countryCode || '',
    },
    authorizedRepresentative: typeof rep === 'object' && rep
      ? {
          fullName: rep.fullName || '',
          title: rep.title || saved.representativeRole || '',
          email: rep.email || '',
          authority: rep.authority || saved.representativeAuthorizationRef || '',
        }
      : {
          fullName: typeof rep === 'string' ? rep : '',
          title: saved.representativeRole || '',
          email: '',
          authority: saved.representativeAuthorizationRef || '',
        },
  };
}

function toSubmitProfile(p) {
  const rep = p.authorizedRepresentative || {};
  return {
    legalName: p.legalName,
    displayName: p.displayName,
    organizationType: p.organizationType || 'employer',
    countryCode: p.countryCode,
    officialEmail: p.officialEmail,
    phone: p.officialPhone || p.phone || '',
    officialWebsite: p.officialWebsite,
    registrationAuthority: p.registrationAuthority,
    registrationNumber: p.registrationNumber,
    licenseNumber: p.licenseNumber,
    registeredAddress: {
      ...p.registeredAddress,
      googleMapsUrl: p.googleMapsUrl || '',
      countryCode: p.registeredAddress?.countryCode || p.countryCode,
    },
    authorizedRepresentative: typeof rep === 'object' ? (rep.fullName || '') : (rep || ''),
    representativeRole: typeof rep === 'object' ? (rep.title || '') : (p.representativeRole || ''),
    representativeAuthorizationRef: typeof rep === 'object' ? (rep.authority || '') : (p.representativeAuthorizationRef || ''),
  };
}

const EDITABLE = new Set(['draft', 'needs_information', 'rejected', 'expired', 'email_verified']);

export default function EmployerVerification() {
  const { t } = useTranslation(['employer', 'common']);
  const { employer } = useEmployerAuth();
  const orgId = employer?.organizationId;
  const canSubmit = (employer?.capabilities || []).includes('verification.submit');
  const [details, setDetails] = useState(null);
  const [profile, setProfile] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    if (!orgId) return;
    const { data } = await employerApi.verificationStatus(orgId);
    setDetails(data);
    if (data?.profile) setProfile(hydrateProfile(data.profile));
  }, [orgId]);

  useEffect(() => {
    load()
      .catch((err) => setError(err.response?.data?.error || t('employer:verificationLoadFailed')))
      .finally(() => setLoading(false));
  }, [load, t]);

  const setField = (key) => (e) => setProfile((p) => ({ ...p, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!orgId) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const method = details?.status === 'needs_information'
        ? employerApi.verificationRespond
        : employerApi.verificationSubmit;
      await method(orgId, toSubmitProfile(profile));
      await load();
      setMessage(t('employer:verificationSubmitted'));
    } catch (err) {
      setError(err.response?.data?.error || t('employer:verificationSubmitFailed'));
    } finally {
      setBusy(false);
    }
  };

  const addEvidence = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const reference = String(form.get('reference') || '').trim();
    if (!reference || !orgId) return;
    setBusy(true);
    setError('');
    try {
      await employerApi.verificationEvidence(orgId, {
        evidenceType: form.get('evidenceType') || 'organization_document',
        sourceUrl: reference,
        evidenceRef: reference,
      });
      await load();
      e.target.reset();
    } catch (err) {
      setError(err.response?.data?.error || t('employer:evidenceFailed'));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p>{t('common:loading')}</p>;

  const status = details?.status || 'draft';
  const editable = canSubmit && EDITABLE.has(status);

  return (
    <>
      <SeoHead title={t('employer:verificationSeoTitle')} description={t('employer:verificationSeoDesc')} noindex />
      <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white mb-2">
        {t('employer:navVerification')}
      </h1>
      <p className="text-sm text-slate-600 dark:text-gray-400 mb-6 max-w-2xl">{t('employer:verificationIntro')}</p>
      {error ? <p className="mb-4 text-sm text-red-700" role="alert">{error}</p> : null}
      {message ? <p className="mb-4 text-sm text-green-800" role="status">{message}</p> : null}

      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 mb-6">
        <p className="text-sm">{t('employer:verificationStatus')}: <strong>{status}</strong></p>
        {details?.informationRequestReason ? (
          <p className="mt-2 text-sm text-amber-700">{details.informationRequestReason}</p>
        ) : null}
        {details?.rejectionReason ? (
          <p className="mt-2 text-sm text-red-700">{details.rejectionReason}</p>
        ) : null}
        {details?.nextReviewAt ? (
          <p className="mt-2 text-xs text-slate-500">{t('employer:nextReview')}: {new Date(details.nextReviewAt).toLocaleString()}</p>
        ) : null}
        <p className="mt-3 text-xs text-slate-500">{t('employer:cannotSelfApprove')}</p>
      </section>

      {editable ? (
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 mb-6">
          {[
            ['legalName', true],
            ['displayName', true],
            ['countryCode', true],
            ['officialEmail', true],
            ['officialPhone', false],
            ['officialWebsite', true],
            ['registrationAuthority', false],
            ['registrationNumber', false],
            ['licenseNumber', false],
            ['googleMapsUrl', false],
          ].map(([key, required]) => (
            <label key={key} className="text-sm">
              {t(`employer:vf_${key}`, { defaultValue: key })}
              <input
                required={required}
                value={profile[key]}
                onChange={setField(key)}
                className="mt-1 w-full min-h-[44px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3"
              />
            </label>
          ))}
          <label className="text-sm md:col-span-2">
            {t('employer:vf_registeredAddress')}
            <input
              required
              value={profile.registeredAddress.addressLine1}
              onChange={(e) => setProfile((p) => ({
                ...p,
                registeredAddress: { ...p.registeredAddress, addressLine1: e.target.value },
              }))}
              className="mt-1 w-full min-h-[44px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3"
            />
          </label>
          <label className="text-sm">
            {t('employer:vf_city')}
            <input
              value={profile.registeredAddress.city}
              onChange={(e) => setProfile((p) => ({
                ...p,
                registeredAddress: { ...p.registeredAddress, city: e.target.value },
              }))}
              className="mt-1 w-full min-h-[44px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3"
            />
          </label>
          <label className="text-sm">
            {t('employer:vf_repName')}
            <input
              required
              value={profile.authorizedRepresentative.fullName}
              onChange={(e) => setProfile((p) => ({
                ...p,
                authorizedRepresentative: { ...p.authorizedRepresentative, fullName: e.target.value },
              }))}
              className="mt-1 w-full min-h-[44px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3"
            />
          </label>
          <label className="text-sm">
            {t('employer:vf_repAuthority')}
            <input
              value={profile.authorizedRepresentative.authority}
              onChange={(e) => setProfile((p) => ({
                ...p,
                authorizedRepresentative: { ...p.authorizedRepresentative, authority: e.target.value },
              }))}
              className="mt-1 w-full min-h-[44px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3"
            />
          </label>
          <button type="submit" disabled={busy} className="md:col-span-2 min-h-[44px] px-4 py-2 bg-primary text-white rounded-lg disabled:opacity-50">
            {t('employer:submitVerification')}
          </button>
        </form>
      ) : null}

      <form onSubmit={addEvidence} className="max-w-xl space-y-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <h2 className="font-semibold">{t('employer:supportingEvidence')}</h2>
        <p className="text-xs text-slate-500">{t('employer:mapsSupportingOnly')}</p>
        <label className="block text-sm">
          {t('employer:evidenceType')}
          <select name="evidenceType" className="mt-1 w-full min-h-[44px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3">
            <option value="organization_document">organization_document</option>
            <option value="official_domain">official_domain</option>
            <option value="google_maps">google_maps</option>
            <option value="business_registration">business_registration</option>
            <option value="representative_authority">representative_authority</option>
          </select>
        </label>
        <label className="block text-sm">
          {t('employer:evidenceReference')}
          <input name="reference" required className="mt-1 w-full min-h-[44px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3" />
        </label>
        <button type="submit" disabled={busy || !canSubmit} className="min-h-[44px] px-4 py-2 border rounded-lg disabled:opacity-50">
          {t('employer:addEvidence')}
        </button>
      </form>
    </>
  );
}
