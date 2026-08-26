import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import {
  LANG_STORAGE_KEY,
  NAMESPACES,
  DEFAULT_LANGUAGE,
  FALLBACK_LANGUAGE,
  getLanguageConfig,
  isLanguageEnabled,
} from './config.js';
import { allowsFunctional } from '../consent/cookieConsentStorage.js';

const loadedBundles = new Set();
let initPromise = null;

export async function loadNamespace(lng, ns) {
  const key = `${lng}:${ns}`;
  if (loadedBundles.has(key)) return;
  try {
    const mod = await import(`./locales/${lng}/${ns}.json`);
    i18n.addResourceBundle(lng, ns, mod.default, true, true);
    loadedBundles.add(key);
  } catch (err) {
    if (lng !== FALLBACK_LANGUAGE) {
      await loadNamespace(FALLBACK_LANGUAGE, ns);
    } else {
      console.warn(`Missing locale bundle: ${lng}/${ns}`, err);
    }
  }
}

export async function loadLanguage(lng) {
  const target = isLanguageEnabled(lng) ? lng : DEFAULT_LANGUAGE;
  await Promise.all(NAMESPACES.map((ns) => loadNamespace(target, ns)));
  return target;
}

const languageDetector = new LanguageDetector();
languageDetector.addDetector({
  name: 'edurozgaarProfile',
  lookup() {
    try {
      const user = localStorage.getItem('edurozgaar-user');
      if (user) {
        const parsed = JSON.parse(user);
        if (parsed?.preferredLanguage && isLanguageEnabled(parsed.preferredLanguage)) {
          return parsed.preferredLanguage;
        }
      }
    } catch {
      /* ignore */
    }
    return undefined;
  },
});

export function applyDocumentLanguage(lng) {
  const cfg = getLanguageConfig(lng);
  document.documentElement.lang = lng;
  document.documentElement.dir = cfg.dir;
  document.body.style.fontFamily = cfg.fontFamily;
  document.body.classList.toggle('font-urdu', lng === 'ur');
  document.body.classList.toggle('font-arabic', lng === 'ar');
}

export function initI18n() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    languageDetector.init({
      order: ['edurozgaarProfile', 'localStorage', 'querystring', 'navigator'],
      lookupLocalStorage: LANG_STORAGE_KEY,
      lookupQuerystring: 'lang',
      caches: ['localStorage'],
    });

    const initialLng = languageDetector.detect() || DEFAULT_LANGUAGE;
    const bootLng = isLanguageEnabled(initialLng) ? initialLng : DEFAULT_LANGUAGE;

    await i18n.use(languageDetector).use(initReactI18next).init({
      lng: bootLng,
      fallbackLng: FALLBACK_LANGUAGE,
      supportedLngs: ['en', 'ur', 'ar'],
      ns: NAMESPACES,
      defaultNS: 'common',
      interpolation: { escapeValue: false },
      react: { useSuspense: false },
      returnEmptyString: false,
      returnNull: false,
    });

    await loadLanguage(bootLng);
    applyDocumentLanguage(i18n.language);

    i18n.on('languageChanged', (lng) => {
      applyDocumentLanguage(lng);
      if (allowsFunctional()) localStorage.setItem(LANG_STORAGE_KEY, lng);
    });

    return i18n;
  })();

  return initPromise;
}

export default i18n;
