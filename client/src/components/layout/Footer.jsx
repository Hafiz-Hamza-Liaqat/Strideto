import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '../../constants';
import { NewsletterSubscribe } from '../newsletter/NewsletterSubscribe';
import { useSiteContent } from '../../context/SiteContentContext';
import { useLanguage } from '../../context/LanguageContext';
import { hasFooterPromoContent } from '../../utils/cmsNav';
import { FooterPromoColumn } from './FooterPromoColumn';
import { Logo } from '../brand/Logo';
import { BRAND_TAGLINE } from '../../design-system/brand.js';
import { resolvePublicSocialLinks } from '@shared/social/officialSocialLinks.js';
import { SocialLinksRow } from '../social/SocialLinksRow';
import { sanitizePublicCopyright, isForbiddenPublicHref } from '@shared/seo/publicCopyright.js';
import { openCookieSettings } from '../../consent/cookieConsentStorage';
import {
  isEmployerWorkspaceLaunched,
  isInstitutionWorkspaceLaunched,
  isEducationMobilityWorkspaceLaunched,
  isBusinessServicesWorkspaceLaunched,
} from '../../config/workspaceLaunchGates';

function FooterLinkColumn({ title, links }) {
  const visible = links.filter(
    (l) => l.comingSoon || (l.path && !isForbiddenPublicHref(l.path)) || l.action
  );
  return (
    <div>
      <h3 className="font-semibold text-[#CBD5F5] mb-4 text-sm uppercase tracking-wider">{title}</h3>
      <ul className="space-y-3">
        {visible.map(({ label, path, action, comingSoon }) => (
          <li key={path || action || label}>
            {comingSoon ? (
              <span
                className="text-sm text-[#64748B] break-words-safe"
                aria-disabled="true"
              >
                {label}
                <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-400/90">
                  Coming Soon
                </span>
              </span>
            ) : action === 'cookie-settings' ? (
              <button
                type="button"
                onClick={() => openCookieSettings()}
                className="text-sm text-[#94A3B8] hover:text-primary focus-visible:text-primary transition-colors duration-200 break-words-safe text-left"
              >
                {label}
              </button>
            ) : (
              <Link
                to={path}
                className="text-sm text-[#94A3B8] hover:text-primary focus-visible:text-primary transition-colors duration-200 break-words-safe"
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

  const discoverLinks = [
    { label: t('footer:jobs'), path: ROUTES.JOBS },
    { label: t('footer:internships'), path: ROUTES.INTERNSHIPS },
    { label: t('navbar:scholarshipsAndFunding', { ns: 'navbar' }), path: ROUTES.SCHOLARSHIPS },
    { label: t('navbar:admissionsAndIntakes', { ns: 'navbar' }), path: ROUTES.ADMISSIONS },
  ];

  const studyPrepareLinks = [
    { label: t('navbar:programExplorer', { ns: 'navbar' }), path: ROUTES.PROGRAM_EXPLORER },
    { label: t('navbar:schoolsAndColleges', { ns: 'navbar' }), path: ROUTES.SCHOOLS_AND_COLLEGES },
    { label: t('navbar:foreignStudies', { ns: 'navbar' }), path: ROUTES.FOREIGN_STUDIES },
    { label: t('navbar:intlScholarships', { ns: 'navbar' }), path: ROUTES.INTL_SCHOLARSHIPS },
    { label: t('footer:testsAndPrep'), path: ROUTES.TEST_HUB },
    { label: t('footer:examPrep'), path: ROUTES.EXAM_PREP },
  ];

  const servicesLinks = [
    { label: t('footer:agentsDirectory'), path: ROUTES.AGENT_PUBLIC_DIRECTORY },
    { label: t('footer:professionalMarketplace'), path: ROUTES.AGENT_PUBLIC_MARKETPLACE },
    { label: t('footer:careerGuidance'), path: ROUTES.CAREER_GUIDANCE },
    { label: t('footer:resumeBuilder'), path: ROUTES.RESUME_BUILDER },
  ];

  const organizationLinks = [
    { label: t('footer:forStudents', { defaultValue: 'For Students' }), path: ROUTES.FOR_STUDENTS },
    { label: t('footer:forEmployers', { defaultValue: 'For Employers' }), path: ROUTES.FOR_EMPLOYERS },
    { label: t('footer:forInstitutions', { defaultValue: 'For Institutions' }), path: ROUTES.FOR_INSTITUTIONS },
    isEmployerWorkspaceLaunched()
      ? { label: t('footer:employerPortal'), path: ROUTES.EMPLOYER_LOGIN }
      : { label: t('footer:employerPortal'), comingSoon: true },
    isEducationMobilityWorkspaceLaunched()
      ? { label: t('footer:educationProviderPortal'), path: ROUTES.PROVIDERS_EDUCATION_MOBILITY }
      : { label: t('footer:educationProviderPortal'), comingSoon: true },
    isBusinessServicesWorkspaceLaunched()
      ? { label: t('footer:businessProviderPortal'), path: ROUTES.PROVIDERS_BUSINESS_FORMATION }
      : { label: t('footer:businessProviderPortal'), comingSoon: true },
    isInstitutionWorkspaceLaunched()
      ? { label: t('footer:institutionPortal'), path: ROUTES.INSTITUTION_LOGIN }
      : { label: t('footer:institutionPortal'), comingSoon: true },
  ];

  const supportLinks = [
    { label: t('footer:careerBlog'), path: ROUTES.BLOG },
    { label: t('footer:helpCenter'), path: ROUTES.HELP_CENTER },
    { label: t('footer:faq'), path: ROUTES.FAQ },
    { label: t('footer:support'), path: ROUTES.SUPPORT },
    { label: t('footer:contactLink'), path: ROUTES.CONTACT },
    { label: t('footer:sitemap'), path: ROUTES.SITEMAP },
  ];

  const legalLinks = [
    { label: t('footer:privacyPolicy'), path: ROUTES.PRIVACY_POLICY },
    { label: t('footer:termsConditions'), path: ROUTES.TERMS },
    { label: t('footer:refundPolicy'), path: ROUTES.REFUND_POLICY },
    { label: t('footer:cookiePolicy'), path: ROUTES.COOKIES },
    { label: t('footer:cookieSettings'), path: null, action: 'cookie-settings' },
    { label: t('footer:disclaimer'), path: ROUTES.DISCLAIMER },
  ];

  const cmsSocial = hasResolved && footerNav?.socialLinks?.length ? footerNav.socialLinks : [];
  const socialLinks = !hasResolved ? [] : resolvePublicSocialLinks(cmsSocial);
  const newsletterText = hasResolved ? (footerNav?.newsletterText || t('footer:newsletterDesc')) : '';
  const copyrightText = hasResolved
    ? sanitizePublicCopyright(footerNav?.copyrightText || t('footer:copyright'))
    : '';
  const showPromo = hasResolved && hasFooterPromoContent(footerNav?.promoColumn);

  return (
    <footer className="bg-[#020617] text-[#94A3B8] mt-auto safe-area-inset-bottom">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-8 lg:gap-10">
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
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="animate-pulse space-y-3" aria-hidden="true">
                  <div className="h-4 w-24 rounded bg-white/10" />
                  <div className="h-3 w-32 rounded bg-white/5" />
                  <div className="h-3 w-28 rounded bg-white/5" />
                  <div className="h-3 w-20 rounded bg-white/5" />
                </div>
              ))}
            </>
          ) : (
            <>
              <FooterLinkColumn title={t('footer:discover')} links={discoverLinks} />
              <FooterLinkColumn title={t('footer:studyPrepare')} links={studyPrepareLinks} />
              <FooterLinkColumn title={t('footer:servicesGroup')} links={servicesLinks} />
              <FooterLinkColumn title={t('footer:organizations')} links={organizationLinks} />
              <FooterLinkColumn title={t('footer:supportGroup')} links={supportLinks} />
              <FooterLinkColumn title={t('footer:legal')} links={legalLinks} />
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
        </div>
      </div>
    </footer>
  );
}
