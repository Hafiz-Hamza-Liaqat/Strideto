import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { validateTalentProfileInput } from '@shared/career/validation.js';
import { SeoHead } from '../../components/seo';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { talentApi } from '../../services/talentApi';
import { Button } from '../../components/common/Button';
import { isTalentProfileEnabled } from '../../config/careerFeatureFlags';
import {
  PROFILE_TABS,
  defaultFormState,
  profileToForm,
  formToProfilePayload,
} from './talentProfileMapper';
import { TalentProfileForm } from './TalentProfileForm';
import { CareerOnboardingBanner } from './CareerOnboardingBanner';
import { ResumeVersionsPanel } from './ResumeVersionsPanel';
import { DocumentsPanel } from './DocumentsPanel';
import { SkillClaimManager } from '../../components/skills/SkillClaimManager';

export default function TalentProfileEditor() {
  const { t } = useTranslation(['talent', 'common']);
  const { user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState(() => defaultFormState(user?.email));
  const [activeTab, setActiveTab] = useState('personal');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [fieldError, setFieldError] = useState('');

  const loadProfile = useCallback(() => {
    setLoading(true);
    talentApi
      .getMe()
      .then(({ data }) => {
        setForm(profileToForm(data, user?.email));
        setProfileLoaded(true);
      })
      .catch(() => toast.error(t('talent:loadError')))
      .finally(() => setLoading(false));
  }, [t, toast, user?.email]);

  useEffect(() => {
    if (!isTalentProfileEnabled()) {
      setLoading(false);
      return;
    }
    loadProfile();
  }, [loadProfile]);

  const handleSave = async () => {
    const payload = formToProfilePayload(form);
    const errors = validateTalentProfileInput(payload, { partial: true });
    if (!payload.displayName?.trim()) {
      setFieldError(t('talent:validation.firstNameRequired'));
      setActiveTab('personal');
      return;
    }
    if (errors.length) {
      setFieldError(errors[0]);
      return;
    }
    setFieldError('');
    setSaving(true);
    try {
      await talentApi.updateMe(payload);
      toast.success(t('talent:saved'));
      setProfileLoaded(true);
    } catch {
      toast.error(t('talent:saveError'));
    } finally {
      setSaving(false);
    }
  };

  if (!isTalentProfileEnabled()) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <SeoHead title={t('talent:title')} noindex />
        <p role="alert">{t('talent:featureDisabled', { defaultValue: 'Talent profile is disabled.' })}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12 text-center text-gray-500">
        {t('common:loading')}
      </div>
    );
  }

  return (
    <>
      <SeoHead title={t('talent:title')} description={t('talent:subtitle')} />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 md:py-8 min-w-0 w-full">
        <header className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">{t('talent:title')}</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400 max-w-3xl">{t('talent:subtitle')}</p>
        </header>

        <CareerOnboardingBanner profileLoaded={profileLoaded} form={form} />

        <div className="flex flex-col lg:flex-row gap-6">
          <nav
            className="lg:w-56 shrink-0 flex lg:flex-col gap-2 overflow-x-auto scroll-tabs pb-2 lg:pb-0"
            aria-label={t('talent:title')}
          >
            {PROFILE_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`shrink-0 min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium text-left transition-colors ${
                  activeTab === tab
                    ? 'bg-primary text-white'
                    : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
                aria-current={activeTab === tab ? 'page' : undefined}
              >
                {t(`talent:tabs.${tab}`)}
              </button>
            ))}
          </nav>

          <div className="flex-1 min-w-0 space-y-4">
            {fieldError && (
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                {fieldError}
              </p>
            )}

            {activeTab === 'resumes' ? (
              <ResumeVersionsPanel profileLoaded={profileLoaded} form={form} />
            ) : activeTab === 'documents' ? (
              <DocumentsPanel profileLoaded={profileLoaded} />
            ) : (
              <TalentProfileForm form={form} setForm={setForm} activeTab={activeTab} />
            )}

            {/*
              Evidence-backed skills live alongside the self-reported skill list,
              deliberately: the profile field is what the applicant says, this is
              what they can show for it. Kept a separate surface because it saves
              through its own audited endpoints, not through `handleSave`.
            */}
            {activeTab === 'skills' && (
              <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                <SkillClaimManager />
              </div>
            )}

            {activeTab !== 'resumes' && activeTab !== 'documents' && (
              <div className="sticky bottom-4 z-10 flex justify-end">
                <Button type="button" onClick={handleSave} disabled={saving} className="shadow-lg">
                  {saving ? t('talent:saving') : t('talent:save')}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
