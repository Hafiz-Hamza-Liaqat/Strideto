import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Icon } from '../brand/Icon';
import { ROUTES } from '../../constants';

const CATEGORY_CARDS = [
  {
    key: 'jobs',
    labelKey: 'home:jobsQuick',
    route: ROUTES.JOBS,
    icon: 'briefcase',
    accent: 'from-blue-500/20 to-blue-600/5',
    wide: true,
  },
  {
    key: 'internships',
    labelKey: 'home:internships',
    route: ROUTES.INTERNSHIPS,
    icon: 'document',
    accent: 'from-violet-500/20 to-violet-600/5',
    wide: false,
  },
  {
    key: 'scholarships',
    labelKey: 'home:scholarships',
    route: ROUTES.SCHOLARSHIPS,
    icon: 'check',
    accent: 'from-emerald-500/20 to-emerald-600/5',
    wide: false,
  },
];

function BuildingIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" />
      <path d="M9 9h.01M15 9h.01M9 13h.01M15 13h.01" />
    </svg>
  );
}

/**
 * Decorative opportunity/hiring composition for the homepage hero.
 * Not interactive — primary navigation lives in the left CTA column.
 */
export function HomeHeroVisual() {
  const { t } = useTranslation(['home']);

  return (
    <div
      className="relative mx-auto w-full max-w-md lg:max-w-none lg:mx-0 select-none"
    >
      <div className="absolute -inset-4 rounded-3xl bg-white/5 blur-2xl" aria-hidden="true" />
      <div className="relative grid grid-cols-2 gap-3 sm:gap-4">
        {CATEGORY_CARDS.map((card) => (
          <Link
            key={card.key}
            to={card.route}
            className={`relative cursor-pointer overflow-hidden rounded-2xl border border-white/20 bg-white/10 p-4 sm:p-5 backdrop-blur-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
              card.wide ? 'col-span-2 sm:col-span-1' : ''
            }`}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${card.accent} opacity-80`} aria-hidden="true" />
            <div className="relative flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white" aria-hidden="true">
                <Icon name={card.icon} className="h-5 w-5" />
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="font-semibold text-white text-sm sm:text-base">{t(card.labelKey)}</p>
              </div>
            </div>
          </Link>
        ))}

        <Link
          to={ROUTES.FOR_EMPLOYERS}
          className="relative col-span-2 cursor-pointer overflow-hidden rounded-2xl border border-white/25 bg-white/12 p-4 sm:p-5 backdrop-blur-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/15 via-white/5 to-primary/20" aria-hidden="true" />
          <div className="relative flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white" aria-hidden="true">
              <BuildingIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-white text-sm sm:text-base">{t('home:forEmployers')}</p>
              <p className="mt-0.5 text-xs text-white/75">{t('home:forEmployersCta')}</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}

export default HomeHeroVisual;
