import { createContext, useContext, useEffect, useMemo, useState } from 'react';

export const THEME_STORAGE_KEY = 'edurozgaar-theme';
export const THEME_PREFERENCES = Object.freeze(['system', 'light', 'dark']);

const ThemeContext = createContext(null);

function readOsTheme() {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function normalizeThemePreference(value) {
  if (THEME_PREFERENCES.includes(value)) return value;
  return 'system';
}

export function ThemeProvider({ children }) {
  const [preference, setPreferenceState] = useState(() => {
    if (typeof window === 'undefined') return 'system';
    return normalizeThemePreference(localStorage.getItem(THEME_STORAGE_KEY));
  });
  const [osTheme, setOsTheme] = useState(readOsTheme);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => setOsTheme(mq.matches ? 'dark' : 'light');
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const resolvedTheme = preference === 'system' ? osTheme : preference;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(resolvedTheme);
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  }, [preference, resolvedTheme]);

  const value = useMemo(
    () => ({
      preference,
      theme: resolvedTheme,
      resolvedTheme,
      setPreference: (next) => {
        setPreferenceState(normalizeThemePreference(next));
      },
      setTheme: (next) => {
        if (typeof next === 'function') {
          setPreferenceState((prev) => {
            const current = prev === 'system' ? osTheme : prev;
            return normalizeThemePreference(next(current));
          });
          return;
        }
        setPreferenceState(normalizeThemePreference(next));
      },
      toggleTheme: () => {
        setPreferenceState(resolvedTheme === 'dark' ? 'light' : 'dark');
      },
    }),
    [preference, resolvedTheme, osTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
