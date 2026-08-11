import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { useEmployerAuth } from '../../context/EmployerAuthContext';
import { employerApi, employerAuthApi } from '../../services/employerService';
import { VerificationBadge } from '../../components/common/VerificationBadge';
import { isValidHttpUrl } from './employerPostJobValidation';
import { ROUTES } from '../../constants';

const MIN_PASSWORD_LENGTH = 8;

const inputClass =
  'w-full min-h-[44px] px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100';

export default function EmployerSettings() {
  const { t } = useTranslation(['employer', 'common']);
  const { employer, refreshEmployer, logoutAll } = useEmployerAuth();
  const [form, setForm] = useState({
    companyName: '',
    phone: '',
    website: '',
    companyDescription: '',
    industry: '',
    companySize: '',
    location: '',
    city: '',
    province: '',
    logoUrl: '',
    isPublicProfile: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Account security (change password + sign out everywhere).
  const [pwd, setPwd] = useState({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');
  const [logoutAllBusy, setLogoutAllBusy] = useState(false);
  const [logoutAllError, setLogoutAllError] = useState('');

  const onPwdChange = (e) => {
    const { name, value } = e.target;
    setPwd((p) => ({ ...p, [name]: value }));
    setPwdError('');
    setPwdSuccess('');
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwdError('');
    setPwdSuccess('');
    if (pwd.newPassword.length < MIN_PASSWORD_LENGTH) {
      setPwdError(t('employer:passwordTooShort', { count: MIN_PASSWORD_LENGTH }));
      return;
    }
    if (pwd.newPassword !== pwd.confirmNewPassword) {
      setPwdError(t('employer:passwordsDoNotMatch'));
      return;
    }
    setPwdSaving(true);
    try {
      await employerAuthApi.changePassword({
        currentPassword: pwd.currentPassword,
        newPassword: pwd.newPassword,
      });
      setPwd({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
      setPwdSuccess(t('employer:passwordChanged'));
    } catch (err) {
      setPwdError(err.response?.data?.error || t('employer:passwordChangeFailed'));
    } finally {
      setPwdSaving(false);
    }
  };

  const handleLogoutAll = async () => {
    if (logoutAllBusy) return;
    if (!window.confirm(t('employer:logoutAllConfirm'))) return;
    setLogoutAllBusy(true);
    setLogoutAllError('');
    try {
      await logoutAll();
      // logoutAll clears local session; the protected route redirects to login.
    } catch (err) {
      setLogoutAllError(err.response?.data?.error || t('employer:logoutAllFailed'));
      setLogoutAllBusy(false);
    }
  };

  useEffect(() => {
    if (!employer) return;
    setForm({
      companyName: employer.companyName || '',
      phone: employer.phone || '',
      website: employer.website || '',
      companyDescription: employer.companyDescription || '',
      industry: employer.industry || '',
      companySize: employer.companySize || '',
      location: employer.location || '',
      city: employer.city || '',
      province: employer.province || '',
      logoUrl: employer.logoUrl || '',
      isPublicProfile: employer.isPublicProfile !== false,
    });
  }, [employer]);

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!form.companyName.trim()) {
      setError(t('employer:validationCompanyRequired'));
      return;
    }
    if (form.website.trim() && !isValidHttpUrl(form.website)) {
      setError(t('employer:validationWebsiteInvalid'));
      return;
    }
    if (form.logoUrl.trim() && !isValidHttpUrl(form.logoUrl)) {
      setError(t('employer:validationLogoUrlInvalid'));
      return;
    }
    setSaving(true);
    try {
      await employerApi.updateProfile(form);
      await refreshEmployer();
      setSuccess(t('employer:settingsSaved'));
    } catch (err) {
      setError(err.response?.data?.error || t('employer:settingsSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <SeoHead title={t('employer:settingsSeoTitle')} description={t('employer:settingsSeoDesc')} noindex />
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">{t('employer:settings')}</h1>
        <VerificationBadge level={employer?.verificationLevel} verified={employer?.verified} />
      </div>

      <p className="text-sm text-slate-600 dark:text-gray-400 mb-4 max-w-xl">{t('employer:verificationReadOnlyHint')}</p>
      <nav className="flex flex-wrap gap-3 mb-6 text-sm">
        <Link className="text-primary hover:underline min-h-[44px] inline-flex items-center" to={ROUTES.EMPLOYER_TEAM}>{t('employer:navTeam')}</Link>
        <Link className="text-primary hover:underline min-h-[44px] inline-flex items-center" to={ROUTES.EMPLOYER_VERIFICATION}>{t('employer:navVerification')}</Link>
        <Link className="text-primary hover:underline min-h-[44px] inline-flex items-center" to={ROUTES.EMPLOYER_PLANS_USAGE}>{t('employer:navPlansUsage')}</Link>
        <Link className="text-primary hover:underline min-h-[44px] inline-flex items-center" to={ROUTES.EMPLOYER_BILLING}>{t('employer:navBilling')}</Link>
        <Link className="text-primary hover:underline min-h-[44px] inline-flex items-center" to={ROUTES.EMPLOYER_GUIDELINES}>{t('employer:navGuidelines')}</Link>
      </nav>

      {error ? (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm" role="alert">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="mb-4 p-3 rounded-lg bg-green-50 dark:bg-green-950/40 text-green-800 dark:text-green-200 text-sm" role="status">
          {success}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6 max-w-xl space-y-4">
        <div>
          <label htmlFor="settings-email" className="block text-sm font-medium text-slate-600 dark:text-gray-300 mb-1">
            {t('common:email')}
          </label>
          <input id="settings-email" type="email" value={employer?.email || ''} disabled className={`${inputClass} opacity-70`} />
        </div>
        <div>
          <label htmlFor="settings-company" className="block text-sm font-medium text-slate-600 dark:text-gray-300 mb-1">
            {t('employer:company')}
          </label>
          <input
            id="settings-company"
            name="companyName"
            value={form.companyName}
            onChange={onChange}
            required
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="settings-phone" className="block text-sm font-medium text-slate-600 dark:text-gray-300 mb-1">
            {t('employer:phone')}
          </label>
          <input id="settings-phone" name="phone" value={form.phone} onChange={onChange} className={inputClass} />
        </div>
        <div>
          <label htmlFor="settings-website" className="block text-sm font-medium text-slate-600 dark:text-gray-300 mb-1">
            {t('employer:website')}
          </label>
          <input id="settings-website" name="website" value={form.website} onChange={onChange} className={inputClass} placeholder="https://" />
        </div>
        <div>
          <label htmlFor="settings-logo" className="block text-sm font-medium text-slate-600 dark:text-gray-300 mb-1">
            {t('employer:logoUrl')}
          </label>
          <input id="settings-logo" name="logoUrl" value={form.logoUrl} onChange={onChange} className={inputClass} placeholder="https://" />
          <p className="mt-1 text-xs text-slate-500 dark:text-gray-400">{t('employer:logoUrlHelp')}</p>
        </div>
        <div>
          <label htmlFor="settings-description" className="block text-sm font-medium text-slate-600 dark:text-gray-300 mb-1">
            {t('employer:companyDescription')}
          </label>
          <textarea
            id="settings-description"
            name="companyDescription"
            rows={4}
            value={form.companyDescription}
            onChange={onChange}
            className={inputClass}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="settings-industry" className="block text-sm font-medium text-slate-600 dark:text-gray-300 mb-1">
              {t('employer:industry')}
            </label>
            <input id="settings-industry" name="industry" value={form.industry} onChange={onChange} className={inputClass} />
          </div>
          <div>
            <label htmlFor="settings-size" className="block text-sm font-medium text-slate-600 dark:text-gray-300 mb-1">
              {t('employer:companySize')}
            </label>
            <input id="settings-size" name="companySize" value={form.companySize} onChange={onChange} className={inputClass} />
          </div>
        </div>
        <div>
          <label htmlFor="settings-location" className="block text-sm font-medium text-slate-600 dark:text-gray-300 mb-1">
            {t('employer:location')}
          </label>
          <input id="settings-location" name="location" value={form.location} onChange={onChange} className={inputClass} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="settings-city" className="block text-sm font-medium text-slate-600 dark:text-gray-300 mb-1">
              {t('employer:city')}
            </label>
            <input id="settings-city" name="city" value={form.city} onChange={onChange} className={inputClass} />
          </div>
          <div>
            <label htmlFor="settings-province" className="block text-sm font-medium text-slate-600 dark:text-gray-300 mb-1">
              {t('employer:province')}
            </label>
            <input id="settings-province" name="province" value={form.province} onChange={onChange} className={inputClass} />
          </div>
        </div>
        <label className="flex items-center gap-2 min-h-[44px]">
          <input type="checkbox" name="isPublicProfile" checked={form.isPublicProfile} onChange={onChange} className="h-4 w-4" />
          <span className="text-sm text-gray-800 dark:text-gray-200">{t('employer:publicProfile')}</span>
        </label>
        {/* Truthful "View public profile": only reachable when the employer has a
            slug and the profile is actually public. Reflects the saved value. */}
        {employer?.slug && employer?.isPublicProfile !== false ? (
          <a
            href={`/employer/${employer.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center min-h-[44px] text-sm text-primary hover:underline"
          >
            {t('employer:viewPublicProfile')}
          </a>
        ) : (
          <p className="text-xs text-slate-500 dark:text-gray-400">{t('employer:publicProfileHiddenHint')}</p>
        )}
        <button
          type="submit"
          disabled={saving}
          className="min-h-[44px] px-6 py-2.5 bg-primary hover:opacity-90 text-white font-medium rounded-lg disabled:opacity-50"
        >
          {saving ? t('common:saving') : t('common:save')}
        </button>
      </form>

      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6 max-w-xl space-y-4 mt-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('employer:accountSecurity')}</h2>

        {pwdError ? (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm" role="alert">
            {pwdError}
          </div>
        ) : null}
        {pwdSuccess ? (
          <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/40 text-green-800 dark:text-green-200 text-sm" role="status">
            {pwdSuccess}
          </div>
        ) : null}

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label htmlFor="settings-current-password" className="block text-sm font-medium text-slate-600 dark:text-gray-300 mb-1">
              {t('employer:currentPassword')}
            </label>
            <input
              id="settings-current-password"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              value={pwd.currentPassword}
              onChange={onPwdChange}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="settings-new-password" className="block text-sm font-medium text-slate-600 dark:text-gray-300 mb-1">
              {t('employer:newPassword')}
            </label>
            <input
              id="settings-new-password"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              value={pwd.newPassword}
              onChange={onPwdChange}
              required
              className={inputClass}
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-gray-400">{t('employer:passwordRule', { count: MIN_PASSWORD_LENGTH })}</p>
          </div>
          <div>
            <label htmlFor="settings-confirm-password" className="block text-sm font-medium text-slate-600 dark:text-gray-300 mb-1">
              {t('employer:confirmNewPassword')}
            </label>
            <input
              id="settings-confirm-password"
              name="confirmNewPassword"
              type="password"
              autoComplete="new-password"
              value={pwd.confirmNewPassword}
              onChange={onPwdChange}
              required
              className={inputClass}
            />
          </div>
          <button
            type="submit"
            disabled={pwdSaving}
            className="min-h-[44px] px-6 py-2.5 bg-primary hover:opacity-90 text-white font-medium rounded-lg disabled:opacity-50"
          >
            {pwdSaving ? t('common:saving') : t('employer:changePassword')}
          </button>
        </form>

        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-slate-600 dark:text-gray-300 mb-2">{t('employer:logoutAllHint')}</p>
          {logoutAllError ? (
            <div className="mb-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm" role="alert">
              {logoutAllError}
            </div>
          ) : null}
          <button
            type="button"
            onClick={handleLogoutAll}
            disabled={logoutAllBusy}
            className="min-h-[44px] px-6 py-2.5 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 font-medium rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50"
          >
            {logoutAllBusy ? t('common:loading') : t('employer:logoutAllSessions')}
          </button>
        </div>
      </section>
    </>
  );
}
