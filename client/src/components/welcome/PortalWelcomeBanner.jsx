import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../constants';
import {
  consumeWelcomeBack,
  isPortalOnboardingComplete,
  markPortalOnboardingComplete,
  PORTAL_ONBOARDING_ACTIONS,
} from '../../welcome/portalWelcome';

const CTA_PATHS = {
  employer: {
    postJob: ROUTES.EMPLOYER_POST_JOB,
  },
  agent: {
    onboarding: ROUTES.AGENT_ONBOARDING,
  },
  institution: {
    verification: ROUTES.INSTITUTION_VERIFICATION,
  },
};

export function PortalWelcomeBanner({ realm, userId, displayName }) {
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState(null);

  const copy = PORTAL_ONBOARDING_ACTIONS[realm];
  const name = (displayName || '').trim() || 'there';

  useEffect(() => {
    if (!realm || !userId || !copy) return;

    const onboardingDone = isPortalOnboardingComplete(realm, userId);
    if (!onboardingDone) {
      setMode('onboarding');
      setVisible(true);
      return;
    }

    if (consumeWelcomeBack(realm)) {
      setMode('welcomeBack');
      setVisible(true);
    }
  }, [realm, userId, copy]);

  const ctaPath = useMemo(() => {
    if (!copy) return null;
    return CTA_PATHS[realm]?.[copy.ctaPathKey] || null;
  }, [copy, realm]);

  if (!visible || !copy) return null;

  const dismiss = () => {
    if (mode === 'onboarding') markPortalOnboardingComplete(realm, userId);
    setVisible(false);
  };

  return (
    <div
      className="mb-6 rounded-xl border border-primary/20 bg-primary/5 dark:bg-primary/10 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      role="status"
      aria-live="polite"
    >
      <div className="min-w-0">
        <p className="font-semibold text-gray-900 dark:text-white">
          {mode === 'welcomeBack' ? `Welcome back, ${name}` : copy.title}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5">
          {mode === 'welcomeBack'
            ? 'Pick up where you left off in your workspace.'
            : copy.body}
        </p>
      </div>
      <div className="flex flex-wrap gap-2 shrink-0">
        {mode === 'onboarding' && ctaPath ? (
          <Link
            to={ctaPath}
            onClick={dismiss}
            className="inline-flex items-center min-h-[44px] px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover btn-theme"
          >
            {copy.ctaLabel}
          </Link>
        ) : null}
        <button
          type="button"
          onClick={dismiss}
          className="inline-flex items-center min-h-[44px] px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
