import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ISO_3166_ALPHA2, countryDisplayName } from '@shared/international/country.js';
import { AGENT_SERVICE_CATEGORIES, AGENT_ONBOARDING_STEPS } from '@shared/agent/constants.js';
import { AGENT_ONBOARDING_STEP_POLICY, validateAgentOnboardingStep } from '@shared/agent/onboardingPolicy.js';
import { agentApi } from '../../services/agentService';
import { ROUTES } from '../../constants';
import { Logo } from '../../components/brand/Logo';
import { CountrySelect } from '../../components/forms/CountrySelect';
import { LocationFields } from '../../components/forms/LocationFields';
import { PhoneInput } from '../../components/forms/PhoneInput';
import { MultiSelect } from '../../components/forms/MultiSelect';
import { inputControlClassName, textareaControlClassName } from '../../components/forms/controlClasses';
import { btnPrimary, btnSecondary, cardClass, labelClass, muted } from './agentUi';

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'ur', label: 'Urdu' },
  { value: 'ar', label: 'Arabic' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'es', label: 'Spanish' },
  { value: 'zh', label: 'Chinese' },
  { value: 'hi', label: 'Hindi' },
  { value: 'bn', label: 'Bengali' },
  { value: 'tr', label: 'Turkish' },
  { value: 'fa', label: 'Persian' },
  { value: 'ms', label: 'Malay' },
  { value: 'id', label: 'Indonesian' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ru', label: 'Russian' },
];

const SPECIALTY_OPTIONS = Object.values(AGENT_SERVICE_CATEGORIES).map((value) => ({
  value,
  label: value.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
}));

const STEPS = [
  { key: AGENT_ONBOARDING_STEPS.IDENTITY, label: 'Professional Identity', description: 'Your public professional name and biography. This is self-declared — not verification.' },
  { key: AGENT_ONBOARDING_STEPS.SERVICES, label: 'Contact & Location', description: 'Official contact channels and office location students can reach you at.' },
  { key: AGENT_ONBOARDING_STEPS.MARKETS, label: 'Expertise & Coverage', description: 'Countries you serve, destination expertise, languages, and service specialties.' },
  { key: AGENT_ONBOARDING_STEPS.REPRESENTATIVE, label: 'Representative / Agency', description: 'Legal entity and authorized representative details for agency accounts.', agencyOnly: true },
  { key: AGENT_ONBOARDING_STEPS.VERIFICATION, label: 'Verification Readiness', description: 'What you need before submitting a Strideto verification dossier.' },
  { key: AGENT_ONBOARDING_STEPS.REVIEW, label: 'Review & Finish', description: 'Confirm your profile summary and continue to verification when ready.' },
];

function buildCountryOptions(locale) {
  return ISO_3166_ALPHA2.map((code) => ({
    value: code,
    label: countryDisplayName(code, locale),
  })).sort((a, b) => a.label.localeCompare(b.label, locale, { sensitivity: 'base' }));
}

function stepIndexForKey(key, isAgency) {
  const visible = STEPS.filter((s) => !s.agencyOnly || isAgency);
  return visible.findIndex((s) => s.key === key);
}

function restoreStepIndex(onboardingStep, isAgency) {
  if (!onboardingStep || onboardingStep === AGENT_ONBOARDING_STEPS.ACCOUNT) return 0;
  const idx = stepIndexForKey(onboardingStep, isAgency);
  if (idx < 0) return 0;
  const visible = STEPS.filter((s) => !s.agencyOnly || isAgency);
  return Math.min(idx + 1, visible.length - 1);
}

function FieldHint({ error, optional }) {
  return (
    <p className={`mt-1 min-h-[1.25rem] text-xs ${error ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`} role={error ? 'alert' : undefined}>
      {error || (optional ? 'Optional' : '\u00a0')}
    </p>
  );
}

