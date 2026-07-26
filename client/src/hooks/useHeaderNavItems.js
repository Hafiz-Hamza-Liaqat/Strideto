import { useMemo } from 'react';
import { useSiteContent } from '../context/SiteContentContext';
import { useLanguage } from '../context/LanguageContext';
import { normalizeCmsNavItems, resolveCmsLabel } from '../utils/cmsNav';
import { isCorruptCmsNav } from '../utils/cmsCorruption';

/**
 * CMS-first header nav items with i18n fallback.
 * Returns null while the initial CMS request is in flight (callers should show a stable shell).
 */
export function useHeaderNavItems(fallbackItems, labelFn) {
  const { headerNav, hasResolved } = useSiteContent();
  const { lang } = useLanguage();

  return useMemo(() => {
    if (!hasResolved) return null;

    const cmsItems = headerNav?.items?.length && !isCorruptCmsNav(headerNav.items)
      ? headerNav.items
      : null;

    if (!cmsItems?.length) {
      return fallbackItems.map((item) => ({
        ...item,
        label: labelFn(item.labelKey),
        mega: item.mega?.map((sub) => ({ ...sub, label: labelFn(sub.labelKey) })),
      }));
    }
    return normalizeCmsNavItems(cmsItems).map((item) => ({
      label: resolveCmsLabel(item, lang),
      path: item.path,
      external: item.external,
      icon: item.icon,
      mega: item.children?.length
        ? item.children.map((c) => ({
            label: resolveCmsLabel(c, lang),
            path: c.path,
            external: c.external,
          }))
        : undefined,
    }));
  }, [headerNav, lang, fallbackItems, labelFn, hasResolved]);
}
