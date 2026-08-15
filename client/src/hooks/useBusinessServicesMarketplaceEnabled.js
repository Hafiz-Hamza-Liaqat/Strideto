import { useEffect, useState } from 'react';
import { gbsMarketplaceApi } from '../services/gbsMarketplaceApi';

export function useBusinessServicesMarketplaceEnabled() {
  const [enabled, setEnabled] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    gbsMarketplaceApi
      .enabled()
      .then(({ data }) => {
        if (!cancelled) setEnabled(data?.enabled === true);
      })
      .catch(() => {
        if (!cancelled) {
          setEnabled(false);
          setError('unavailable');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { enabled, loading: enabled === null, error };
}
