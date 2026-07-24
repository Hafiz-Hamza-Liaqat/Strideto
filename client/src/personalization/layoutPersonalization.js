import {
  loadCareerPreferencesLocal,
  normalizeCareerPreferences,
  getRecommendationSignals,
} from '../preferences/careerPreferences.js';

/**
 * Resolve persona bucket for layout personalization (no ML).
 * @returns {'student'|'job_seeker'|'professional'|'employer'|'default'}
 */
export function resolvePersonaBucket(user, employerAuth = false) {
  if (employerAuth) return 'employer';
  const prefs = user?.careerPreferences
    ? normalizeCareerPreferences(user.careerPreferences)
    : loadCareerPreferencesLocal(user?._id ? String(user._id) : undefined);
  const signals = getRecommendationSignals(prefs);
  const persona = signals.persona || '';
  const goal = signals.careerGoal || '';

  if (persona === 'employer' || goal === 'hire') return 'employer';
  if (persona === 'student' || persona === 'fresh_graduate' || goal === 'scholarships' || goal === 'abroad' || goal === 'internship') {
    return 'student';
  }
  if (persona === 'professional' || goal === 'career') return 'professional';
  if (persona === 'job_seeker' || goal === 'first_job' || goal === 'resume') return 'job_seeker';
  return 'default';
}

/** Preferred dashboard widget order by zone for each persona (existing widget ids only). */
export const DASHBOARD_PERSONA_LAYOUT = {
  student: {
    mainPriority: [
      'recommended-scholarships',
      'recommended-admissions',
      'documents',
      'recommended-learning',
      'recommended-jobs',
      'applications-summary',
      'upcoming-deadlines',
    ],
    asidePriority: [
      'profile-completion',
      'career-goals',
      'notifications',
      'weekly-progress',
    ],
  },
  job_seeker: {
    mainPriority: [
      'recommended-jobs',
      'applications-summary',
      'upcoming-deadlines',
      'skill-gap',
      'recommended-learning',
    ],
    asidePriority: [
      'profile-completion',
      'documents',
      'notifications',
      'career-goals',
    ],
  },
  professional: {
    mainPriority: [
      'recommended-jobs',
      'skill-gap',
      'recommended-learning',
      'applications-summary',
      'timeline',
    ],
    asidePriority: [
      'profile-completion',
      'credentials',
      'achievements',
      'notifications',
    ],
  },
  employer: {
    mainPriority: [
      'applications-summary',
      'recommended-jobs',
      'upcoming-deadlines',
      'timeline',
    ],
    asidePriority: [
      'profile-completion',
      'notifications',
      'career-goals',
    ],
  },
  default: {
    mainPriority: [],
    asidePriority: ['profile-completion'],
  },
};

function prioritize(existing = [], priority = []) {
  const set = new Set(existing);
  const head = priority.filter((id) => set.has(id));
  const rest = existing.filter((id) => !head.includes(id));
  return [...head, ...rest];
}

/**
 * Reorder dashboard layout zones using persona preferences. Does not hide widgets.
 */
export function personalizeDashboardLayout(layout, persona) {
  const cfg = DASHBOARD_PERSONA_LAYOUT[persona] || DASHBOARD_PERSONA_LAYOUT.default;
  return {
    ...layout,
    hero: layout?.hero || [],
    main: prioritize(layout?.main || [], cfg.mainPriority),
    aside: prioritize(layout?.aside || [], cfg.asidePriority),
  };
}

/** Homepage section keys (excluding hero/banners/ads fixed anchors). */
export const HOME_SECTION_KEYS = [
  'recommended',
  'jobs',
  'scholarships',
  'admissions',
  'foreign',
  'testimonials',
  'partners',
  'resources',
  'blog',
  'newsletter',
  'employerCta',
];

export const HOME_PERSONA_ORDER = {
  student: [
    'scholarships',
    'admissions',
    'resources',
    'recommended',
    'jobs',
    'foreign',
    'blog',
    'testimonials',
    'partners',
    'newsletter',
    'employerCta',
  ],
  professional: [
    'jobs',
    'recommended',
    'resources',
    'blog',
    'scholarships',
    'admissions',
    'foreign',
    'testimonials',
    'partners',
    'newsletter',
    'employerCta',
  ],
  job_seeker: [
    'jobs',
    'recommended',
    'resources',
    'blog',
    'scholarships',
    'admissions',
    'foreign',
    'testimonials',
    'partners',
    'newsletter',
    'employerCta',
  ],
  employer: [
    'employerCta',
    'jobs',
    'recommended',
    'resources',
    'blog',
    'scholarships',
    'admissions',
    'foreign',
    'testimonials',
    'partners',
    'newsletter',
  ],
  default: HOME_SECTION_KEYS,
};

export function orderedHomeSections(persona) {
  const preferred = HOME_PERSONA_ORDER[persona] || HOME_PERSONA_ORDER.default;
  const all = new Set(HOME_SECTION_KEYS);
  const head = preferred.filter((k) => all.has(k));
  const rest = HOME_SECTION_KEYS.filter((k) => !head.includes(k));
  return [...head, ...rest];
}
