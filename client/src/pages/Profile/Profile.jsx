import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { authApi } from '../../services/authService';
import { savedApi } from '../../services/listingsService';
import { INTEREST_CATEGORIES } from '../../constants/profileOptions';
import { LocationCascadeFilter } from '../../components/forms/LocationCascadeFilter';
import { ChangePasswordForm } from '../../components/auth/ChangePasswordForm';
import { ConnectedAccountsPanel } from '../../components/account/ConnectedAccountsPanel';
import { Button } from '../../components/common/Button';
import { FormField } from '../../components/common/FormField';
import { Alert } from '../../components/ui/Alerts';
import { ROUTES } from '../../constants';
import { formatDate } from '../../utils/formatDate';
import { SeoHead } from '../../components/seo';
import { ProfileCompletionCard } from '../../components/profile/ProfileCompletionCard';
import { ResumeEncouragementBanner } from '../../components/profile/ResumeEncouragementBanner';
import { openProfilingWizard } from '../../onboarding/ProfilingWizard.jsx';

export default function Profile() {
  const { t } = useTranslation(['profile', 'common']);
  const { user, updateUser, logout, logoutAll } = useAuth();
  const { setLang } = useLanguage();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const careerWizardOpenRef = useRef(false);
  const [name, setName] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [region, setRegion] = useState('');
  const [city, setCity] = useState('');
  const [interests, setInterests] = useState([]);
  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    whatsapp: false,
    telegram: false,
  });
  const [preferredLanguage, setPreferredLanguage] = useState('en');
  const [savedJobs, setSavedJobs] = useState([]);
  const [savedScholarships, setSavedScholarships] = useState([]);
  const [savedAdmissions, setSavedAdmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [messageSuccess, setMessageSuccess] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [resendingVerify, setResendingVerify] = useState(false);

  useEffect(() => {
    authApi
      .getProfile()
      .then(({ data }) => {
        const u = data.user;
        setName(u.name || '');
        setCountryCode(u.countryCode || '');
        setRegion(u.region || u.province || '');
        setCity(u.city || '');
        setInterests(Array.isArray(u.interests) ? [...u.interests] : []);
        if (u.notifications) {
          setNotifications((n) => ({
            ...n,
            email: u.notifications.email ?? true,
            push: u.notifications.push ?? false,
            whatsapp: u.notifications.whatsapp ?? false,
            telegram: u.notifications.telegram ?? false,
          }));
        }
        const lang = u.preferredLanguage || 'en';
        setPreferredLanguage(lang);
        setLang(lang, { persistProfile: false });
      })
      .catch(() => {
        setMessage(t('profile:couldNotLoad'));
        setMessageSuccess(false);
      })
      .finally(() => setLoading(false));

    savedApi.get().then(({ data }) => {
      setSavedJobs(data.savedJobs || []);
      setSavedScholarships(data.savedScholarships || []);
      setSavedAdmissions(data.savedAdmissions || []);
    }).catch(() => {});
  }, [setLang]);

  useEffect(() => {
    if (loading) return;
    if (location.hash !== '#account-settings') return;
    const el = document.getElementById('account-settings');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [loading, location.hash]);

  useEffect(() => {
    if (loading) return;
    if (searchParams.get('section') !== 'career-preferences') return;
    if (careerWizardOpenRef.current) return;
    careerWizardOpenRef.current = true;

    const closeWizardSection = () => {
      const next = new URLSearchParams(searchParams);
      next.delete('section');
      setSearchParams(next, { replace: true });
    };

    openProfilingWizard({
      initialPrefs: user?.careerPreferences || undefined,
      initialStep: 1,
      editMode: true,
    })
      .then(async ({ prefs, action }) => {
        if (action === 'cancel') return;
        try {
          const { data } = await authApi.updateProfile({ careerPreferences: prefs });
          if (data?.user) updateUser(data.user);
          setMessage(t('profile:updated'));
          setMessageSuccess(true);
        } catch (err) {
          setMessage(err.response?.data?.error || t('profile:failedUpdate'));
          setMessageSuccess(false);
        }
      })
      .finally(() => {
        careerWizardOpenRef.current = false;
        closeWizardSection();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, searchParams]);

  const toggleInterest = (item) => {
    setInterests((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const { data } = await authApi.updateProfile({
        name,
        countryCode,
        region,
        city,
        province: region,
        interests,
        notifications,
        preferredLanguage,
      });
      updateUser(data.user);
      setLang(preferredLanguage, { persistProfile: false });
      setMessage(t('profile:updated'));
      setMessageSuccess(true);
    } catch (err) {
      setMessage(err.response?.data?.error || t('profile:failedUpdate'));
      setMessageSuccess(false);
    } finally {
      setSaving(false);
    }
  };

  const notifOptions = [{ key: 'email', label: t('profile:emailNotif') }];

  const handleResendVerification = async () => {
    setResendingVerify(true);
    setMessage(null);
    try {
      const { data } = await authApi.resendVerification(user?.email);
      const notice = data.emailNotice ? ` ${data.emailNotice}` : '';
      setMessage(`${t('profile:verificationSent', { defaultValue: 'Verification email sent' })}${notice}`);
      setMessageSuccess(true);
    } catch (err) {
      setMessage(err.response?.data?.error || t('profile:verificationFailed', { defaultValue: 'Could not send verification email' }));
      setMessageSuccess(false);
    } finally {
      setResendingVerify(false);
    }
  };

  if (loading) {
    return (
      <>
        <SeoHead title={t('profile:seoTitle')} description={t('profile:seoDescription')} noindex />
        <div className="max-w-2xl mx-auto px-4 py-12 flex justify-center">
          <div className="animate-pulse text-gray-500 dark:text-gray-400">{t('common:loadingProfile')}</div>
        </div>
      </>
    );
  }

  return (
    <>
      <SeoHead title={t('profile:seoTitle')} description={t('profile:seoDescription')} noindex />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">{t('profile:title')}</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">{t('profile:subtitle')}</p>

        <div className="space-y-4 mb-8">
          <ProfileCompletionCard />
          <ResumeEncouragementBanner />
        </div>

        {message && (
          <Alert variant={messageSuccess ? 'success' : 'error'} className="mb-6">
            {message}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 space-y-2">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('profile:accountEmail', { defaultValue: 'Account email' })}</h2>
            <p id="profile-email-display" className="text-gray-700 dark:text-gray-300">{user?.email}</p>
            <div className="flex flex-wrap items-center gap-2">
              {user?.emailVerified ? (
                <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">
                  {t('profile:emailVerified', { defaultValue: 'Verified' })}
                </span>
              ) : (
                <>
                  <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                    {t('profile:emailNotVerified', { defaultValue: 'Not verified' })}
                  </span>
                  <Button type="button" variant="secondary" disabled={resendingVerify} onClick={handleResendVerification}>
                    {resendingVerify ? t('common:sending', { defaultValue: 'Sending…' }) : t('profile:resendVerification', { defaultValue: 'Resend verification' })}
                  </Button>
                </>
              )}
            </div>
          </div>

          <FormField label={t('common:name')} id="profile-name">
            <input
              id="profile-name"
              name="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:ring-2 focus:ring-primary outline-none"
            />
          </FormField>

          <div>
            <p className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location</p>
            <LocationCascadeFilter
              countryCode={countryCode}
              region={region}
              city={city}
              allowAllCountries={false}
              onChange={({ countryCode: nextCountry, region: nextRegion, city: nextCity }) => {
                setCountryCode(nextCountry || '');
                setRegion(nextRegion || '');
                setCity(nextCity || '');
              }}
            />
            <p className="mt-1 min-h-[1.25rem] text-xs text-gray-500 dark:text-gray-400">
              Country, region/state/province, and city. Country is not assumed.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('profile:interestsHelp')}
            </label>
            <div className="flex flex-wrap gap-2">
              {INTEREST_CATEGORIES.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggleInterest(item)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition ${
                    interests.includes(item)
                      ? 'bg-primary text-white border-primary dark:bg-primary dark:border-primary'
                      : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-primary'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <FormField label={t('common:preferredLanguage')} id="profile-lang">
            <select
              id="profile-lang"
              name="preferredLanguage"
              value={preferredLanguage}
              onChange={(e) => setPreferredLanguage(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
            >
              <option value="en">{t('common:english')}</option>
              <option value="ur">{t('common:urdu')}</option>
            </select>
          </FormField>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              {t('common:notificationPreferences')}
            </label>
            <div className="space-y-2">
              {notifOptions.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2">
                  <input
                    id={`profile-notif-${key}`}
                    name={`notifications.${key}`}
                    type="checkbox"
                    checked={notifications[key]}
                    onChange={(e) =>
                      setNotifications((n) => ({ ...n, [key]: e.target.checked }))
                    }
                    className="rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary"
                  />
                  <span className="text-gray-700 dark:text-gray-300">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <Button type="submit" disabled={saving}>
            {saving ? t('common:saving') : t('common:saveProfile')}
          </Button>
        </form>

        <section id="account-settings" className="mt-10 pt-8 border-t border-gray-200 dark:border-gray-700 scroll-mt-24">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t('profile:changePassword', { defaultValue: 'Change password' })}</h2>
          {user?.mustChangePassword && (
            <Alert variant="warning" className="mb-4">
              {t('profile:mustChangePassword', { defaultValue: 'You must change your temporary password before continuing.' })}
            </Alert>
          )}
          <ChangePasswordForm
            busy={changingPassword}
            successMessage={messageSuccess && message && changingPassword === false ? '' : ''}
            errorMessage={!messageSuccess && message ? message : ''}
            onSubmit={async ({ currentPassword: current, newPassword: next }) => {
              setChangingPassword(true);
              setMessage(null);
              try {
                await authApi.changePassword({ currentPassword: current, newPassword: next });
                setMessage(t('profile:passwordChanged', { defaultValue: 'Password changed. Other sessions were signed out.' }));
                setMessageSuccess(true);
                if (user) updateUser({ ...user, mustChangePassword: false });
              } catch (err) {
                setMessage(err.response?.data?.error || t('profile:passwordChangeFailed', { defaultValue: 'Could not change password' }));
                setMessageSuccess(false);
              } finally {
                setChangingPassword(false);
              }
            }}
          />
          <div className="mt-6 space-y-3">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              {t('profile:sessionsTitle', { defaultValue: 'Sessions' })}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('profile:sessionsHelp', {
                defaultValue: 'Refresh cookies stay HttpOnly. Session identifiers are not displayed.',
              })}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button type="button" onClick={() => logout()}>
                {t('common:logout')}
              </Button>
              <Button type="button" variant="outline" onClick={() => logoutAll()}>
                {t('profile:logoutAll', { defaultValue: 'Log out of all sessions' })}
              </Button>
            </div>
          </div>
          <div className="mt-8">
            <ConnectedAccountsPanel />
          </div>
        </section>

        <section className="mt-10 pt-8 border-t border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{t('common:savedJobs')}</h2>
          {savedJobs.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              <Trans
                i18nKey="profile:saveJobsEmpty"
                components={{ link: <Link to={ROUTES.JOBS} className="text-primary dark:text-mint hover:underline" /> }}
              />
            </p>
          ) : (
            <ul className="space-y-2">
              {savedJobs.map((j) => (
                <li key={j._id}>
                  {j.unavailable ? (
                    <span className="text-gray-500 dark:text-gray-400">No longer available</span>
                  ) : (
                    <>
                      <Link to={`${ROUTES.JOBS}/${j.slug || j._id}`} className="text-gray-700 dark:text-gray-300 hover:text-primary dark:hover:text-mint">{j.title}</Link>
                      {j.deadline && <span className="text-xs text-gray-500 ml-2">({formatDate(j.deadline)})</span>}
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{t('common:savedScholarships')}</h2>
          {savedScholarships.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              <Trans
                i18nKey="profile:saveScholarshipsEmpty"
                components={{ link: <Link to={ROUTES.SCHOLARSHIPS} className="text-primary dark:text-mint hover:underline" /> }}
              />
            </p>
          ) : (
            <ul className="space-y-2">
              {savedScholarships.map((s) => (
                <li key={s._id}>
                  <Link to={`${ROUTES.SCHOLARSHIPS}/${s.slug || s._id}`} className="text-gray-700 dark:text-gray-300 hover:text-primary dark:hover:text-mint">{s.title}</Link>
                  {s.deadline && <span className="text-xs text-gray-500 ml-2">({formatDate(s.deadline)})</span>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{t('common:savedAdmissions')}</h2>
          {savedAdmissions.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              <Trans
                i18nKey="profile:saveAdmissionsEmpty"
                components={{ link: <Link to={ROUTES.ADMISSIONS} className="text-primary dark:text-mint hover:underline" /> }}
              />
            </p>
          ) : (
            <ul className="space-y-2">
              {savedAdmissions.map((a) => (
                <li key={a._id}>
                  <Link to={`${ROUTES.ADMISSIONS}/${a.slug || a._id}`} className="text-gray-700 dark:text-gray-300 hover:text-primary dark:hover:text-mint">{a.program} – {a.institution}</Link>
                  {a.deadline && <span className="text-xs text-gray-500 ml-2">({formatDate(a.deadline)})</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
