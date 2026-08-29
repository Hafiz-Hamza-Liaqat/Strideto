import { Link } from 'react-router-dom';
import { ScrollReveal } from '../ui/ScrollReveal';
import { Button } from '../common/Button';
import { ROUTES } from '../../constants';
import {
  WORKSPACE_LAUNCH_IDS,
  isEmployerWorkspaceLaunched,
  isInstitutionWorkspaceLaunched,
  isEducationMobilityWorkspaceLaunched,
  isBusinessServicesWorkspaceLaunched,
  getWorkspaceLaunchMeta,
} from '../../config/workspaceLaunchGates';

function StatusBadge({ available }) {
  return (
    <span
      className={
        available
          ? 'inline-flex items-center rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide'
          : 'inline-flex items-center rounded-md bg-amber-500/10 text-amber-800 dark:text-amber-200 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide'
      }
    >
      {available ? 'Available Now' : 'Coming Soon'}
    </span>
  );
}

function WorkspaceCard({ title, statusAvailable, description, actions }) {
  return (
    <article className="flex h-full min-h-0 flex-col rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/80 p-4 sm:p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white font-heading">
          {title}
        </h3>
        {statusAvailable !== null ? <StatusBadge available={statusAvailable} /> : null}
      </div>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 leading-relaxed flex-1">
        {description}
      </p>
      {actions ? <div className="mt-4 flex flex-wrap gap-2">{actions}</div> : null}
    </article>
  );
}

/**
 * Homepage organization/workspace discovery — after Career Blog, before newsletter.
 * Locked cards: Coming Soon badge, no private CTA.
 * Unlocked cards: Available Now + canonical public acquisition CTAs.
 */
export function HomeWorkWithStrideto() {
  const employerMeta = getWorkspaceLaunchMeta(WORKSPACE_LAUNCH_IDS.EMPLOYER);
  const institutionMeta = getWorkspaceLaunchMeta(WORKSPACE_LAUNCH_IDS.INSTITUTION);
  const educationMeta = getWorkspaceLaunchMeta(WORKSPACE_LAUNCH_IDS.EDUCATION_MOBILITY);
  const businessMeta = getWorkspaceLaunchMeta(WORKSPACE_LAUNCH_IDS.BUSINESS_SERVICES);

  const employerActive = isEmployerWorkspaceLaunched();
  const institutionActive = isInstitutionWorkspaceLaunched();
  const educationActive = isEducationMobilityWorkspaceLaunched();
  const businessActive = isBusinessServicesWorkspaceLaunched();

  return (
    <ScrollReveal
      as="section"
      aria-labelledby="work-with-strideto-heading"
      className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 border-t border-gray-200 dark:border-gray-700 w-full"
    >
      <div className="mb-5 sm:mb-6">
        <h2
          id="work-with-strideto-heading"
          className="text-2xl font-bold text-gray-900 dark:text-white font-heading"
        >
          Work with STRIDETO
        </h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 max-w-2xl">
          Opportunities for talent. Better hiring for employers. Explore student discovery paths or
          employer workspaces — institution and provider portals launch when ready.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        <WorkspaceCard
          title="For Students"
          statusAvailable={null}
          description="Browse jobs, internships, and scholarships for free. Create an account to save listings, build your resume, and apply through STRIDETO where supported."
          actions={
            <>
              <Link to={ROUTES.FOR_STUDENTS}>
                <Button variant="primary" type="button">
                  Learn About Student Tools
                </Button>
              </Link>
              <Link to={ROUTES.JOBS}>
                <Button variant="secondary" type="button">
                  Explore Opportunities
                </Button>
              </Link>
            </>
          }
        />

        <WorkspaceCard
          title="For Employers"
          statusAvailable={employerActive}
          description={employerMeta?.description}
          actions={
            employerActive ? (
              <>
                <Link to={ROUTES.FOR_EMPLOYERS}>
                  <Button variant="primary" type="button">
                    Learn About Employer Workspace
                  </Button>
                </Link>
                <Link to={ROUTES.EMPLOYER_REGISTER}>
                  <Button variant="cta" type="button">
                    Create Employer Account
                  </Button>
                </Link>
                <Link to={ROUTES.EMPLOYER_POST_JOB}>
                  <Button variant="secondary" type="button">
                    Post a Job
                  </Button>
                </Link>
              </>
            ) : null
          }
        />

        <WorkspaceCard
          title="For Institutions"
          statusAvailable={institutionActive}
          description={institutionMeta?.description}
          actions={
            institutionActive ? (
              <>
                <Link to={ROUTES.INSTITUTION_LOGIN}>
                  <Button variant="primary" type="button">
                    Institution Login
                  </Button>
                </Link>
                <Link to={ROUTES.INSTITUTION_REGISTER}>
                  <Button variant="secondary" type="button">
                    Register Institution
                  </Button>
                </Link>
              </>
            ) : null
          }
        />

        <WorkspaceCard
          title="For Education & Mobility Providers"
          statusAvailable={educationActive}
          description={educationMeta?.description}
          actions={
            educationActive ? (
              <>
                <Link to={ROUTES.PROVIDERS_EDUCATION_MOBILITY}>
                  <Button variant="primary" type="button">
                    Education Provider Entry
                  </Button>
                </Link>
                <Link to={ROUTES.AGENT_LOGIN}>
                  <Button variant="secondary" type="button">
                    Provider Sign in
                  </Button>
                </Link>
              </>
            ) : null
          }
        />

        <WorkspaceCard
          title="For Business Formation Providers"
          statusAvailable={businessActive}
          description={businessMeta?.description}
          actions={
            businessActive ? (
              <>
                <Link to={ROUTES.PROVIDERS_BUSINESS_FORMATION}>
                  <Button variant="primary" type="button">
                    Business Provider Entry
                  </Button>
                </Link>
                <Link to={ROUTES.AGENT_LOGIN}>
                  <Button variant="secondary" type="button">
                    Provider Sign in
                  </Button>
                </Link>
              </>
            ) : null
          }
        />
      </div>
    </ScrollReveal>
  );
}

export default HomeWorkWithStrideto;
