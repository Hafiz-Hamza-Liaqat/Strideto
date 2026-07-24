/**
 * Reusable career preference model for future recommendations
 * (homepage ordering, jobs, scholarships, articles, notifications, email).
 * Phase B.3 — data model only; no recommendation engine.
 */

export const CAREER_PREFERENCES_VERSION = 1;
export const CAREER_PREFERENCES_STORAGE_KEY = 'strideto-career-preferences';

export const PERSONA_OPTIONS = [
  { id: 'student', label: 'Student', emoji: '🎓' },
  { id: 'fresh_graduate', label: 'Fresh Graduate', emoji: '👨‍🎓' },
  { id: 'job_seeker', label: 'Job Seeker', emoji: '💼' },
  { id: 'professional', label: 'Professional', emoji: '👨‍💻' },
  { id: 'employer', label: 'Employer', emoji: '🏢' },
  { id: 'other', label: 'Other', emoji: '✨' },
];

export const LOOKING_FOR_OPTIONS = [
  'Jobs',
  'Scholarships',
  'Admissions',
  'Internships',
  'Study Abroad',
  'Career Guidance',
  'Resume Builder',
  'Government Jobs',
  'Private Jobs',
  'Freelancing Opportunities',
];

export const EDUCATION_LEVELS = [
  'Matric',
  'Intermediate',
  'Diploma',
  "Bachelor's",
  "Master's",
  'MPhil',
  'PhD',
  'Other',
];

export const FIELD_OF_INTEREST_OPTIONS = [
  'Software Engineering',
  'Computer Science',
  'AI',
  'Data Science',
  'Medicine',
  'Business',
  'Finance',
  'Marketing',
  'Education',
  'Civil Engineering',
  'Mechanical Engineering',
  'Law',
  'Arts',
  'Agriculture',
];

export const LOCATION_OPTIONS = [
  'Pakistan',
  'Punjab',
  'Sindh',
  'Khyber Pakhtunkhwa',
  'Balochistan',
  'Islamabad',
  'Karachi',
  'Lahore',
  'Remote Only',
  'Worldwide',
  'Study Abroad',
];

export const EXPERIENCE_OPTIONS = [
  'No Experience',
  'Less than 1 year',
  '1–3 years',
  '3–5 years',
  '5+ years',
];

export const CAREER_GOAL_OPTIONS = [
  { id: 'first_job', label: 'Find My First Job', routeHint: 'jobs' },
  { id: 'resume', label: 'Build My Resume', routeHint: 'resume' },
  { id: 'internship', label: 'Get an Internship', routeHint: 'internships' },
  { id: 'scholarships', label: 'Win Scholarships', routeHint: 'scholarship' },
  { id: 'abroad', label: 'Study Abroad', routeHint: 'abroad' },
  { id: 'career', label: 'Grow My Career', routeHint: 'career' },
  { id: 'hire', label: 'Hire Talent', routeHint: 'employer' },
];

export const NOTIFICATION_PREF_OPTIONS = [
  { id: 'jobs', label: 'Jobs' },
  { id: 'scholarships', label: 'Scholarships' },
  { id: 'admissions', label: 'Admissions' },
  { id: 'internships', label: 'Internships' },
  { id: 'careerArticles', label: 'Career Articles' },
  { id: 'deadlineReminders', label: 'Deadline Reminders' },
];

/** Empty preference object — stable shape for future recommendation engines */
export function createEmptyCareerPreferences() {
  return {
    version: CAREER_PREFERENCES_VERSION,
    persona: '',
    lookingFor: [],
    educationLevel: '',
    fieldsOfInterest: [],
    preferredLocations: [],
    experience: '',
    careerGoal: '',
    notificationPrefs: {
      jobs: false,
      scholarships: false,
      admissions: false,
      internships: false,
      careerArticles: false,
      deadlineReminders: false,
    },
    profilingCompleted: false,
    profilingSkipped: false,
    updatedAt: null,
  };
}

export function normalizeCareerPreferences(raw = {}) {
  const base = createEmptyCareerPreferences();
  if (!raw || typeof raw !== 'object') return base;
  return {
    ...base,
    ...raw,
    lookingFor: Array.isArray(raw.lookingFor) ? raw.lookingFor.filter((x) => typeof x === 'string').slice(0, 20) : [],
    fieldsOfInterest: Array.isArray(raw.fieldsOfInterest)
      ? raw.fieldsOfInterest.filter((x) => typeof x === 'string').slice(0, 30)
      : [],
    preferredLocations: Array.isArray(raw.preferredLocations)
      ? raw.preferredLocations.filter((x) => typeof x === 'string').slice(0, 20)
      : [],
    notificationPrefs: {
      ...base.notificationPrefs,
      ...(raw.notificationPrefs && typeof raw.notificationPrefs === 'object' ? raw.notificationPrefs : {}),
    },
    version: CAREER_PREFERENCES_VERSION,
  };
}

/** Map career goal → B.2 onboarding goal id for tour landing routes */
export function onboardingGoalFromCareerGoal(careerGoalId) {
  const map = {
    first_job: 'job',
    resume: 'resume',
    internship: 'job',
    scholarships: 'scholarship',
    abroad: 'abroad',
    career: 'career',
    hire: 'employer',
  };
  return map[careerGoalId] || '';
}

export function saveCareerPreferencesLocal(prefs, userId) {
  try {
    const normalized = normalizeCareerPreferences(prefs);
    localStorage.setItem(CAREER_PREFERENCES_STORAGE_KEY, JSON.stringify(normalized));
    if (userId) {
      localStorage.setItem(`${CAREER_PREFERENCES_STORAGE_KEY}:${userId}`, JSON.stringify(normalized));
    }
  } catch {
    /* ignore */
  }
}

export function loadCareerPreferencesLocal(userId) {
  try {
    if (userId) {
      const scoped = localStorage.getItem(`${CAREER_PREFERENCES_STORAGE_KEY}:${userId}`);
      if (scoped) return normalizeCareerPreferences(JSON.parse(scoped));
    }
    const raw = localStorage.getItem(CAREER_PREFERENCES_STORAGE_KEY);
    return raw ? normalizeCareerPreferences(JSON.parse(raw)) : createEmptyCareerPreferences();
  } catch {
    return createEmptyCareerPreferences();
  }
}

/**
 * Future recommendation hook — returns preference signals only.
 * @param {object} prefs
 */
export function getRecommendationSignals(prefs) {
  const p = normalizeCareerPreferences(prefs);
  return {
    persona: p.persona,
    lookingFor: p.lookingFor,
    educationLevel: p.educationLevel,
    fieldsOfInterest: p.fieldsOfInterest,
    preferredLocations: p.preferredLocations,
    experience: p.experience,
    careerGoal: p.careerGoal,
    notificationPrefs: p.notificationPrefs,
    ready: Boolean(p.profilingCompleted || p.lookingFor.length || p.careerGoal),
  };
}
