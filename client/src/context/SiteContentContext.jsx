import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useLanguage } from './LanguageContext';
import { siteContentApi } from '../services/siteContentApi';

const SiteContentContext = createContext(null);

/** Force fallback UI if CMS never settles (slow network / hung request). */
const CMS_LOAD_TIMEOUT_MS = 10000;

async function fetchSettled(promise, mapData = (r) => r?.data ?? null) {
  try {
    const r = await promise;
    return { ok: true, data: mapData(r) };
  } catch {
    return { ok: false, data: null };
  }
}

export function SiteContentProvider({ children }) {
  const { lang } = useLanguage();
  const [homepage, setHomepage] = useState(null);
  const [headerNav, setHeaderNav] = useState(null);
  const [footerNav, setFooterNav] = useState(null);
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasResolved, setHasResolved] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const resolvedRef = useRef(false);
  const cacheRef = useRef({ homepage: null, headerNav: null, footerNav: null, banners: [] });

  const applyPayload = useCallback((hp, header, footer, bn, { failed }) => {
    const cache = cacheRef.current;
    const nextHomepage = hp.ok ? hp.data : (cache.homepage ?? null);
    const nextHeader = header.ok ? header.data : (cache.headerNav ?? null);
    const nextFooter = footer.ok ? footer.data : (cache.footerNav ?? null);
    const nextBanners = bn.ok ? (bn.data || []) : (cache.banners || []);

    if (hp.ok && hp.data) cache.homepage = hp.data;
    if (header.ok && header.data) cache.headerNav = header.data;
    if (footer.ok && footer.data) cache.footerNav = footer.data;
    if (bn.ok) cache.banners = bn.data || [];

    setHomepage(nextHomepage);
    setHeaderNav(nextHeader);
    setFooterNav(nextFooter);
    setBanners(nextBanners);
    setLoadFailed(failed);
    setHasResolved(true);
    resolvedRef.current = true;
    setLoading(false);
  }, []);

  const load = useCallback(async () => {
    const isInitial = !resolvedRef.current;
    if (isInitial) {
      setLoading(true);
    }

    let settled = false;
    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      // Timeout: keep any cached CMS; otherwise consumers may render i18n fallback.
      setLoadFailed(true);
      setHasResolved(true);
      resolvedRef.current = true;
      setLoading(false);
    }, CMS_LOAD_TIMEOUT_MS);

    try {
      const [hp, header, footer, bn] = await Promise.all([
        fetchSettled(siteContentApi.getHomepage(lang)),
        fetchSettled(siteContentApi.getNavigation(lang, 'header')),
        fetchSettled(siteContentApi.getNavigation(lang, 'footer')),
        fetchSettled(
          siteContentApi.getBanners(lang, 'homepage'),
          (r) => r?.data?.data || []
        ),
      ]);

      if (settled) {
        // Timed out already — still apply a successful late response so CMS wins over fallback.
        const anyOk = hp.ok || header.ok || footer.ok || bn.ok;
        if (anyOk) {
          applyPayload(hp, header, footer, bn, {
            failed: !(hp.ok || header.ok || footer.ok || bn.ok),
          });
        }
        return;
      }

      settled = true;
      const allFailed = !hp.ok && !header.ok && !footer.ok && !bn.ok;
      applyPayload(hp, header, footer, bn, { failed: allFailed });
    } finally {
      clearTimeout(timeoutId);
    }
  }, [lang, applyPayload]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SiteContentContext.Provider
      value={{
        homepage,
        headerNav,
        footerNav,
        banners,
        loading,
        hasResolved,
        loadFailed,
        reload: load,
      }}
    >
      {children}
    </SiteContentContext.Provider>
  );
}

export function useSiteContent() {
  const ctx = useContext(SiteContentContext);
  if (!ctx) {
    return {
      homepage: null,
      headerNav: null,
      footerNav: null,
      banners: [],
      loading: false,
      hasResolved: true,
      loadFailed: false,
      reload: () => {},
    };
  }
  return ctx;
}
