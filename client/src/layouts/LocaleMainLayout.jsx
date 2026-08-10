import { useEffect } from 'react';
import { Outlet, useParams, Navigate } from 'react-router-dom';
import { isContentLocaleEnabled } from '@shared/localization/localeConfig.js';
import { DEFAULT_LOCALE } from '@shared/localization/localeConfig.js';
import { useLanguage } from '../context/LanguageContext';
import { MainLayout } from './MainLayout';

/**
 * Syncs URL locale prefix with LanguageContext (C.7.0.8).
 */
export function LocaleMainLayout({ invalidElement = null, locale: localeProp = null }) {
  const { locale: routeLocale } = useParams();
  const locale = localeProp || routeLocale;
  const { setLang } = useLanguage();

  useEffect(() => {
    if (locale && isContentLocaleEnabled(locale)) {
      setLang(locale, { persistProfile: false });
    }
  }, [locale, setLang]);

  if (!locale || !isContentLocaleEnabled(locale)) {
    return invalidElement ? <MainLayout>{invalidElement}</MainLayout> : <Navigate to="/" replace />;
  }

  if (locale === DEFAULT_LOCALE) {
    return <Navigate to="/" replace />;
  }

  return <MainLayout><Outlet /></MainLayout>;
}
