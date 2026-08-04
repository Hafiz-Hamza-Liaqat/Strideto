import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { employerApi } from '../services/employerService';
import { DEFAULT_EMPLOYER_DASHBOARD_LAYOUT } from './widgetRegistry';

/**
 * Single composition fetch — widgets stay presentational (no per-widget API).
 * Freshness contract mirrors EmployerDashboard.jsx: initial load, then a
 * background refresh on window focus and on visibility restoration, guarded
 * by a single in-flight request so simultaneous focus+visibility events
 * never overlap and a background failure never clears already-rendered data.
 */
export function useEmployerDashboardComposition() {
  const { t } = useTranslation(['employer']);
  const [composition, setComposition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mountedRef = useRef(false);
  const inFlightRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;

    const loadComposition = ({ background = false } = {}) => {
      if (document.hidden) return;
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      if (!background) setLoading(true);

      employerApi
        .intelligenceDashboard()
        .then(({ data }) => {
          if (!mountedRef.current) return;
          setComposition(data);
          setError(null);
        })
        .catch((err) => {
          if (!mountedRef.current) return;
          if (!background) {
            setError(err.response?.data?.error || t('employer:intelligenceLoadFailed'));
            setComposition({ layout: DEFAULT_EMPLOYER_DASHBOARD_LAYOUT, widgets: {}, flags: {} });
          }
          // Background refresh failure: keep whatever composition is already rendered.
        })
        .finally(() => {
          inFlightRef.current = false;
          if (mountedRef.current && !background) setLoading(false);
        });
    };

    loadComposition({ background: false });

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') loadComposition({ background: true });
    };
    const handleFocus = () => loadComposition({ background: true });

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);

    return () => {
      mountedRef.current = false;
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
    };
  }, [t]);

  return { composition, loading, error };
}
