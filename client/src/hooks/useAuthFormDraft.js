import { useEffect, useRef } from 'react';

const DRAFT_PREFIX = 'strideto-auth-draft:';

function sanitizeDraft(value) {
  if (!value || typeof value !== 'object') return {};
  const out = {};
  for (const [key, val] of Object.entries(value)) {
    if (/password|token|turnstile|secret|refresh|access/i.test(key)) continue;
    if (typeof val === 'string' || typeof val === 'boolean') out[key] = val;
  }
  return out;
}

export function clearAuthFormDraft(realm) {
  try {
    sessionStorage.removeItem(`${DRAFT_PREFIX}${realm}`);
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * Persist non-sensitive auth-form fields across SPA Terms/Privacy navigation.
 * Never stores passwords or tokens.
 */
export function useAuthFormDraft(realm, snapshot, applySafe) {
  const key = `${DRAFT_PREFIX}${realm}`;
  const hydrated = useRef(false);
  const applyRef = useRef(applySafe);
  applyRef.current = applySafe;

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return;
      const safe = sanitizeDraft(JSON.parse(raw));
      if (Object.keys(safe).length) applyRef.current(safe);
    } catch {
      /* ignore */
    }
  }, [key]);

  const serialized = JSON.stringify(sanitizeDraft(snapshot));
  useEffect(() => {
    if (!hydrated.current) return;
    try {
      sessionStorage.setItem(key, serialized);
    } catch {
      /* ignore */
    }
  }, [key, serialized]);
}