export default function AgentOnboarding() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const countryOptions = useMemo(() => buildCountryOptions(i18n.language || 'en'), [i18n.language]);

  const [accountType, setAccountType] = useState('professional');
  const [verificationStatus, setVerificationStatus] = useState('draft');
  const [currentStep, setCurrentStep] = useState(0);
  const [completedKeys, setCompletedKeys] = useState([]);
  const [skippedKeys, setSkippedKeys] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [form, setForm] = useState({
    professionalName: '',
    professionalSummary: '',
    yearsOfExperience: '',
    countryCode: '',
    officialEmail: '',
    website: '',
    phone: '',
    officeLocation: { countryCode: '', region: '', city: '', addressLine1: '', postalCode: '' },
    serviceCountries: [],
    destinationCountries: [],
    languages: [],
    specialties: [],
    legalName: '',
    representativeName: '',
    representativeRole: '',
    representativeEmail: '',
  });

  const isAgency = accountType === 'agency';
  const visibleSteps = STEPS.filter((s) => !s.agencyOnly || isAgency);
  const step = visibleSteps[currentStep] || visibleSteps[0];
  const stepPolicy = AGENT_ONBOARDING_STEP_POLICY[step.key] || {};

  useEffect(() => {
    Promise.all([agentApi.getProfile(), agentApi.getVerification()])
      .then(([profileRes, verificationRes]) => {
        const profile = profileRes.data.profile || {};
        const org = profileRes.data.organization || {};
        const agency = profileRes.data.accountType === 'agency';
        setAccountType(profileRes.data.accountType || 'professional');
        setVerificationStatus(verificationRes.data.verificationStatus || 'draft');
        setForm((f) => ({
          ...f,
          professionalName: profile.professionalName || '',
          professionalSummary: profile.professionalSummary || '',
          yearsOfExperience: profile.yearsOfExperience ?? '',
          countryCode: profile.countryCode || '',
          officialEmail: profile.officialEmail || '',
          website: profile.website || '',
          phone: profile.phone || '',
          officeLocation: {
            addressLine1: profile.officeLocation?.addressLine1 || '',
            city: profile.officeLocation?.city || '',
            region: profile.officeLocation?.region || '',
            postalCode: profile.officeLocation?.postalCode || '',
            countryCode: profile.officeLocation?.countryCode || profile.countryCode || '',
          },
          serviceCountries: profile.serviceCountries || [],
          destinationCountries: profile.destinationCountries || [],
          languages: profile.languages || [],
          specialties: profile.specialties || [],
          legalName: org.legalName || '',
          representativeName: (profile.credentialReferences || []).find((r) => r.startsWith('rep:name='))?.slice(9)?.split('|')[0] || '',
          representativeRole: (profile.credentialReferences || []).find((r) => r.startsWith('rep:role='))?.slice(9) || '',
          representativeEmail: (profile.credentialReferences || []).find((r) => r.startsWith('rep:email='))?.slice(10) || '',
        }));
        setSkippedKeys(profile.onboardingSkippedSteps || []);
        const last = profile.onboardingStep || AGENT_ONBOARDING_STEPS.ACCOUNT;
        if (last && last !== AGENT_ONBOARDING_STEPS.ACCOUNT) {
          const done = [];
          const visible = STEPS.filter((s) => !s.agencyOnly || agency);
          for (const item of visible) {
            done.push(item.key);
            if (item.key === last) break;
          }
          setCompletedKeys(done);
        }
        setCurrentStep(restoreStepIndex(profile.onboardingStep, agency));
      })
      .catch((e) => setError(e.response?.data?.error || 'Failed to load onboarding'))
      .finally(() => setLoading(false));
  }, []);

  const patch = (partial) => {
    setForm((f) => ({ ...f, ...partial }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      Object.keys(partial).forEach((key) => { delete next[key]; });
      return next;
    });
  };

  const buildProfilePayload = () => {
    const officeLocation = {
      addressLine1: form.officeLocation.addressLine1 || '',
      city: form.officeLocation.city || '',
      region: form.officeLocation.region || '',
      postalCode: form.officeLocation.postalCode || '',
      countryCode: (form.officeLocation.countryCode || form.countryCode || '').toUpperCase(),
    };
    const credentialReferences = [];
    if (isAgency && form.representativeName) credentialReferences.push(`rep:name=${form.representativeName}`);
    if (isAgency && form.representativeRole) credentialReferences.push(`rep:role=${form.representativeRole}`);
    if (isAgency && form.representativeEmail) credentialReferences.push(`rep:email=${form.representativeEmail}`);

    return {
      professionalName: form.professionalName,
      professionalSummary: form.professionalSummary,
      countryCode: form.countryCode,
      yearsOfExperience: form.yearsOfExperience ? Number(form.yearsOfExperience) : null,
      officialEmail: form.officialEmail,
      website: form.website,
      phone: typeof form.phone === 'object' ? (form.phone.e164 || '') : form.phone,
      officeLocation,
      serviceCountries: form.serviceCountries,
      destinationCountries: form.destinationCountries,
      languages: form.languages.map((l) => l.toLowerCase()),
      specialties: form.specialties,
      legalName: isAgency ? form.legalName : undefined,
      credentialReferences: isAgency ? credentialReferences : undefined,
    };
  };

  const persistAndAdvance = async ({ skip = false } = {}) => {
    const payload = buildProfilePayload();
    const verdict = validateAgentOnboardingStep(step.key, payload, { skip });
    if (!verdict.ok) {
      setFieldErrors(verdict.errors || {});
      setError(verdict.message);
      return;
    }

    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      if (['identity', 'services', 'markets', 'representative'].includes(step.key) && !skip) {
        await agentApi.updateProfile(payload);
      }
      const { data } = await agentApi.submitOnboardingStep(step.key, { skip });
      const saved = data.profile || {};
      setSkippedKeys(saved.onboardingSkippedSteps || (skip ? [...skippedKeys, step.key] : skippedKeys.filter((k) => k !== step.key)));
      setCompletedKeys((keys) => (keys.includes(step.key) ? keys : [...keys, step.key]));

      if (step.key === 'review') {
        navigate(ROUTES.AGENT_EDUCATION_VERIFICATION, { replace: true });
        return;
      }

      if (currentStep < visibleSteps.length - 1) setCurrentStep((s) => s + 1);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to save this step. Your entries were kept.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-main dark:bg-secondary px-4 py-12">
        <p className={`${muted} text-center`}>Loading onboarding…</p>
      </div>
    );
  }

  const underReview = ['under_review', 'verification_pending', 'enhanced_review'].includes(verificationStatus);

  const stepTone = (key, index) => {
    if (skippedKeys.includes(key) && index !== currentStep) return 'skipped';
    if (completedKeys.includes(key) && index !== currentStep) return 'complete';
    if (index === currentStep) return 'current';
    return 'upcoming';
  };

  return (
    <div className="min-h-screen bg-bg-main dark:bg-secondary px-4 py-12">
      <div className="max-w-2xl mx-auto">
        <Logo height={32} className="mb-6" />
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">Agent Onboarding</h1>
        <p className={`${muted} mb-8`}>Complete these steps to set up your professional agent profile. Profile completion is not verification.</p>

        <ol className="flex items-center gap-2 mb-8 overflow-x-auto pb-2" aria-label="Onboarding progress">
          {visibleSteps.map((s, i) => {
            const tone = stepTone(s.key, i);
            const cls = tone === 'complete'
              ? 'bg-green-500 text-white'
              : tone === 'skipped'
                ? 'bg-amber-400 text-amber-950'
                : tone === 'current'
                  ? 'bg-primary text-white'
                  : 'bg-slate-200 dark:bg-gray-700 text-slate-500 dark:text-gray-300';
            return (
              <li key={s.key} className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${cls}`}
                  aria-current={tone === 'current' ? 'step' : undefined}
                  title={`${s.label} (${tone})`}
                >
                  {tone === 'complete' ? '✓' : tone === 'skipped' ? '–' : i + 1}
                </div>
                {i < visibleSteps.length - 1 ? <div className={`w-8 h-0.5 flex-shrink-0 ${tone === 'complete' ? 'bg-green-400' : tone === 'skipped' ? 'bg-amber-300' : 'bg-slate-200 dark:bg-gray-700'}`} /> : null}
              </li>
            );
          })}
        </ol>

        <div className={cardClass}>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{step.label}</h2>
          <p className={`${muted} mt-2 mb-6`}>{step.description}</p>

          {step.key === 'identity' ? (
            <div className="space-y-4 mb-6">
              <p className="text-sm text-gray-600 dark:text-gray-300">Account type: <strong>{isAgency ? 'Agency / organization' : 'Individual professional'}</strong></p>
              <label className={labelClass}>
                {isAgency ? 'Public display name' : 'Professional name'}
                <input className={inputControlClassName({ className: 'mt-1', error: Boolean(fieldErrors.professionalName) })} value={form.professionalName} onChange={(e) => patch({ professionalName: e.target.value })} />
                <FieldHint error={fieldErrors.professionalName} />
              </label>
              <label className={labelClass}>
                Biography / about
                <textarea className={textareaControlClassName({ className: 'mt-1' })} rows={4} maxLength={2000} value={form.professionalSummary} onChange={(e) => patch({ professionalSummary: e.target.value })} placeholder="Describe your professional background…" />
                <FieldHint optional />
              </label>
              <label className={labelClass}>
                Primary country
                <div className="mt-1"><CountrySelect value={form.countryCode} error={Boolean(fieldErrors.countryCode)} onChange={(code) => patch({ countryCode: code, officeLocation: { ...form.officeLocation, countryCode: code, region: '', city: '' } })} /></div>
                <FieldHint error={fieldErrors.countryCode} />
              </label>
              <label className={labelClass}>
                Years of experience (self-declared)
                <input type="number" min="0" max="99" className={inputControlClassName({ className: 'mt-1' })} value={form.yearsOfExperience} onChange={(e) => patch({ yearsOfExperience: e.target.value })} />
                <FieldHint optional />
              </label>
            </div>
          ) : null}

          {step.key === 'services' ? (
            <div className="space-y-4 mb-6">
              <label className={labelClass}>
                Official email
                <input type="email" className={inputControlClassName({ className: 'mt-1', error: Boolean(fieldErrors.officialEmail) })} value={form.officialEmail} onChange={(e) => patch({ officialEmail: e.target.value })} />
                <FieldHint error={fieldErrors.officialEmail} />
              </label>
              <label className={labelClass}>
                Official website
                <input type="url" className={inputControlClassName({ className: 'mt-1' })} value={form.website} onChange={(e) => patch({ website: e.target.value })} placeholder="https://" />
                <FieldHint optional />
              </label>
              <div>
                <span className={labelClass}>Phone</span>
                <PhoneInput className="mt-1" value={form.phone} defaultCountry={form.countryCode || form.officeLocation.countryCode || ''} onChange={(phone) => patch({ phone })} />
                <FieldHint optional />
              </div>
              <label className={labelClass}>
                Office address line
                <input className={inputControlClassName({ className: 'mt-1' })} value={form.officeLocation.addressLine1} onChange={(e) => patch({ officeLocation: { ...form.officeLocation, addressLine1: e.target.value } })} />
                <FieldHint optional />
              </label>
              <LocationFields
                value={form.officeLocation}
                onChange={(loc) => patch({ officeLocation: { ...form.officeLocation, ...loc } })}
                idPrefix="agent-onboarding-office"
              />
            </div>
          ) : null}

          {step.key === 'markets' ? (
            <div className="space-y-4 mb-6">
              <label className={labelClass}>
                Service regions
                <MultiSelect className="mt-1" value={form.serviceCountries} onChange={(serviceCountries) => patch({ serviceCountries })} options={countryOptions} emptyLabel="Select countries you serve" />
              </label>
              <label className={labelClass}>
                Destination / country expertise
                <MultiSelect className="mt-1" value={form.destinationCountries} onChange={(destinationCountries) => patch({ destinationCountries })} options={countryOptions} emptyLabel="Select destination countries" />
              </label>
              <label className={labelClass}>
                Languages
                <MultiSelect className="mt-1" value={form.languages} onChange={(languages) => patch({ languages })} options={LANGUAGE_OPTIONS} emptyLabel="Select languages" />
              </label>
              <label className={labelClass}>
                Service specialties
                <MultiSelect className="mt-1" value={form.specialties} onChange={(specialties) => patch({ specialties })} options={SPECIALTY_OPTIONS} emptyLabel="Select specialties" />
              </label>
              <FieldHint error={fieldErrors.markets} optional={!fieldErrors.markets} />
            </div>
          ) : null}

          {step.key === 'representative' && isAgency ? (
            <div className="space-y-4 mb-6">
              <label className={labelClass}>
                Legal entity name
                <input className={inputControlClassName({ className: 'mt-1', error: Boolean(fieldErrors.legalName) })} value={form.legalName} onChange={(e) => patch({ legalName: e.target.value })} />
                <FieldHint error={fieldErrors.legalName} />
              </label>
              <label className={labelClass}>
                Authorized representative name
                <input className={inputControlClassName({ className: 'mt-1' })} value={form.representativeName} onChange={(e) => patch({ representativeName: e.target.value })} />
                <FieldHint optional />
              </label>
              <label className={labelClass}>
                Representative role / title
                <input className={inputControlClassName({ className: 'mt-1' })} value={form.representativeRole} onChange={(e) => patch({ representativeRole: e.target.value })} />
                <FieldHint optional />
              </label>
              <label className={labelClass}>
                Representative email
                <input type="email" className={inputControlClassName({ className: 'mt-1' })} value={form.representativeEmail} onChange={(e) => patch({ representativeEmail: e.target.value })} />
                <FieldHint optional />
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400">Representative authority is verified separately through the organization verification dossier — not by filling this form alone.</p>
            </div>
          ) : null}

          {step.key === 'verification' ? (
            <div className="space-y-4 mb-6">
              <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm text-blue-800 dark:text-blue-200">
                <p className="font-semibold">Verification is separate from profile completion.</p>
                <p className="mt-2">Strideto organization verification covers identity, registration, representative authority, location, and official source URLs. Maps/Business URLs are supporting evidence only — never sole proof.</p>
              </div>
              <ul className="list-disc pl-5 text-sm text-gray-700 dark:text-gray-300 space-y-1">
                <li>Prepare registration or accreditation references where applicable.</li>
                <li>Gather official domain and contact evidence.</li>
                <li>Do not claim verified status until Admin approval.</li>
                <li>Current verification status: <strong>{verificationStatus.replaceAll('_', ' ')}</strong></li>
              </ul>
              <Link to={ROUTES.AGENT_EDUCATION_VERIFICATION} className={`${btnSecondary} inline-flex`}>Preview verification workspace</Link>
            </div>
          ) : null}

          {step.key === 'review' ? (
            <div className="space-y-4 mb-6">
              {underReview ? (
                <div className="bg-yellow-50 dark:bg-yellow-950/40 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 text-sm text-yellow-800 dark:text-yellow-200">
                  Your verification dossier status is <strong>{verificationStatus.replaceAll('_', ' ')}</strong>. You may continue editing your profile while review is in progress.
                </div>
              ) : (
                <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-sm text-gray-700 dark:text-gray-300">
                  Profile onboarding is complete. Verification has not been submitted or is still in draft — you are not under review unless your verification status says so.
                </div>
              )}
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div><dt className="text-gray-500">Name</dt><dd className="font-medium text-gray-900 dark:text-white">{form.professionalName || '—'}</dd></div>
                <div><dt className="text-gray-500">Country</dt><dd className="font-medium text-gray-900 dark:text-white">{form.countryCode || '—'}</dd></div>
                <div><dt className="text-gray-500">Email</dt><dd className="font-medium text-gray-900 dark:text-white">{form.officialEmail || '—'}</dd></div>
                <div><dt className="text-gray-500">Service regions</dt><dd className="font-medium text-gray-900 dark:text-white">{form.serviceCountries.length ? form.serviceCountries.join(', ') : '—'}</dd></div>
              </dl>
            </div>
          ) : null}

          <div className="mb-4 min-h-[3rem]" aria-live="polite">
            {error ? <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm" role="alert">{error}</div> : null}
          </div>

          <div className="flex flex-wrap gap-3">
            {currentStep > 0 ? <button type="button" onClick={() => { setError(null); setFieldErrors({}); setCurrentStep((s) => s - 1); }} className={btnSecondary}>Back</button> : null}
            <button type="button" onClick={() => persistAndAdvance({ skip: false })} disabled={submitting} className={btnPrimary}>
              {submitting ? 'Saving…' : step.key === 'review' ? 'Finish & open verification' : 'Save & continue'}
            </button>
            {stepPolicy.skippable ? (
              <button type="button" onClick={() => persistAndAdvance({ skip: true })} disabled={submitting} className={btnSecondary}>
                Skip for now
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
