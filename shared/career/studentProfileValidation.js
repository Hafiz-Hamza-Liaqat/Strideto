/**
 * Strideto Mission 3 — Universal Student Profile validation.
 *
 * All validation is pure and isomorphic (no DB, no side-effects).
 * Uses international contracts from shared/international where applicable.
 */
import {
  EXAM_TYPES,
  EXAM_STATUSES,
  QUALIFICATION_LEVELS,
  GRADING_SYSTEMS,
  EDUCATION_COMPLETION_STATUSES,
  EMPLOYMENT_TYPES,
  GOAL_TYPES,
  STUDY_MODES,
  FUNDING_PREFERENCES,
  FUNDING_SOURCE_TYPES,
  BUDGET_PERIODS,
  STUDENT_PROFILE_SECTIONS,
  SKILL_PROFICIENCY_LEVELS,
} from './studentProfile.js';
import { normalizeCountryCode } from '../international/country.js';
import { normalizeCurrency } from '../international/currency.js';
import { isValidTimeZone } from '../international/timezone.js';
import { normalizePhone } from '../international/phone.js';

const SET = (arr) => new Set(arr);

function trimStr(v, max = 500) {
  return String(v ?? '').trim().slice(0, max);
}

function safeEnum(value, allowed, field) {
  if (value == null || value === '') return [];
  if (!allowed.has(value)) return [`${field} must be one of: ${[...allowed].join(', ')}`];
  return [];
}

function normalizeStringArray(arr, maxItems = 50, maxLen = 120) {
  if (!Array.isArray(arr)) return [];
  return arr.map((x) => trimStr(x, maxLen)).filter(Boolean).slice(0, maxItems);
}

// -----------------------------------------------------------------------
// Personal info (Mission 3 additions — phone E.164, timezone IANA)
// -----------------------------------------------------------------------

export function validatePersonalInfoExtensions(input = {}) {
  const errors = [];
  if (!input || typeof input !== 'object') return errors;

  if (input.phone != null && input.phone !== '') {
    const normalized = normalizePhone(String(input.phone));
    if (normalized === null) errors.push('phone must be in E.164 format (e.g. +12125551234)');
  }
  if (input.timeZone != null && input.timeZone !== '') {
    if (!isValidTimeZone(String(input.timeZone))) errors.push('timeZone must be a valid IANA identifier');
  }
  if (input.nationality != null && input.nationality !== '') {
    const code = normalizeCountryCode(String(input.nationality));
    if (code === null) {
      // Nationality stored as country code (ISO 3166-1 alpha-2) when provided
      errors.push('nationality must be a valid ISO 3166-1 alpha-2 country code when provided in code format');
    }
  }
  return errors;
}

// -----------------------------------------------------------------------
// Education record
// -----------------------------------------------------------------------

export function parseEducationEntry(input = {}) {
  if (!input || typeof input !== 'object') return {};
  return {
    ...(input._id !== undefined ? { _id: input._id } : {}),
    degree: trimStr(input.degree, 200),
    institution: trimStr(input.institution, 300),
    fieldOfStudy: trimStr(input.fieldOfStudy, 200),
    startYear: trimStr(input.startYear, 10),
    endYear: trimStr(input.endYear, 10),
    gpa: trimStr(input.gpa, 20),
    description: trimStr(input.description, 2000),
    qualificationLevel: trimStr(input.qualificationLevel, 40),
    country: input.country ? trimStr(input.country, 4).toUpperCase() : '',
    startDate: input.startDate ? new Date(input.startDate) : null,
    endDate: input.endDate ? new Date(input.endDate) : null,
    completionStatus: trimStr(input.completionStatus, 40),
    graduationYear: (input.graduationYear != null && input.graduationYear !== '') ? Number(input.graduationYear) : null,
    gradingSystem: trimStr(input.gradingSystem, 40),
    gradeValue: trimStr(input.gradeValue, 40),
    gradeScale: trimStr(input.gradeScale, 40),
    honors: trimStr(input.honors, 200),
    notes: trimStr(input.notes, 2000),
  };
}

