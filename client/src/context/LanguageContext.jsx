import { createContext, useContext, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import i18n, { loadLanguage } from '../i18n/index.js';
import { isLanguageEnabled, getLanguageConfig, DEFAULT_LANGUAGE } from '../i18n/config.js';
import { useAuth } from './AuthContext.jsx';
import { authApi } from '../services/authService.js';
import axiosInstance from '../services/axiosBase.js';
import { allowsFunctional } from '../consent/cookieConsentStorage.js';

const LanguageContext = createContext(null);

/** Map legacy dot keys (nav.jobs) to i18next namespace keys */
function resolveLegacyKey(key) {
  if (!key || typeof key !== 'string') return { ns: 'common', key };
  if (key.includes(':')) {
    const [ns, k] = key.split(':');
    return { ns, key: k };
  }
  const dot = key.indexOf('.');
  if (dot === -1) return { ns: 'common', key };
  const ns = key.slice(0, dot);
  const rest = key.slice(dot + 1);
  const nsMap = { nav: 'navbar' };
  return { ns: nsMap[ns] || ns, key: rest };
}

export function LanguageProvider({ children }) {
  const { user, isAuthenticated, updateUser } = useAuth();
  const { t: i18nT } = useTranslation();
  const prevUserIdRef = useRef(null);

  const lang = (i18n.language || DEFAULT_LANGUAGE).split('-')[0];
  const dir = getLanguageConfig(lang).dir;

  const setLang = useCallback(async (next, { persistProfile = true } = {}) => {
    if (!isLanguageEnabled(next)) return;
    await loadLanguage(next);
    await i18n.changeLanguage(next);
    if (allowsFunctional()) localStorage.setItem('edurozgaar-lang', next);
    if (persistProfile && isAuthenticated) {
      authApi.updateProfile({ preferredLanguage: next }).then(({ data }) => {
        updateUser(data.user);
      }).catch(() => {});
    }
  }, [isAuthenticated, updateUser]);

  useEffect(() => {
    if (user?._id && String(user._id) !== prevUserIdRef.current) {
      prevUserIdRef.current = String(user._id);
      if (user.preferredLanguage && isLanguageEnabled(user.preferredLanguage)) {
        setLang(user.preferredLanguage, { persistProfile: false });
      }
    }
    if (!user) prevUserIdRef.current = null;
  }, [user, setLang]);

  const t = useCallback(
    (key, options) => {
      const { ns, key: k } = resolveLegacyKey(key);
      const result = i18nT(k, { ns, ...options });
      if (result === k && ns !== 'common') {
        return i18nT(k, { ns: 'common', ...options });
      }
      return result;
    },
    [i18nT]
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlLang = params.get('lang');
    if (urlLang && isLanguageEnabled(urlLang) && urlLang !== lang) {
      setLang(urlLang);
    }
  }, [lang, setLang]);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    axiosInstance.defaults.headers.common['Accept-Language'] = lang;
  }, [lang, dir]);

  const value = {
    lang,
    setLang,
    t,
    dir,
    locale: getLanguageConfig(lang).locale,
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    return {
      lang: DEFAULT_LANGUAGE,
      setLang: () => {},
      t: (k) => k,
      dir: 'ltr',
      locale: 'en-PK',
    };
  }
  return ctx;
}

export { i18n };
