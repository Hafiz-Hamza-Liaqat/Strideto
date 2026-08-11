export const LANG_STORAGE_KEY = 'edurozgaar-lang';

export const NAMESPACES = [
  'common',
  'navbar',
  'footer',
  'home',
  'jobs',
  'scholarships',
  'admissions',
  'internships',
  'exams',
  'resume',
  'profile',
  'dashboard',
  'employer',
  'admin',
  'blog',
  'career',
  'chatbot',
  'forms',
  'notifications',
  'validation',
  'seo',
  'static',
  'profiles',
  'talent',
  'applications',
  'student',
  'assessments',
  'timeline',
  'documents-platform',
];

/** All supported languages — add new entries here only; no hardcoded language lists elsewhere */
export const LANGUAGES = [
  {
    code: 'en',
    label: 'EN',
    name: 'English',
    dir: 'ltr',
    locale: 'en-PK',
    ogLocale: 'en_PK',
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    enabled: true,
  },
  {
    code: 'ur',
    label: 'UR',
    name: 'Urdu',
    dir: 'rtl',
    locale: 'ur-PK',
    ogLocale: 'ur_PK',
    fontFamily: "'Noto Nastaliq Urdu', 'Inter', serif",
    enabled: true,
  },
  {
    code: 'ar',
    label: 'AR',
    name: 'Arabic',
    dir: 'rtl',
    locale: 'ar-SA',
    ogLocale: 'ar_SA',
    fontFamily: "'Noto Sans Arabic', system-ui, sans-serif",
    enabled: false,
  },
];

export const DEFAULT_LANGUAGE = 'en';
export const FALLBACK_LANGUAGE = 'en';

export function getLanguageConfig(code) {
  return LANGUAGES.find((l) => l.code === code) || LANGUAGES[0];
}

export function isRtlLanguage(code) {
  return getLanguageConfig(code).dir === 'rtl';
}

export function isLanguageEnabled(code) {
  const lang = LANGUAGES.find((l) => l.code === code);
  return Boolean(lang?.enabled);
}

export function getEnabledLanguages() {
  return LANGUAGES.filter((l) => l.enabled);
}
