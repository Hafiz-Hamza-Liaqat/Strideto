import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';
import { ROUTES } from '../../constants';
import { SITE_URL } from '../../seo/config';
import { NewsletterSubscribe } from '../newsletter/NewsletterSubscribe';
import { useSiteContent } from '../../context/SiteContentContext';
import { useLanguage } from '../../context/LanguageContext';
import { resolveColumnTitle, resolveLinkLabel, hasFooterPromoContent } from '../../utils/cmsNav';
import { FooterPromoColumn } from './FooterPromoColumn';
import { Logo } from '../brand/Logo';
import { BRAND_TAGLINE } from '../../design-system/brand.js';

function FooterLinkColumn({ title, links }) {
  return (
    <div>
      <h3 className="font-semibold text-[#CBD5F5] mb-4 text-sm uppercase tracking-wider">{title}</h3>
      <ul className="space-y-3">
        {links.map(({ label, path, external }) => (
          <li key={path || label}>
            {external ? (
              <a
                href={path}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[#94A3B8] hover:text-primary transition-colors duration-200 break-words-safe"
              >
                {label}
              </a>
            ) : (
              <Link
                to={path}
                className="text-sm text-[#94A3B8] hover:text-primary transition-colors duration-200 break-words-safe"
              >
                {label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer() {
  const { t } = useTranslation(['footer', 'common', 'navbar']);
  const { footerNav, hasResolved } = useSiteContent();
  const { lang } = useLanguage();

  const cmsColumns = useMemo(() => {
    if (!hasResolved) return undefined; // still loading — avoid flashing hardcoded columns
    if (!footerNav?.columns?.length) return null;
    return footerNav.columns.map((col) => ({
      title: resolveColumnTitle(col, lang),
      links: (col.links || []).map((link) => ({
        label: resolveLinkLabel(link, lang),
        path: link.path,
        external: link.external,
      })),
    }));
  }, [footerNav, lang, hasResolved]);

  const cmsSocial = hasResolved && footerNav?.socialLinks?.length
    ? footerNav.socialLinks.map((s) => ({ id: s.platform || s.icon, label: s.platform, href: s.url }))
    : null;

  const quickLinks = [
    { label: t('footer:jobs'), path: ROUTES.JOBS },
    { label: t('footer:scholarships'), path: ROUTES.SCHOLARSHIPS },
    { label: t('footer:admissions'), path: ROUTES.ADMISSIONS },
    { label: t('footer:internships'), path: ROUTES.INTERNSHIPS },
    { label: t('footer:examPrep'), path: ROUTES.EXAM_PREP },
    { label: t('footer:careerGuidance'), path: ROUTES.CAREER_GUIDANCE },
    { label: t('footer:blog'), path: ROUTES.BLOG },
  ];

  const companyLinks = [
    { label: t('footer:aboutUs'), path: ROUTES.ABOUT },
    { label: t('footer:contactLink'), path: ROUTES.CONTACT },
    { label: t('footer:careers'), path: ROUTES.CAREERS },
    { label: t('footer:advertise'), path: ROUTES.ADVERTISE },
    { label: t('footer:helpCenter'), path: ROUTES.HELP_CENTER },
    { label: t('footer:faq'), path: ROUTES.FAQ },
    { label: t('footer:support'), path: ROUTES.SUPPORT },
  ];

  const legalLinks = [
    { label: t('footer:privacyPolicy'), path: ROUTES.PRIVACY_POLICY },
    { label: t('footer:termsConditions'), path: ROUTES.TERMS },
    { label: t('footer:cookiePolicy'), path: ROUTES.COOKIES },
    { label: t('footer:disclaimer'), path: ROUTES.DISCLAIMER },
    { label: t('footer:refundPolicy'), path: ROUTES.REFUND_POLICY },
    { label: t('footer:license'), path: ROUTES.LICENSE },
  ];

  const portalLinks = [
    { label: t('footer:studentPortal'), path: ROUTES.DASHBOARD },
    { label: t('footer:employerPortal'), path: ROUTES.EMPLOYER_LOGIN },
    { label: t('footer:resumeBuilder'), path: ROUTES.RESUME_BUILDER },
    { label: t('footer:submitOpportunity'), path: ROUTES.SUBMIT_OPPORTUNITY },
    { label: t('footer:sitemap'), path: `${SITE_URL}/sitemap.xml`, external: true },
  ];

  const socialLinks = !hasResolved
    ? []
    : (cmsSocial || [
      { id: 'twitter', label: t('footer:twitter'), href: 'https://twitter.com/strideto' },
      { id: 'linkedin', label: t('footer:linkedin'), href: 'https://linkedin.com/company/strideto' },
      { id: 'telegram', label: t('footer:telegram'), href: 'https://t.me/strideto' },
    ]);

  const newsletterText = hasResolved ? (footerNav?.newsletterText || t('footer:newsletterDesc')) : '';
  const copyrightText = hasResolved ? (footerNav?.copyrightText || t('footer:copyright')) : '';
  const showPromo = hasResolved && hasFooterPromoContent(footerNav?.promoColumn);

  return (
    <footer className="bg-[#020617] text-[#94A3B8] mt-auto safe-area-inset-bottom">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-8 lg:gap-10">
          <div className="sm:col-span-2 lg:col-span-1">
            <Link to={ROUTES.HOME} className="inline-flex items-center mb-3 link-hover" aria-label={t('common:appName')}>
              <Logo variant="full" tone="dark" height={36} />
            </Link>
            <p className="text-sm text-[#94A3B8] max-w-xs leading-relaxed mb-4">
              {hasResolved ? (footerNav?.tagline || t('footer:tagline') || BRAND_TAGLINE) : '\u00a0'}
            </p>
            <div className="flex gap-3 min-h-[44px]">
              {!hasResolved ? (
                <div className="flex gap-3 animate-pulse" aria-busy="true">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="w-11 h-11 rounded-lg bg-white/10" />
                  ))}
                </div>
              ) : (
                socialLinks.map(({ id, label, href }) => (
                  <a
                    key={id}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] rounded-lg bg-white/5 text-[#94A3B8] hover:bg-primary hover:text-white transition-all duration-200"
                    aria-label={label}
                  >
                    {id === 'twitter' && (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                      </svg>
                    )}
                    {id === 'linkedin' && (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                      </svg>
                    )}
                    {id === 'telegram' && (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                      </svg>
                    )}
                  </a>
                ))
              )}
            </div>
          </div>
          {!hasResolved ? (
            <>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse space-y-3" aria-hidden="true">
                  <div className="h-4 w-24 rounded bg-white/10" />
                  <div className="h-3 w-32 rounded bg-white/5" />
                  <div className="h-3 w-28 rounded bg-white/5" />
                  <div className="h-3 w-20 rounded bg-white/5" />
                </div>
              ))}
            </>
          ) : cmsColumns ? (
            cmsColumns.map((col) => <FooterLinkColumn key={col.title} title={col.title} links={col.links} />)
          ) : (
            <>
              <FooterLinkColumn title={t('footer:quickLinks')} links={quickLinks} />
              <FooterLinkColumn title={t('footer:company')} links={companyLinks} />
              <FooterLinkColumn title={t('footer:legal')} links={legalLinks} />
              <FooterLinkColumn title={t('footer:portals')} links={portalLinks} />
            </>
          )}
          {showPromo && (
            <FooterPromoColumn promo={footerNav.promoColumn} locale={lang} />
          )}
          <div className="sm:col-span-2 lg:col-span-1 min-w-0">
            <h3 className="font-semibold text-[#CBD5F5] text-sm uppercase tracking-wider mb-2 mt-6 lg:mt-0">
              {t('footer:newsletter')}
            </h3>
            <p className="text-sm text-[#94A3B8] mb-3">{newsletterText || '\u00a0'}</p>
            <NewsletterSubscribe compact />
          </div>
        </div>
        <div className="mt-12 pt-6 border-t border-white/10 text-center text-sm text-[#64748B]">
          <p>{copyrightText || '\u00a0'}</p>
          {hasResolved && footerNav?.contact?.email && (
            <p className="mt-1">{footerNav.contact.email}{footerNav.contact.phone ? ` · ${footerNav.contact.phone}` : ''}</p>
          )}
        </div>
      </div>
    </footer>
  );
}
