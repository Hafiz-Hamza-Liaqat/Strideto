import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { authApi } from '../../services/authService';
import { savedApi } from '../../services/listingsService';
import { PROVINCES, INTEREST_CATEGORIES } from '../../constants/profileOptions';
import { Button } from '../../components/common/Button';
import { FormField } from '../../components/common/FormField';
import { Alert } from '../../components/ui/Alerts';
import { ROUTES } from '../../constants';
import { formatDate } from '../../utils/formatDate';
import { SeoHead } from '../../components/seo';
import { ProfileCompletionCard } from '../../components/profile/ProfileCompletionCard';
import { ResumeEncouragementBanner } from '../../components/profile/ResumeEncouragementBanner';

export default function Profile() {
  const { t } = useTranslation(['profile', 'common']);
  const { user, updateUser } = useAuth();
  const { setLang } = useLanguage();
  const [name, setName] = useState('');
  const [province, setProvince] = useState('');
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
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [resendingVerify, setResendingVerify] = useState(false);

  useEffect(() => {
    authApi
      .getProfile()
      .then(({ data }) => {
        const u = data.user;
        setName(u.name || '');
        setProvince(u.province || '');
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
        province,
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

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmNewPassword) {
      setMessage(t('profile:passwordMismatch', { defaultValue: 'Passwords do not match' }));
      setMessageSuccess(false);
      return;
    }
    setChangingPassword(true);
    setMessage(null);
    try {
      await authApi.changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setMessage(t('profile:passwordChanged', { defaultValue: 'Password changed successfully' }));
      setMessageSuccess(true);
      updateUser({ ...user, mustChangePassword: false });
    } catch (err) {
      setMessage(err.response?.data?.error || t('profile:passwordChangeFailed', { defaultValue: 'Could not change password' }));
      setMessageSuccess(false);
    } finally {
      setChangingPassword(false);
    }
  };

  const handleResendVerification = async () => {
    setResendingVerify(true);
    setMessage(null);
    try {
      const { data } = await authApi.resendVerification();
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

          <FormField label={t('common:province')} id="profile-province">
            <select
              id="profile-province"
              name="province"
              value={province}
              onChange={(e) => setProvince(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
            >
              <option value="">{t('profile:selectProvince')}</option>
              {PROVINCES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </FormField>

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

        <section className="mt-10 pt-8 border-t border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t('profile:changePassword', { defaultValue: 'Change password' })}</h2>
          {user?.mustChangePassword && (
            <Alert variant="warning" className="mb-4">
              {t('profile:mustChangePassword', { defaultValue: 'You must change your temporary password before continuing.' })}
            </Alert>
          )}
          <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
            <FormField label={t('profile:currentPassword', { defaultValue: 'Current password' })} id="profile-current-password">
              <input
                id="profile-current-password"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
              />
            </FormField>
            <FormField label={t('profile:newPassword', { defaultValue: 'New password' })} id="profile-new-password">
              <input
                id="profile-new-password"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
              />
            </FormField>
            <FormField label={t('profile:confirmNewPassword', { defaultValue: 'Confirm new password' })} id="profile-confirm-password">
              <input
                id="profile-confirm-password"
                name="confirmNewPassword"
                type="password"
                autoComplete="new-password"
                required
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
              />
            </FormField>
            <Button type="submit" disabled={changingPassword}>
              {changingPassword ? t('common:saving') : t('profile:updatePassword', { defaultValue: 'Update password' })}
            </Button>
          </form>
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
                  <Link to={`${ROUTES.JOBS}/${j.slug || j._id}`} className="text-gray-700 dark:text-gray-300 hover:text-primary dark:hover:text-mint">{j.title}</Link>
                  {j.deadline && <span className="text-xs text-gray-500 ml-2">({formatDate(j.deadline)})</span>}
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
