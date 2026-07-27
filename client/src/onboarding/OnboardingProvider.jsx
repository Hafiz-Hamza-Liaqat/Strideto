import { useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEmployerAuth } from '../context/EmployerAuthContext';
import { authApi } from '../services/authService';
import { ROUTES } from '../constants';
import { ONBOARDING_FORCE_EVENT, ONBOARDING_START_EVENT } from './constants.js';
import {
  clearOnboardingComplete,
  getOnboardingGoal,
  isOnboardingComplete,
  markOnboardingComplete,
  markWelcomeSkipped,
  saveOnboardingGoal,
} from './storage.js';
import { consumeOnboardingPending } from './pending.js';
import { showWelcomePopup } from './welcomePopup.js';
import { openProfilingWizard } from './ProfilingWizard.jsx';
import { landingRouteForAction, startGuidedTour } from './tour.js';
import {
  onboardingGoalFromCareerGoal,
  saveCareerPreferencesLocal,
} from '../preferences/careerPreferences.js';
import { trackOnboarding } from './analytics.js';
import { isEmployerPortalPath, isEmployerPublicAuthPath } from '../auth/authRealm.js';
import './onboarding.css';

let activeDriver = null;

async function persistCompletion({ userId, isAuthenticated, updateUser, goal, careerPreferences }) {
  markOnboardingComplete(userId);
  if (goal) saveOnboardingGoal(goal, userId);
  if (careerPreferences) saveCareerPreferencesLocal(careerPreferences, userId);
  if (!isAuthenticated || !userId) return;
  try {
    const payload = { onboardingCompleted: true };
    if (goal) payload.onboardingGoal = goal;
    if (careerPreferences) payload.careerPreferences = careerPreferences;
    const { data } = await authApi.updateProfile(payload);
    if (data?.user && updateUser) updateUser(data.user);
  } catch {
    // Client flag already set; backend persistence is best-effort.
  }
}

async function persistPreferencesOnly({ userId, isAuthenticated, updateUser, careerPreferences, goal }) {
  if (goal) saveOnboardingGoal(goal, userId);
  if (careerPreferences) saveCareerPreferencesLocal(careerPreferences, userId);
  if (!isAuthenticated || !userId) return;
  try {
    const payload = {};
    if (goal) payload.onboardingGoal = goal;
    if (careerPreferences) payload.careerPreferences = careerPreferences;
    if (!Object.keys(payload).length) return;
    const { data } = await authApi.updateProfile(payload);
    if (data?.user && updateUser) updateUser(data.user);
  } catch {
    /* client already saved */
  }
}

/**
 * Orchestrates: welcome → optional profiling wizard → Driver.js tour.
 */
export function OnboardingProvider({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, updateUser, loading: authLoading } = useAuth();
  const { employer, isAuthenticated: isEmployerAuth } = useEmployerAuth();
  const runningRef = useRef(false);

  const userId = user?._id ? String(user._id) : (employer?._id ? String(employer._id) : null);
  const isEmployer = Boolean(isEmployerAuth && employer);

  const runTourFlow = useCallback(
    async ({ skipWelcome = false, force = false, skipProfiling = false } = {}) => {
      if (runningRef.current) return;
      if (typeof window === 'undefined') return;

      const complete = isOnboardingComplete({
        userId,
        userFlag: user?.onboardingCompleted,
      });
      if (complete && !force) return;

      runningRef.current = true;
      let careerPreferences = null;
      let goal = getOnboardingGoal(userId) || null;

      try {
        if (activeDriver) {
          try {
            activeDriver.destroy();
          } catch {
            /* ignore */
          }
          activeDriver = null;
        }

        if (location.pathname !== ROUTES.HOME) {
          navigate(ROUTES.HOME, { replace: false });
          await new Promise((r) => setTimeout(r, 450));
        } else {
          await new Promise((r) => setTimeout(r, 200));
        }

        if (!skipWelcome) {
          const welcome = await showWelcomePopup();
          if (welcome === 'skip') {
            markWelcomeSkipped(userId);
            await persistCompletion({
              userId,
              isAuthenticated,
              updateUser,
              goal,
            });
            return;
          }
        }

        if (!skipProfiling) {
          const profileResult = await openProfilingWizard({
            initialPrefs: user?.careerPreferences || undefined,
          });
          careerPreferences = profileResult?.prefs || null;
          const mappedGoal = onboardingGoalFromCareerGoal(careerPreferences?.careerGoal);
          if (mappedGoal) goal = mappedGoal;

          trackOnboarding('Profiling Completed', {
            action: profileResult?.action,
            persona: careerPreferences?.persona || null,
            careerGoal: careerPreferences?.careerGoal || null,
            skipped: Boolean(careerPreferences?.profilingSkipped),
          });

          await persistPreferencesOnly({
            userId,
            isAuthenticated,
            updateUser,
            careerPreferences,
            goal,
          });

          if (profileResult?.action === 'explore') {
            await persistCompletion({
              userId,
              isAuthenticated,
              updateUser,
              goal,
              careerPreferences,
            });
            trackOnboarding('Tour Skipped', { source: 'profiling_explore' });
            const route = landingRouteForAction('explore', goal);
            if (route && route !== window.location.pathname) navigate(route);
            return;
          }
        }

        await new Promise((r) => setTimeout(r, 100));

        const finish = async (action, selectedGoal) => {
          await persistCompletion({
            userId,
            isAuthenticated,
            updateUser,
            goal: selectedGoal || goal,
            careerPreferences,
          });
          const route = landingRouteForAction(action, selectedGoal || goal);
          if (route && route !== window.location.pathname) {
            navigate(route);
          }
        };

        const skip = async () => {
          await persistCompletion({
            userId,
            isAuthenticated,
            updateUser,
            goal,
            careerPreferences,
          });
        };

        activeDriver = startGuidedTour({
          isEmployer: isEmployer || careerPreferences?.persona === 'employer',
          goal,
          onComplete: finish,
          onSkip: skip,
        });
      } finally {
        runningRef.current = false;
      }
    },
    [
      userId,
      user?.onboardingCompleted,
      user?.careerPreferences,
      isAuthenticated,
      updateUser,
      isEmployer,
      location.pathname,
      navigate,
    ]
  );

  useEffect(() => {
    if (authLoading) return;
    if (isEmployerPortalPath(location.pathname) || isEmployerPublicAuthPath(location.pathname)) return;
    if (!isAuthenticated && !isEmployerAuth) return;
    if (user?.mustChangePassword) return;
    if (!consumeOnboardingPending()) return;

    const complete = isOnboardingComplete({
      userId,
      userFlag: user?.onboardingCompleted,
    });
    if (complete) return;

    const t = setTimeout(() => {
      runTourFlow({ skipWelcome: false, force: false });
    }, 500);
    return () => clearTimeout(t);
  }, [authLoading, isAuthenticated, isEmployerAuth, user, userId, runTourFlow, location.pathname]);

  useEffect(() => {
    const onForce = () => {
      clearOnboardingComplete(userId);
      runTourFlow({ skipWelcome: true, force: true, skipProfiling: true });
    };
    const onStart = () => {
      runTourFlow({ skipWelcome: false, force: true });
    };
    window.addEventListener(ONBOARDING_FORCE_EVENT, onForce);
    window.addEventListener(ONBOARDING_START_EVENT, onStart);
    return () => {
      window.removeEventListener(ONBOARDING_FORCE_EVENT, onForce);
      window.removeEventListener(ONBOARDING_START_EVENT, onStart);
    };
  }, [runTourFlow, userId]);

  return children;
}
