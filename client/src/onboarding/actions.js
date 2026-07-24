import { ONBOARDING_FORCE_EVENT, ONBOARDING_START_EVENT } from './constants.js';

/** Restart product tour from Help menu */
export function restartProductTour() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ONBOARDING_FORCE_EVENT));
}

export function requestOnboardingStart() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ONBOARDING_START_EVENT));
}
