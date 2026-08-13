import { useEffect, useState } from 'react';
import { INSTITUTION_TYPES } from '@shared/education/taxonomy.js';
import { FormField } from '../../components/common/FormField';
import { PhoneInput } from '../../components/forms/PhoneInput';
import { LocationCascadeFilter } from '../../components/forms/LocationCascadeFilter';
import { inputControlClassName, selectControlClassName, textareaControlClassName } from '../../components/forms/controlClasses';
import { useInstitutionAuth } from '../../context/InstitutionAuthContext';
import { institutionPortalApi } from '../../services/institutionPortalService';
import { PageState, Panel, primaryButton } from './InstitutionUi';

const OTHER_ORG_TYPE = INSTITUTION_TYPES.OTHER;
const OTHER_ORG_TYPE_PREFIX = /^Other:\s*(.+)$/i;

function parseOrganizationType(raw) {
  const value = (raw || '').trim();
  if (!value) return { organizationType: '', organizationTypeOther: '' };
  const otherMatch = value.match(OTHER_ORG_TYPE_PREFIX);
  if (otherMatch) return { organizationType: OTHER_ORG_TYPE, organizationTypeOther: otherMatch[1].trim() };
  if (value === OTHER_ORG_TYPE) return { organizationType: OTHER_ORG_TYPE, organizationTypeOther: '' };
  if (Object.values(INSTITUTION_TYPES).includes(value)) return { organizationType: value, organizationTypeOther: '' };
  return { organizationType: OTHER_ORG_TYPE, organizationTypeOther: value };
}

function serializeOrganizationType(organizationType, organizationTypeOther) {
  if (organizationType === OTHER_ORG_TYPE) {
    return `Other: ${organizationTypeOther.trim()}`;
  }
  return organizationType;
}

const ORG_TYPE_OPTIONS = Object.values(INSTITUTION_TYPES);

const empty = {
  officialDisplayName: '', legalName: '', organizationType: '', institutionType: '', organizationTypeOther: '',
  countryCode: '', city: '', region: '', officialDomain: '', logoUrl: '',
  officialWebsite: '', officialAdmissionsWebsite: '', officialContactEmail: '', officialPhone: '',
  institutionDescription: '', representativeName: '', representativeTitle: '', representativeEmail: '',
  addressLine1: '',
};

