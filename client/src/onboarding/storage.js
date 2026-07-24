import {
  ONBOARDING_COMPLETE_KEY,
  ONBOARDING_GOAL_KEY,
  ONBOARDING_WELCOME_SKIP_KEY,
  LEGACY_ONBOARDING_KEY,
} from './constants.js';

function userScopedKey(base, userId) {
  return userId ? `${base}:${userId}` : base;
}

export function isOnboardingComplete({ userId, userFlag } = {}) {
  if (userFlag === true) return true;
  try {
    if (localStorage.getItem(userScopedKey(ONBOARDING_COMPLETE_KEY, userId)) === 'true') return true;
    if (localStorage.getItem(ONBOARDING_COMPLETE_KEY) === 'true' && !userId) return true;
    // Migrate legacy guest flag
    if (localStorage.getItem(LEGACY_ONBOARDING_KEY) === '1') {
      localStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
      return !userId;
    }
  } catch {
    /* ignore */
  }
  return false;
}

export function markOnboardingComplete(userId) {
  try {
    localStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
    if (userId) localStorage.setItem(userScopedKey(ONBOARDING_COMPLETE_KEY, userId), 'true');
    localStorage.removeItem(LEGACY_ONBOARDING_KEY);
  } catch {
    /* ignore */
  }
}

export function clearOnboardingComplete(userId) {
  try {
    localStorage.removeItem(ONBOARDING_COMPLETE_KEY);
    localStorage.removeItem(ONBOARDING_WELCOME_SKIP_KEY);
    if (userId) {
      localStorage.removeItem(userScopedKey(ONBOARDING_COMPLETE_KEY, userId));
      localStorage.removeItem(userScopedKey(ONBOARDING_WELCOME_SKIP_KEY, userId));
    }
  } catch {
    /* ignore */
  }
}

export function saveOnboardingGoal(goal, userId) {
  try {
    if (goal) {
      localStorage.setItem(ONBOARDING_GOAL_KEY, goal);
      if (userId) localStorage.setItem(userScopedKey(ONBOARDING_GOAL_KEY, userId), goal);
    }
  } catch {
    /* ignore */
  }
}

export function getOnboardingGoal(userId) {
  try {
    if (userId) {
      const scoped = localStorage.getItem(userScopedKey(ONBOARDING_GOAL_KEY, userId));
      if (scoped) return scoped;
    }
    return localStorage.getItem(ONBOARDING_GOAL_KEY) || '';
  } catch {
    return '';
  }
}

export function markWelcomeSkipped(userId) {
  try {
    localStorage.setItem(ONBOARDING_WELCOME_SKIP_KEY, 'true');
    if (userId) localStorage.setItem(userScopedKey(ONBOARDING_WELCOME_SKIP_KEY, userId), 'true');
    markOnboardingComplete(userId);
  } catch {
    /* ignore */
  }
}
