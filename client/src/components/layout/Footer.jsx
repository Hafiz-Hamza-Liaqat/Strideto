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
import { resolvePublicSocialLinks } from '@shared/social/officialSocialLinks.js';
import { SocialLinksRow } from '../social/SocialLinksRow';

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

  const cmsSocial = hasResolved && footerNav?.socialLinks?.length ? footerNav.socialLinks : [];

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

  const socialLinks = !hasResolved ? [] : resolvePublicSocialLinks(cmsSocial);

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
            {!hasResolved ? (
              <div className="flex gap-3 animate-pulse min-h-[44px]" aria-busy="true">
                <div className="w-11 h-11 rounded-lg bg-white/10" />
              </div>
            ) : (
              <SocialLinksRow links={socialLinks} className="flex gap-3 min-h-[44px] flex-wrap" />
            )}
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
