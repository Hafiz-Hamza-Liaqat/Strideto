import { Link } from 'react-router-dom';
import { SeoHead } from '../seo';
import { Button } from '../common/Button';
import { ROUTES } from '../../constants';
import {
  WORKSPACE_LAUNCH_IDS,
  getWorkspaceLaunchMeta,
} from '../../config/workspaceLaunchGates';

const DEFAULT_PUBLIC_COPY =
  "We're preparing this workspace for launch. In the meantime, explore opportunities and resources across Strideto.";

/**
 * Polished Coming Soon surface for launch-gated private workspaces.
 * Private URL remains noindex. No fake launch dates or waitlist forms.
 */
export function WorkspaceComingSoon({
  workspaceId,
  title,
  description,
  showExplore = true,
}) {
  const meta = getWorkspaceLaunchMeta(workspaceId) || {
    label: 'Workspace',
    description: DEFAULT_PUBLIC_COPY,
  };
  const heading = title || `${meta.label} — Coming Soon`;
  const body = description || DEFAULT_PUBLIC_COPY;

  return (
    <main
      className="min-h-[70vh] flex items-center justify-center px-4 sm:px-6 py-12 sm:py-16 bg-gradient-to-b from-gray-50 via-white to-edur-steel/5 dark:from-gray-950 dark:via-secondary dark:to-edur-steel/10"
      aria-labelledby="workspace-coming-soon-heading"
    >
      <SeoHead title={heading} description={body} noindex />
      <div className="w-full max-w-xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/90 dark:bg-gray-900/80 shadow-sm p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-edur-steel dark:text-edur-sky">
          Coming Soon
        </p>
        <h1
          id="workspace-coming-soon-heading"
          className="mt-2 text-2xl sm:text-3xl font-bold font-heading text-gray-900 dark:text-white"
        >
          {meta.label} workspace
        </h1>
        <p className="mt-3 text-sm sm:text-base text-gray-600 dark:text-gray-300 leading-relaxed">
          {body}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to={ROUTES.HOME}>
            <Button variant="primary" type="button">
              Back to Home
            </Button>
          </Link>
          {showExplore ? (
            <Link to={ROUTES.JOBS}>
              <Button variant="secondary" type="button">
                Explore Strideto
              </Button>
            </Link>
          ) : null}
        </div>
      </div>
    </main>
  );
}

export default WorkspaceComingSoon;

export { WORKSPACE_LAUNCH_IDS };
