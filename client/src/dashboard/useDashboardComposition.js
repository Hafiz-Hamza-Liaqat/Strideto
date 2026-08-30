import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { careerDashboardApi } from '../services/careerDashboardApi';
import { DEFAULT_DASHBOARD_LAYOUT } from './widgetRegistry';

/**
 * Fetches dashboard composition from server — single request, no per-widget queries.
 */
export function useDashboardComposition() {
  const { t } = useTranslation(['dashboard']);
  const { isAuthenticated, hasStudentCapability: studentCapable, loading: authLoading } = useAuth();
  const [composition, setComposition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!isAuthenticated || authLoading || !studentCapable) {
      setComposition(null);
      setError(null);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    setError(null);

    careerDashboardApi
      .get()
      .then(({ data }) => {
        if (!cancelled) setComposition(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.response?.data?.error || t('dashboard:failedLoad'));
          setComposition({
            layout: DEFAULT_DASHBOARD_LAYOUT,
            widgets: {},
            meta: { flags: {} },
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [t, isAuthenticated, authLoading, studentCapable]);

  return { composition, loading, error };
}
