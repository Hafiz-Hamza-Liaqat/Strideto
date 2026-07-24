const PENDING_KEY = 'strideto-onboarding-pending';

export function markOnboardingPending() {
  try {
    sessionStorage.setItem(PENDING_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function consumeOnboardingPending() {
  try {
    const v = sessionStorage.getItem(PENDING_KEY);
    if (v === '1') {
      sessionStorage.removeItem(PENDING_KEY);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}
