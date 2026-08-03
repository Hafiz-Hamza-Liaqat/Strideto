/**
 * Phase B.4 — Weighted profile completion (LinkedIn-style).
 * Single source of truth for UX completion meter weights.
 * Does not replace scoring engine completeness rules (those remain for match scores).
 */

/** @typedef {{ key: string; label: string; weight: number; href: string; tab?: string }} ProfileCompletionItemDef */

/** Configurable weights — must sum to 100 */
export const PROFILE_COMPLETION_WEIGHTS = {
  name: 5,
  emailVerified: 10,
  profilePhoto: 10,
  education: 15,
  skills: 15,
  resumeUploaded: 20,
  experience: 10,
  careerPreferences: 10,
  location: 5,
  bio: 10,
};

export const PROFILE_COMPLETION_MILESTONES = [25, 50, 75, 100];

export const PROFILE_COMPLETION_MILESTONE_STORAGE_KEY = 'strideto-profile-milestones';

/**
 * Item definitions with navigation targets (client routes as path strings).
 * Route constants live on the client; paths here stay isomorphic.
 */
export const PROFILE_COMPLETION_ITEMS = [
  {
    key: 'name',
    label: 'Name',
    weight: PROFILE_COMPLETION_WEIGHTS.name,
    href: '/talent-profile',
    tab: 'personal',
  },
  {
    key: 'emailVerified',
    label: 'Email Verified',
    weight: PROFILE_COMPLETION_WEIGHTS.emailVerified,
    href: '/profile',
  },
  {
    key: 'profilePhoto',
    label: 'Profile Photo',
    weight: PROFILE_COMPLETION_WEIGHTS.profilePhoto,
    href: '/talent-profile',
    tab: 'personal',
  },
  {
    key: 'education',
    label: 'Education',
    weight: PROFILE_COMPLETION_WEIGHTS.education,
    href: '/talent-profile',
    tab: 'education',
  },
  {
    key: 'skills',
    label: 'Skills',
    weight: PROFILE_COMPLETION_WEIGHTS.skills,
    href: '/talent-profile',
    tab: 'skills',
  },
  {
    key: 'resumeUploaded',
    label: 'Upload Resume',
    weight: PROFILE_COMPLETION_WEIGHTS.resumeUploaded,
    href: '/resume-builder',
  },
  {
    key: 'experience',
    label: 'Add Experience',
    weight: PROFILE_COMPLETION_WEIGHTS.experience,
    href: '/talent-profile',
    tab: 'experience',
  },
  {
    key: 'careerPreferences',
    label: 'Career Preferences',
    weight: PROFILE_COMPLETION_WEIGHTS.careerPreferences,
    href: '/profile?section=career-preferences',
  },
  {
    key: 'location',
    label: 'Location',
    weight: PROFILE_COMPLETION_WEIGHTS.location,
    href: '/profile',
  },
  {
    key: 'bio',
    label: 'Bio / About',
    weight: PROFILE_COMPLETION_WEIGHTS.bio,
    href: '/talent-profile',
    tab: 'career',
  },
];

/**
 * Build a signals object from user + talent profile + resume + preferences.
 * @param {{
 *   user?: object|null;
 *   talent?: object|null;
 *   hasResume?: boolean;
 *   careerPreferences?: object|null;
 * }} input
 */
export function buildProfileCompletionSignals({
  user = null,
  talent = null,
  hasResume = false,
  careerPreferences = null,
} = {}) {
  const displayName =
    talent?.displayName
    || [talent?.personal?.firstName, talent?.personal?.lastName].filter(Boolean).join(' ').trim()
    || user?.name
    || '';
  const location =
    user?.province
    || talent?.personal?.city
    || talent?.personal?.region
    || talent?.personal?.country
    || '';
  const bio = talent?.career?.summary || talent?.summary || '';
  const prefs = careerPreferences || user?.careerPreferences || null;
  const prefsReady = Boolean(
    prefs
    && (prefs.profilingCompleted
      || prefs.careerGoal
      || (Array.isArray(prefs.lookingFor) && prefs.lookingFor.length)
      || (Array.isArray(prefs.fieldsOfInterest) && prefs.fieldsOfInterest.length))
  );

  return {
    name: Boolean(String(displayName).trim()),
    emailVerified: Boolean(user?.emailVerified),
    profilePhoto: Boolean(talent?.avatarUrl || talent?.personal?.avatarUrl),
    education: (talent?.education?.length || 0) > 0,
    skills: (talent?.skills?.length || 0) >= 1,
    resumeUploaded: Boolean(hasResume),
    experience: (talent?.experience?.length || 0) > 0,
    careerPreferences: prefsReady,
    location: Boolean(String(location).trim()),
    bio: Boolean(String(bio).trim().length >= 20),
  };
}

/**
 * @param {Record<string, boolean>} signals
 * @returns {{
 *   percent: number;
 *   totalWeight: number;
 *   earnedWeight: number;
 *   items: Array<{ key: string; label: string; weight: number; href: string; tab?: string; done: boolean }>;
 *   missing: Array<object>;
 *   completed: Array<object>;
 * }}
 */
export function evaluateWeightedProfileCompletion(signals = {}) {
  const items = PROFILE_COMPLETION_ITEMS.map((item) => ({
    ...item,
    weight: PROFILE_COMPLETION_WEIGHTS[item.key] ?? item.weight,
    done: Boolean(signals[item.key]),
  }));
  const totalWeight = items.reduce((sum, i) => sum + i.weight, 0) || 100;
  const earnedWeight = items.filter((i) => i.done).reduce((sum, i) => sum + i.weight, 0);
  const percent = Math.min(100, Math.round((earnedWeight / totalWeight) * 100));
  return {
    percent,
    totalWeight,
    earnedWeight,
    items,
    missing: items.filter((i) => !i.done),
    completed: items.filter((i) => i.done),
  };
}

/**
 * Milestone toast helpers (client storage).
 */
export function getReachedMilestones(userId) {
  try {
    const raw = localStorage.getItem(
      userId ? `${PROFILE_COMPLETION_MILESTONE_STORAGE_KEY}:${userId}` : PROFILE_COMPLETION_MILESTONE_STORAGE_KEY
    );
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function markMilestoneReached(percent, userId) {
  try {
    const key = userId
      ? `${PROFILE_COMPLETION_MILESTONE_STORAGE_KEY}:${userId}`
      : PROFILE_COMPLETION_MILESTONE_STORAGE_KEY;
    const prev = getReachedMilestones(userId);
    if (prev.includes(percent)) return false;
    const next = [...prev, percent].sort((a, b) => a - b);
    localStorage.setItem(key, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

export function findNewMilestones(percent, userId) {
  const reached = getReachedMilestones(userId);
  return PROFILE_COMPLETION_MILESTONES.filter((m) => percent >= m && !reached.includes(m));
}