export function validateEducationEntry(input = {}) {
  const errors = [];
  if (!input || typeof input !== 'object') return ['education entry must be an object'];
  if (input.qualificationLevel != null && input.qualificationLevel !== '') {
    errors.push(...safeEnum(input.qualificationLevel, SET(QUALIFICATION_LEVELS), 'qualificationLevel'));
  }
  if (input.completionStatus != null && input.completionStatus !== '') {
    errors.push(...safeEnum(input.completionStatus, SET(EDUCATION_COMPLETION_STATUSES), 'completionStatus'));
  }
  if (input.gradingSystem != null && input.gradingSystem !== '') {
    errors.push(...safeEnum(input.gradingSystem, SET(GRADING_SYSTEMS), 'gradingSystem'));
  }
  if (input.country != null && input.country !== '') {
    if (normalizeCountryCode(input.country) === null) {
      errors.push('education country must be a valid ISO 3166-1 alpha-2 code');
    }
  }
  if (input.graduationYear != null) {
    const y = Number(input.graduationYear);
    if (!Number.isInteger(y) || y < 1900 || y > 2100) {
      errors.push('graduationYear must be a year between 1900 and 2100');
    }
  }
  if (input.startDate && Number.isNaN(new Date(input.startDate).getTime())) {
    errors.push('education startDate must be a valid date');
  }
  if (input.endDate && Number.isNaN(new Date(input.endDate).getTime())) {
    errors.push('education endDate must be a valid date');
  }
  return errors;
}

// -----------------------------------------------------------------------
// Experience record
// -----------------------------------------------------------------------

export function parseExperienceEntry(input = {}) {
  if (!input || typeof input !== 'object') return {};
  return {
    ...(input._id !== undefined ? { _id: input._id } : {}),
    company: trimStr(input.company, 200),
    role: trimStr(input.role, 200),
    location: trimStr(input.location, 200),
    startDate: trimStr(input.startDate, 20),
    endDate: trimStr(input.endDate, 20),
    isCurrent: Boolean(input.isCurrent),
    description: trimStr(input.description, 3000),
    achievements: Array.isArray(input.achievements)
      ? input.achievements.map((a) => trimStr(a, 500)).filter(Boolean).slice(0, 20)
      : [],
    employmentType: trimStr(input.employmentType, 40),
    country: input.country ? trimStr(input.country, 4).toUpperCase() : '',
  };
}

export function validateExperienceEntry(input = {}) {
  const errors = [];
  if (!input || typeof input !== 'object') return ['experience entry must be an object'];
  if (input.employmentType != null && input.employmentType !== '') {
    errors.push(...safeEnum(input.employmentType, SET(EMPLOYMENT_TYPES), 'employmentType'));
  }
  if (input.country != null && input.country !== '') {
    if (normalizeCountryCode(input.country) === null) {
      errors.push('experience country must be a valid ISO 3166-1 alpha-2 code');
    }
  }
  return errors;
}

// -----------------------------------------------------------------------
// Exam score record
// -----------------------------------------------------------------------

export function parseExamScoreEntry(input = {}) {
  if (!input || typeof input !== 'object') return {};
  return {
    ...(input._id !== undefined ? { _id: input._id } : {}),
    testType: trimStr(input.testType, 40),
    provider: trimStr(input.provider, 200),
    overallScore: trimStr(input.overallScore, 80),
    sectionScores: (input.sectionScores && typeof input.sectionScores === 'object')
      ? input.sectionScores
      : null,
    testDate: input.testDate ? new Date(input.testDate) : null,
    expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
    status: trimStr(input.status, 20),
    referenceNumber: trimStr(input.referenceNumber, 100),
  };
}

