import { Link } from 'react-router-dom';
import { ROUTES } from '../../constants';
import { Button } from '../common/Button';
import { useProfileCompletion } from '../../hooks/useProfileCompletion';

/**
 * Shown when the user has no resume — hidden once a resume exists.
 */
export function ResumeEncouragementBanner({ className = '' }) {
  const { loading, hasResume } = useProfileCompletion();

  if (loading || hasResume) return null;

  return (
    <aside
      className={`rounded-xl border border-accent/30 bg-accent/5 dark:bg-accent/10 p-5 sm:p-6 ${className}`}
      aria-labelledby="resume-encourage-heading"
    >
      <h2 id="resume-encourage-heading" className="text-lg font-semibold text-gray-900 dark:text-white font-heading mb-2">
        Build your resume
      </h2>
      <p className="text-sm text-gray-700 dark:text-gray-300 mb-4 leading-relaxed">
        You&apos;re much more likely to receive interviews with a complete resume.
        Build one in just a few minutes.
      </p>
      <Link to={ROUTES.RESUME_BUILDER}>
        <Button variant="cta" type="button">Build Resume</Button>
      </Link>
    </aside>
  );
}

export default ResumeEncouragementBanner;