export default function InstitutionProfile() {
  const { organizationId } = useInstitutionAuth();
  const [form, setForm] = useState(empty);
  const [phoneValue, setPhoneValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState('');

  useEffect(() => {
    institutionPortalApi.profile(organizationId)
      .then(({ data }) => {
        const p = data.profile || {};
        const primary = (p.addresses || []).find((a) => a.isPrimary) || p.addresses?.[0] || {};
        const orgType = parseOrganizationType(p.organizationType || p.institutionType);
        setForm({
          ...empty,
          ...p,
          ...orgType,
          city: p.city || primary.city || '',
          region: p.region || primary.region || '',
          addressLine1: primary.addressLine1 || '',
          countryCode: p.countryCode || primary.countryCode || '',
        });
        setPhoneValue(p.officialPhone || '');
      })
      .catch((requestError) => setError(requestError.response?.data?.error || 'Institution profile is unavailable.'))
      .finally(() => setLoading(false));
  }, [organizationId]);

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const save = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');
    if (!form.officialDisplayName.trim()) {
      setFieldError('Official display name is required.');
      document.getElementById('institution-official-name')?.focus();
      return;
    }
    if (form.organizationType === OTHER_ORG_TYPE && !form.organizationTypeOther?.trim()) {
      setFieldError('Please specify your organization type.');
      document.getElementById('institution-organization-type-other')?.focus();
      return;
    }
    const officialPhone = typeof phoneValue === 'object'
      ? (phoneValue.e164 || '')
      : String(phoneValue || '');
    if (phoneValue?.nationalNumber && !/^\+[1-9][0-9]{6,14}$/.test(officialPhone)) {
      setFieldError('Enter a valid phone number. Letters are not accepted.');
      return;
    }
    setFieldError('');
    setBusy(true);
    try {
      const resolvedOrganizationType = serializeOrganizationType(form.organizationType, form.organizationTypeOther);
      const payload = {
        ...form,
        organizationType: resolvedOrganizationType,
        institutionType: resolvedOrganizationType,
        officialPhone,
        addresses: [{
          label: 'Registered',
          addressLine1: form.addressLine1,
          city: form.city,
          region: form.region,
          countryCode: form.countryCode,
          isPrimary: true,
        }],
      };
      const { data } = await institutionPortalApi.updateProfile(organizationId, payload);
      const p = data.profile || {};
      const primary = (p.addresses || []).find((a) => a.isPrimary) || p.addresses?.[0] || {};
      const orgType = parseOrganizationType(p.organizationType || p.institutionType);
      setForm((current) => ({
        ...current,
        ...p,
        ...orgType,
        city: p.city || primary.city || '',
        region: p.region || primary.region || '',
        addressLine1: primary.addressLine1 || current.addressLine1,
        countryCode: p.countryCode || primary.countryCode || current.countryCode,
      }));
      setPhoneValue(p.officialPhone || officialPhone);
      setMessage('Profile saved as Institution-supplied information. Saving does not change verification or claim approval.');
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Profile could not be saved. Your entered values are preserved.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <PageState>Loading Institution profile…</PageState>;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-primary">Official profile</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">Organization profile</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Public, source-backed identity. Do not invent missing facts. Legacy records remain compatible.</p>
      </div>
      {message ? <PageState tone="success">{message}</PageState> : null}
      {error ? <PageState tone="error" role="alert">{error}</PageState> : null}
      <Panel>
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2" noValidate>
          <div className="sm:col-span-2">
            <FormField id="institution-official-name" label="Official / display name" error={fieldError}>
              <input id="institution-official-name" className={inputControlClassName()} value={form.officialDisplayName} onChange={set('officialDisplayName')} placeholder="Official name as it should appear publicly" />
            </FormField>
          </div>

          <label className="text-sm font-medium text-gray-800 dark:text-gray-200">
            Legal name
            <input className={`${inputControlClassName()} mt-1`} value={form.legalName || ''} onChange={set('legalName')} placeholder="Registered legal name" />
          </label>

          <label className="text-sm font-medium text-gray-800 dark:text-gray-200">
            Organization type
            <select
              className={`${selectControlClassName()} mt-1`}
              value={form.organizationType || form.institutionType || ''}
              onChange={(event) => {
                const nextType = event.target.value;
                setForm((current) => ({
                  ...current,
                  organizationType: nextType,
                  organizationTypeOther: nextType === OTHER_ORG_TYPE ? current.organizationTypeOther : '',
                }));
              }}
            >
              <option value="">Select type</option>
              {ORG_TYPE_OPTIONS.map((type) => (
                <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>
              ))}
            </select>
          </label>

          <div className={form.organizationType === OTHER_ORG_TYPE ? '' : 'hidden'}>
            <FormField
              id="institution-organization-type-other"
              label="Specify organization type"
              error={fieldError && !form.organizationTypeOther?.trim() ? fieldError : ''}
            >
              <input
                id="institution-organization-type-other"
                className={inputControlClassName()}
                value={form.organizationTypeOther || ''}
                onChange={set('organizationTypeOther')}
                required={form.organizationType === OTHER_ORG_TYPE}
                placeholder="e.g. vocational academy"
              />
            </FormField>
          </div>

          <div className="sm:col-span-2">
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">Country, region, city</span>
            <LocationCascadeFilter
              className="mt-1"
              idPrefix="institution-geo"
              allowAllCountries={false}
              countryCode={form.countryCode || ''}
              region={form.region || ''}
              city={form.city || ''}
              onChange={(next) => setForm((current) => ({
                ...current,
                countryCode: next.countryCode || '',
                region: next.region || '',
                city: next.city || '',
              }))}
            />
          </div>
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200 sm:col-span-2">
            Registered address
            <input className={`${inputControlClassName()} mt-1`} value={form.addressLine1 || ''} onChange={set('addressLine1')} placeholder="Street address" />
          </label>
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200">
            Official website
            <input type="url" className={`${inputControlClassName()} mt-1`} value={form.officialWebsite || ''} onChange={set('officialWebsite')} placeholder="https://www.example.edu" />
          </label>
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200">
            Official domain
            <input className={`${inputControlClassName()} mt-1`} value={form.officialDomain || ''} onChange={set('officialDomain')} placeholder="www.example.edu" />
          </label>
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200">
            Official email
            <input type="email" className={`${inputControlClassName()} mt-1`} value={form.officialContactEmail || ''} onChange={set('officialContactEmail')} placeholder="admissions@example.edu" />
          </label>
          <div>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">Phone</span>
            <PhoneInput
              id="institution-official-phone"
              className="mt-1"
              value={phoneValue}
              defaultCountry={form.countryCode || 'US'}
              onChange={setPhoneValue}
            />
          </div>
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200 sm:col-span-2">
            Logo URL
            <input type="url" className={`${inputControlClassName()} mt-1`} value={form.logoUrl || ''} onChange={set('logoUrl')} placeholder="https://www.example.edu/logo.png" />
          </label>
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200">
            Representative name
            <input className={`${inputControlClassName()} mt-1`} value={form.representativeName || ''} onChange={set('representativeName')} placeholder="Full name" />
          </label>
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200">
            Representative title
            <input className={`${inputControlClassName()} mt-1`} value={form.representativeTitle || ''} onChange={set('representativeTitle')} placeholder="Registrar, director, or authorised officer" />
          </label>
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200 sm:col-span-2">
            Representative email
            <input type="email" className={`${inputControlClassName()} mt-1`} value={form.representativeEmail || ''} onChange={set('representativeEmail')} placeholder="you@example.edu" />
          </label>
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200 sm:col-span-2">
            Public description
            <textarea className={`${textareaControlClassName()} mt-1`} value={form.institutionDescription || ''} onChange={set('institutionDescription')} placeholder="Short public description of the institution" />
          </label>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <button className={primaryButton} disabled={busy}>{busy ? 'Saving…' : 'Save Institution profile'}</button>
            <span className="text-sm text-gray-600 dark:text-gray-400">Completeness: {form.completenessScore || 0}% — not a verification badge.</span>
          </div>
        </form>
      </Panel>
    </div>
  );
}