export function validateExamScoreEntry(input = {}) {
  const errors = [];
  if (!input || typeof input !== 'object') return ['exam score entry must be an object'];
  if (!trimStr(input.testType)) errors.push('testType is required');
  else errors.push(...safeEnum(input.testType, SET(EXAM_TYPES), 'testType'));
  if (input.status != null && input.status !== '') {
    errors.push(...safeEnum(input.status, SET(EXAM_STATUSES), 'status'));
  }
  if (input.testDate && Number.isNaN(new Date(input.testDate).getTime())) {
    errors.push('testDate must be a valid date');
  }
  if (input.expiryDate && Number.isNaN(new Date(input.expiryDate).getTime())) {
    errors.push('expiryDate must be a valid date');
  }
  if (input.sectionScores != null && typeof input.sectionScores !== 'object') {
    errors.push('sectionScores must be an object when provided');
  }
  return errors;
}

// -----------------------------------------------------------------------
// Study goal
// -----------------------------------------------------------------------

export function parseStudyGoalEntry(input = {}) {
  if (!input || typeof input !== 'object') return {};
  const destinationCountries = normalizeStringArray(input.destinationCountries, 20, 3)
    .map((c) => c.toUpperCase())
    .filter((c) => normalizeCountryCode(c) !== null);

  return {
    ...(input._id !== undefined ? { _id: input._id } : {}),
    goalType: trimStr(input.goalType, 40),
    degreeLevel: trimStr(input.degreeLevel, 40),
    fieldOfStudy: trimStr(input.fieldOfStudy, 200),
    destinationCountries,
    targetIntake: trimStr(input.targetIntake, 40),
    targetYear: input.targetYear != null ? Number(input.targetYear) : null,
    studyMode: trimStr(input.studyMode, 40),
    scholarshipPreference: trimStr(input.scholarshipPreference, 40),
    notes: trimStr(input.notes, 2000),
    status: trimStr(input.status, 20),
  };
}

export function validateStudyGoalEntry(input = {}) {
  const errors = [];
  if (!input || typeof input !== 'object') return ['study goal entry must be an object'];
  if (input.goalType != null && input.goalType !== '') {
    errors.push(...safeEnum(input.goalType, SET(GOAL_TYPES), 'goalType'));
  }
  if (input.degreeLevel != null && input.degreeLevel !== '') {
    errors.push(...safeEnum(input.degreeLevel, SET(QUALIFICATION_LEVELS), 'degreeLevel'));
  }
  if (input.studyMode != null && input.studyMode !== '') {
    errors.push(...safeEnum(input.studyMode, SET(STUDY_MODES), 'studyMode'));
  }
  if (input.scholarshipPreference != null && input.scholarshipPreference !== '') {
    errors.push(...safeEnum(input.scholarshipPreference, SET(FUNDING_PREFERENCES), 'scholarshipPreference'));
  }
  if (input.targetYear != null) {
    const y = Number(input.targetYear);
    if (!Number.isInteger(y) || y < 2000 || y > 2100) {
      errors.push('targetYear must be a year between 2000 and 2100');
    }
  }
  if (Array.isArray(input.destinationCountries)) {
    for (const c of input.destinationCountries) {
      if (normalizeCountryCode(c) === null) {
        errors.push(`destinationCountries: "${c}" is not a valid ISO 3166-1 alpha-2 code`);
      }
    }
  }
  return errors;
}

// -----------------------------------------------------------------------
// Student preferences
// -----------------------------------------------------------------------

export function parseStudentPreferences(input = {}) {
  if (!input || typeof input !== 'object') return {};
  return {
    destinationCountries: normalizeStringArray(input.destinationCountries, 20, 3)
      .map((c) => c.toUpperCase())
      .filter((c) => normalizeCountryCode(c) !== null),
    preferredCities: normalizeStringArray(input.preferredCities, 20, 100),
    fieldsOfStudy: normalizeStringArray(input.fieldsOfStudy, 20, 120),
    degreeLevels: normalizeStringArray(input.degreeLevels, 10, 40)
      .filter((l) => QUALIFICATION_LEVELS.includes(l)),
    targetIntake: trimStr(input.targetIntake, 40),
    targetYear: input.targetYear != null ? Number(input.targetYear) : null,
    studyMode: trimStr(input.studyMode, 40),
    scholarshipRequired: Boolean(input.scholarshipRequired),
    fundingPreference: trimStr(input.fundingPreference, 40),
    preferredCurrency: input.preferredCurrency
      ? (normalizeCurrency(input.preferredCurrency) ?? '')
      : '',
  };
}

