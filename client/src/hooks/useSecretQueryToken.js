import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Read a one-time secret from the query string, keep it in memory, then
 * replace the URL so the secret is not left in history.
 */
export function useSecretQueryToken(param = 'token') {
  const [searchParams, setSearchParams] = useSearchParams();
  const [token] = useState(() => searchParams.get(param) || '');

  useEffect(() => {
    if (!searchParams.get(param) && !searchParams.get('email')) return;
    const next = new URLSearchParams(searchParams);
    next.delete(param);
    next.delete('email');
    setSearchParams(next, { replace: true });
  }, [param, searchParams, setSearchParams]);

  return token;
}
