const ONBOARDING_PREFIX = 'strideto-portal-onboarding-done';
const WELCOME_BACK_PREFIX = 'strideto-welcome-back';

function scopedKey(prefix, realm, userId) {
  const id = userId ? String(userId) : 'anon';
  return `${prefix}:${realm}:${id}`;
}

export function isPortalOnboardingComplete(realm, userId) {
  try {
    return localStorage.getItem(scopedKey(ONBOARDING_PREFIX, realm, userId)) === '1';
  } catch {
    return false;
  }
}

export function markPortalOnboardingComplete(realm, userId) {
  try {
    localStorage.setItem(scopedKey(ONBOARDING_PREFIX, realm, userId), '1');
  } catch {
    /* ignore */
  }
}

export function consumeWelcomeBack(realm) {
  try {
    const key = `${WELCOME_BACK_PREFIX}:${realm}`;
    if (sessionStorage.getItem(key) === '1') return false;
    sessionStorage.setItem(key, '1');
    return true;
  } catch {
    return true;
  }
}

export const PORTAL_ONBOARDING_ACTIONS = {
  employer: {
    title: 'Welcome to your employer workspace',
    body: 'Post a job draft or complete verification to unlock submissions for review.',
    ctaLabel: 'Post a job',
    ctaPathKey: 'postJob',
  },
  agent: {
    title: 'Welcome to your agent workspace',
    body: 'Finish profile setup and submit verification to appear in the public directory.',
    ctaLabel: 'Continue setup',
    ctaPathKey: 'onboarding',
  },
  institution: {
    title: 'Welcome to your institution portal',
    body: 'Complete organization verification and the canonical claim to activate publishing authority.',
    ctaLabel: 'Open verification',
    ctaPathKey: 'verification',
  },
};