export function validateStudentPreferences(input = {}) {
  const errors = [];
  if (!input || typeof input !== 'object') return errors;
  if (input.studyMode != null && input.studyMode !== '') {
    errors.push(...safeEnum(input.studyMode, SET(STUDY_MODES), 'studyMode'));
  }
  if (input.fundingPreference != null && input.fundingPreference !== '') {
    errors.push(...safeEnum(input.fundingPreference, SET(FUNDING_PREFERENCES), 'fundingPreference'));
  }
  if (input.targetYear != null) {
    const y = Number(input.targetYear);
    if (!Number.isInteger(y) || y < 2000 || y > 2100) {
      errors.push('targetYear must be a year between 2000 and 2100');
    }
  }
  if (input.preferredCurrency != null && input.preferredCurrency !== '') {
    if (normalizeCurrency(input.preferredCurrency) === null) {
      errors.push('preferredCurrency must be a valid ISO 4217 code');
    }
  }
  if (Array.isArray(input.destinationCountries)) {
    for (const c of input.destinationCountries) {
      if (normalizeCountryCode(c) === null) {
        errors.push(`destinationCountries: "${c}" is not a valid ISO 3166-1 alpha-2 code`);
      }
    }
  }
  return errors;
}

// -----------------------------------------------------------------------
// Budget profile
// -----------------------------------------------------------------------

function parseMoneyAmount(input) {
  if (!input || typeof input !== 'object') return { amountMinor: null, currency: '' };
  const amountMinor = input.amountMinor != null ? Number(input.amountMinor) : null;
  const currency = input.currency ? (normalizeCurrency(input.currency) ?? '') : '';
  return { amountMinor, currency };
}

export function parseBudgetProfile(input = {}) {
  if (!input || typeof input !== 'object') return {};
  return {
    tuition: parseMoneyAmount(input.tuition),
    living: parseMoneyAmount(input.living),
    general: parseMoneyAmount(input.general),
    period: trimStr(input.period, 40),
    fundingSource: trimStr(input.fundingSource, 40),
    notes: trimStr(input.notes, 2000),
  };
}

export function validateBudgetProfile(input = {}) {
  const errors = [];
  if (!input || typeof input !== 'object') return errors;

  const validateAmount = (field, value) => {
    if (!value || typeof value !== 'object') return;
    if (value.amountMinor != null) {
      const n = Number(value.amountMinor);
      if (!Number.isInteger(n) || n < 0) {
        errors.push(`${field}.amountMinor must be a non-negative integer (minor currency units)`);
      }
    }
    if (value.currency != null && value.currency !== '') {
      if (normalizeCurrency(value.currency) === null) {
        errors.push(`${field}.currency must be a valid ISO 4217 code`);
      }
    }
  };

  validateAmount('tuition', input.tuition);
  validateAmount('living', input.living);
  validateAmount('general', input.general);

  if (input.period != null && input.period !== '') {
    errors.push(...safeEnum(input.period, SET(BUDGET_PERIODS), 'period'));
  }
  if (input.fundingSource != null && input.fundingSource !== '') {
    errors.push(...safeEnum(input.fundingSource, SET(FUNDING_SOURCE_TYPES), 'fundingSource'));
  }
  return errors;
}

// -----------------------------------------------------------------------
// Skill normalization / dedup
// -----------------------------------------------------------------------

/**
 * Normalize a skill name for dedup comparison.
 * Lowercased, trimmed, collapsed internal spaces.
 */
