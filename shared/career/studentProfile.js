/**
 * Strideto Mission 3 — Universal Student Profile domain constants.
 *
 * All values are international by design. No country/currency/grading-system
 * assumptions. Companion to shared/career/constants.js.
 */

/** Canonical exam/test types supported by the platform. */
export const EXAM_TYPES = [
  'IELTS',
  'TOEFL',
  'PTE',
  'DET', // Duolingo English Test
  'SAT',
  'ACT',
  'GRE',
  'GMAT',
  'AP',
  'HAT',
  'NAT_GAT',
  'USAT',
  'other',
];

/** Exam record lifecycle statuses. */
export const EXAM_STATUSES = ['planned', 'booked', 'completed'];

/**
 * Qualification / degree levels.
 * Used for both education history and goal degree level.
 */
export const QUALIFICATION_LEVELS = [
  'high_school',
  'o_level',
  'a_level',
  'diploma',
  'associate',
  'bachelor',
  'postgraduate_diploma',
  'master',
  'mphil',
  'phd',
  'other',
];

/**
 * Grading system identifiers.
 * Each record preserves its own grading context — no forced conversion.
 */
export const GRADING_SYSTEMS = [
  'percentage',
  'gpa_4',
  'gpa_5',
  'gpa_10',
  'cgpa',
  'grade_letters', // A, B+, etc.
  'igcse',
  'ib',          // International Baccalaureate
  'a_levels',
  'o_levels',
  'waec',        // West Africa
  'cbse',
  'icse',
  'other',
];

/** Education record completion statuses. */
export const EDUCATION_COMPLETION_STATUSES = ['in_progress', 'completed', 'incomplete', 'deferred'];

/** Employment types for experience records. */
export const EMPLOYMENT_TYPES = [
  'full_time',
  'part_time',
  'internship',
  'contract',
  'freelance',
  'volunteer',
  'self_employed',
  'other',
];

/** Goal types a student may declare. */
export const GOAL_TYPES = [
  'study',
  'scholarship',
  'job',
  'internship',
  'fellowship',
  'work_mobility',
  'other',
];

/** Study mode preferences. */
export const STUDY_MODES = ['full_time', 'part_time', 'online', 'blended'];

/** Scholarship / funding requirement flags. */
export const FUNDING_PREFERENCES = ['required', 'preferred', 'open', 'not_needed'];

/** Funding source types for budget profile. */
export const FUNDING_SOURCE_TYPES = [
  'self_funded',
  'scholarship',
  'loan',
  'employer',
  'family',
  'other',
];

/** Budget period contexts. */
export const BUDGET_PERIODS = ['monthly', 'yearly', 'total_program'];

/** Skill proficiency levels (student-profile extension of career levels). */
export const SKILL_PROFICIENCY_LEVELS = [
  'familiar',
  'beginner',
  'intermediate',
  'advanced',
  'expert',
];

/** Section keys used by student profile completeness. */
export const STUDENT_PROFILE_SECTIONS = [
  'identity',
  'education',
  'examScores',
  'studyGoals',
  'studentPreferences',
  'budget',
  'experience',
  'skills',
  'certifications',
];
