import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { collectionSeoHeadProps } from '@shared/seo/collectionSeoPolicy.js';

/**
 * SEO-P3 collection route helper — derives canonical/noindex from URL query state.
 */
export function useCollectionSeo(cleanPath, { defaultSort = 'newest' } = {}) {
  const location = useLocation();
  return useMemo(
    () => collectionSeoHeadProps({
      cleanPath,
      searchParams: location.search,
      defaultSort,
    }),
    [cleanPath, location.search, defaultSort]
  );
}

export { collectionSeoHeadProps } from '@shared/seo/collectionSeoPolicy.js';