export function normalizeSkillName(name) {
  return String(name ?? '').toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Merge a new skill into an existing skills array without creating duplicates.
 * Compares by normalized name. Returns the resulting array.
 *
 * @param {Array} existing
 * @param {{ name: string; level?: string; category?: string; source?: string }} incoming
 * @returns {Array}
 */
export function upsertSkill(existing = [], incoming = {}) {
  const normalizedIncoming = normalizeSkillName(incoming.name);
  if (!normalizedIncoming) return existing;
  const idx = existing.findIndex((s) => normalizeSkillName(s.name) === normalizedIncoming);
  if (idx === -1) return [...existing, incoming];
  const updated = [...existing];
  updated[idx] = { ...updated[idx], ...incoming };
  return updated;
}

// -----------------------------------------------------------------------
// Profile completeness (goal-aware)
// -----------------------------------------------------------------------

/**
 * Compute explainable student profile completeness.
 *
 * Goals influence which sections are "required":
 * - study goal → examScores is recommended
 * - job/internship goal only → examScores is not required
 *
 * @param {{
 *   profile: object;
 *   user?: object|null;
 * }} input
 * @returns {{
 *   overall: number;
 *   sections: Record<string, { done: boolean; weight: number; label: string }>;
 *   completed: string[];
 *   missing: string[];
 *   recommended: string|null;
 * }}
 */
export function computeStudentProfileCompleteness({ profile = {}, user = null } = {}) {
  const hasStudyGoal = (profile.studyGoals || []).some(
    (g) => g.status !== 'archived' && (g.goalType === 'study' || g.goalType === 'scholarship')
  );

  const sections = {
    identity: {
      label: 'Basic identity',
      weight: 15,
      done: Boolean(
        profile.displayName?.trim() ||
        (profile.personal?.firstName?.trim() && profile.personal?.lastName?.trim())
      ),
    },
    education: {
      label: 'Education history',
      weight: 20,
      done: (profile.education || []).length > 0,
    },
    examScores: {
      label: 'Test scores',
      // Weight is higher when user has a study/scholarship goal
      weight: hasStudyGoal ? 15 : 5,
      done: (profile.examScores || []).length > 0,
    },
    studyGoals: {
      label: 'Goals & preferences',
      weight: 15,
      done: (profile.studyGoals || []).filter((g) => g.status !== 'archived').length > 0,
    },
    studentPreferences: {
      label: 'Study preferences',
      weight: 10,
      done: Boolean(
        (profile.studentPreferences?.destinationCountries || []).length > 0 ||
        (profile.studentPreferences?.fieldsOfStudy || []).length > 0 ||
        profile.studentPreferences?.degreeLevel
      ),
    },
    budget: {
      label: 'Budget overview',
      weight: 5,
      done: Boolean(
        profile.budgetProfile?.tuition?.amountMinor != null ||
        profile.budgetProfile?.general?.amountMinor != null
      ),
    },
    experience: {
      label: 'Work experience',
      weight: 15,
      done: (profile.experience || []).length > 0,
    },
    skills: {
      label: 'Skills',
      weight: 10,
      done: (profile.skills || []).length > 0,
    },
    certifications: {
      label: 'Certifications',
      weight: 5,
      done: (profile.certificationReferences || []).length > 0,
    },
  };

  const totalWeight = Object.values(sections).reduce((s, sec) => s + sec.weight, 0);
  const earnedWeight = Object.values(sections)
    .filter((s) => s.done)
    .reduce((s, sec) => s + sec.weight, 0);

  const overall = totalWeight > 0 ? Math.min(100, Math.round((earnedWeight / totalWeight) * 100)) : 0;

  const completed = Object.entries(sections).filter(([, s]) => s.done).map(([k]) => k);
  const missing = Object.entries(sections).filter(([, s]) => !s.done).map(([k]) => k);

  // Recommended: highest-weight incomplete section
  const recommended = missing.sort((a, b) => sections[b].weight - sections[a].weight)[0] ?? null;

  return {
    overall,
    sections,
    completed,
    missing,
    recommended,
    goalAware: hasStudyGoal,
  };
}
