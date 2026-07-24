import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { LANGUAGES } from '../../i18n/config.js';
import { useLanguage } from '../../context/LanguageContext';
import { localizedPathFor } from '../../utils/localeNavigation';

export function LanguageSwitcher({ className = '' }) {
  const { lang, setLang } = useLanguage();
  const { t } = useTranslation('navbar');
  const navigate = useNavigate();
  const location = useLocation();

  const handleChange = (code) => {
    const target = LANGUAGES.find((l) => l.code === code);
    if (!target?.enabled) return;
    const nextPath = localizedPathFor(location.pathname, code);
    setLang(code, { persistProfile: true });
    if (nextPath !== location.pathname) {
      navigate(nextPath);
    }
  };

  return (
    <div
      className={`flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden ${className}`}
      role="group"
      aria-label={t('languageSwitcher')}
    >
      {LANGUAGES.map(({ code, label, enabled }) => (
        <button
          key={code}
          type="button"
          disabled={!enabled}
          title={!enabled ? t('arabicComingSoon') : undefined}
          onClick={() => handleChange(code)}
          className={`min-w-[44px] min-h-[44px] sm:px-2.5 flex items-center justify-center text-xs sm:text-sm transition-colors ${
            lang === code
              ? 'bg-mint/30 dark:bg-mint/20 text-primary dark:text-mint'
              : enabled
                ? 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                : 'text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50'
          }`}
          aria-label={
            code === 'en'
              ? t('switchToEnglish')
              : code === 'ur'
                ? t('switchToUrdu')
                : t('switchToArabic')
          }
          aria-pressed={lang === code}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function useAppTranslation(namespaces = ['common']) {
  return useTranslation(namespaces);
}
