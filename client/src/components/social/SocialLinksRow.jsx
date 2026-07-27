import { useTranslation } from 'react-i18next';
import { OFFICIAL_LINKEDIN_COMPANY_URL } from '@shared/social/officialSocialLinks.js';

function LinkedInIcon() {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

/**
 * @param {{ links: Array<{ id: string, href: string }>, className?: string, linkClassName?: string }} props
 */
export function SocialLinksRow({ links, className = 'flex gap-3 min-h-[44px]', linkClassName }) {
  const { t } = useTranslation(['footer']);
  const defaultLinkClass =
    'flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] rounded-lg bg-white/5 text-[#94A3B8] hover:bg-primary hover:text-white transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

  if (!links?.length) return null;

  return (
    <div className={className}>
      {links.map(({ id, href }) => {
        if (id !== 'linkedin' || href !== OFFICIAL_LINKEDIN_COMPANY_URL) return null;
        const label = t('footer:linkedinAria', { defaultValue: 'Strideto on LinkedIn' });
        return (
          <a
            key={id}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClassName || defaultLinkClass}
            aria-label={label}
          >
            <LinkedInIcon />
          </a>
        );
      })}
    </div>
  );
}
