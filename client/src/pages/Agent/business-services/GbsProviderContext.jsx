import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { gbsProviderApi } from '../../../services/gbsProviderApi';

const PREF_KEY = 'strideto-gbs-provider-subject';
const GbsCtx = createContext(null);

function prefKey(subject) {
  return `${subject.subjectType}:${subject.subjectId}`;
}

function readPref() {
  try {
    return localStorage.getItem(PREF_KEY) || '';
  } catch {
    return '';
  }
}

function writePref(subject) {
  try {
    localStorage.setItem(PREF_KEY, prefKey(subject));
  } catch {
    /* preference is UX only */
  }
}

export function GbsProviderContextProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [enabled, setEnabled] = useState(false);
  const [subjects, setSubjects] = useState([]);
  const [selected, setSelected] = useState(null);
  const [catalog, setCatalog] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ data: ctx }, { data: cat }] = await Promise.all([
        gbsProviderApi.getContext(),
        gbsProviderApi.getCatalog(),
      ]);
      const nextSubjects = Array.isArray(ctx.subjects) ? ctx.subjects : [];
      setEnabled(ctx.enabled === true);
      setSubjects(nextSubjects);
      setCatalog(cat);
      const pref = readPref();
      const fromPref = nextSubjects.find((s) => prefKey(s) === pref);
      const next = fromPref || nextSubjects[0] || null;
      setSelected(next);
      if (next) writePref(next);
    } catch (err) {
      const code = err.response?.data?.error || err.message || 'Unable to load Business Services';
      setError(code === 'business_services_feature_disabled' ? 'Business Services is not enabled.' : 'Unable to load Business Services.');
      setEnabled(false);
      setSubjects([]);
      setSelected(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selectSubject = useCallback((subject) => {
    const match = subjects.find(
      (s) => s.subjectType === subject.subjectType && String(s.subjectId) === String(subject.subjectId)
    );
    if (!match) return;
    setSelected(match);
    writePref(match);
  }, [subjects]);

  const value = useMemo(
    () => ({ loading, error, enabled, subjects, selected, catalog, selectSubject, reload: load }),
    [loading, error, enabled, subjects, selected, catalog, selectSubject, load]
  );

  return <GbsCtx.Provider value={value}>{children}</GbsCtx.Provider>;
}

export function useGbsProvider() {
  const ctx = useContext(GbsCtx);
  if (!ctx) throw new Error('useGbsProvider requires GbsProviderContextProvider');
  return ctx;
}
