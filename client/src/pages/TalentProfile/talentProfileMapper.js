/**
 * Map TalentProfile API ↔ editor form state (C.8.0.2B.1 / Mission 3).
 */

import { normalizeGradingSystem } from '../../../../shared/career/studentProfile.js';

export const PROFILE_TABS = [
  'personal',
  'contact',
  'career',
  'education',
  'tests',
  'goals',
  'experience',
  'skills',
  'languages',
  'certifications',
  'portfolio',
  'resumes',
  'documents',
];

export function emptyEducation() {
  return {
    institution: '',
    degree: '',
    fieldOfStudy: '',
    qualificationLevel: '',
    country: '',
    startYear: '',
    endYear: '',
    completionStatus: '',
    graduationYear: '',
    gradingSystem: '',
    gradeValue: '',
    gradeScale: '',
    gpa: '',
    honors: '',
    description: '',
    notes: '',
  };
}

export function emptyExperience() {
  return {
    company: '',
    role: '',
    employmentType: '',
    country: '',
    location: '',
    startDate: '',
    endDate: '',
    isCurrent: false,
    description: '',
    achievements: [],
  };
}

export function emptySkill(category = 'technical') {
  return { name: '', level: 'intermediate', category, source: 'self_reported' };
}

export function emptyLanguage() {
  return { language: '', proficiency: 'conversational' };
}

export function emptyCertification() {
  return { name: '', issuer: '', issuedAt: '', expiresAt: '', externalUrl: '' };
}

export function emptyPortfolio() {
  return { title: '', description: '', url: '', technologies: [], featured: false };
}

export function emptyExamScore() {
  return {
    testType: '',
    provider: '',
    overallScore: '',
    sectionScores: null,
    testDate: '',
    expiryDate: '',
    status: 'completed',
    referenceNumber: '',
  };
}

export function emptyStudyGoal() {
  return {
    goalType: 'study',
    degreeLevel: '',
    fieldOfStudy: '',
    destinationCountries: [],
    targetIntake: '',
    targetYear: '',
    studyMode: '',
    scholarshipPreference: '',
    notes: '',
    status: 'active',
  };
}

export function defaultFormState(authEmail = '') {
  return {
    displayName: '',
    headline: '',
    summary: '',
    avatarUrl: '',
    visibility: 'private',
    locale: 'en',
    personal: {
      firstName: '',
      lastName: '',
      dateOfBirth: '',
      gender: '',
      nationality: '',
      country: '',
      region: '',
      city: '',
      phone: '',
      timeZone: '',
    },
    contactEmail: authEmail,
    socialProfile: {
      linkedInUrl: '',
      githubUrl: '',
      portfolioUrl: '',
      twitterUrl: '',
      websiteUrl: '',
    },
    preferences: {
      workMode: 'hybrid',
      employmentStatus: 'open_to_work',
      preferredCountries: [],
      preferredIndustries: [],
      willingToRelocate: false,
      timeZone: '',
      salaryExpectation: { min: '', max: '', currency: 'USD', period: 'yearly' },
    },
    education: [],
    experience: [],
    skills: [],
    languages: [],
    certificationReferences: [],
    portfolioReferences: [],
    examScores: [],
    studyGoals: [],
    studentPreferences: {
      destinationCountries: [],
      preferredCities: [],
      fieldsOfStudy: [],
      degreeLevels: [],
      targetIntake: '',
      targetYear: '',
      studyMode: '',
      scholarshipRequired: false,
      fundingPreference: '',
      preferredCurrency: '',
    },
    budgetProfile: {
      tuition: { amountMinor: '', currency: '' },
      living: { amountMinor: '', currency: '' },
      general: { amountMinor: '', currency: '' },
      period: '',
      fundingSource: '',
      notes: '',
    },
  };
}

function splitDisplayName(displayName = '') {
  const parts = String(displayName).trim().split(/\s+/);
  if (parts.length <= 1) return { firstName: parts[0] || '', lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function joinDisplayName(firstName, lastName) {
  return [firstName, lastName].map((s) => String(s || '').trim()).filter(Boolean).join(' ');
}

function asRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asText(value, fallback = '') {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : fallback;
}

function asDateInput(value) {
  if (typeof value === 'string') return value.slice(0, 10);
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  return '';
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return [value];
  return [];
}

function asStringArray(value) {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
  return values
    .filter((item) => typeof item === 'string' || typeof item === 'number')
    .map((item) => String(item));
}

function normalizeEducationEntry(value) {
  const entry = asRecord(value);
  const rawGradingSystem = asText(entry.gradingSystem).trim();
  const gradingSystem = normalizeGradingSystem(rawGradingSystem) || '';
  return {
    ...emptyEducation(),
    ...entry,
    institution: asText(entry.institution),
    degree: asText(entry.degree),
    fieldOfStudy: asText(entry.fieldOfStudy),
    qualificationLevel: asText(entry.qualificationLevel),
    country: asText(entry.country),
    startYear: asText(entry.startYear),
    endYear: asText(entry.endYear),
    completionStatus: asText(entry.completionStatus),
    graduationYear: asText(entry.graduationYear),
    gradingSystem,
    gradeValue: asText(entry.gradeValue, asText(entry.gpa)),
    gradeScale: asText(entry.gradeScale),
    gpa: asText(entry.gpa),
    honors: asText(entry.honors),
    description: asText(entry.description),
    notes: asText(entry.notes),
    ...(rawGradingSystem && !gradingSystem ? { _legacyGradingSystem: rawGradingSystem } : {}),
  };
}

export function profileToForm(profile, authEmail = '') {
  if (!profile) return defaultFormState(authEmail);
  const safeProfile = asRecord(profile);
  const fromName = splitDisplayName(asText(safeProfile.displayName));
  const personal = asRecord(safeProfile.personal);
  const socialProfile = asRecord(safeProfile.socialProfile);
  const preferences = asRecord(safeProfile.preferences);
  const salaryExpectation = asRecord(preferences.salaryExpectation);
  const studentPreferences = asRecord(safeProfile.studentPreferences);
  const budgetProfile = asRecord(safeProfile.budgetProfile);
  const tuition = asRecord(budgetProfile.tuition);
  const living = asRecord(budgetProfile.living);
  const general = asRecord(budgetProfile.general);

  return {
    displayName: asText(safeProfile.displayName),
    headline: asText(safeProfile.headline),
    summary: asText(safeProfile.summary),
    avatarUrl: asText(safeProfile.avatarUrl),
    visibility: asText(safeProfile.visibility, 'private') || 'private',
    locale: asText(safeProfile.locale, 'en') || 'en',
    personal: {
      firstName: asText(personal.firstName, fromName.firstName),
      lastName: asText(personal.lastName, fromName.lastName),
      dateOfBirth: asDateInput(personal.dateOfBirth),
      gender: asText(personal.gender),
      nationality: asText(personal.nationality),
      country: asText(personal.country),
      region: asText(personal.region, asText(safeProfile.market)),
      city: asText(personal.city),
      phone: asText(personal.phone),
      timeZone: asText(personal.timeZone, asText(preferences.timeZone)),
    },
    contactEmail: asText(authEmail),
    socialProfile: {
      linkedInUrl: asText(socialProfile.linkedInUrl),
      githubUrl: asText(socialProfile.githubUrl),
      portfolioUrl: asText(socialProfile.portfolioUrl),
      twitterUrl: asText(socialProfile.twitterUrl),
      websiteUrl: asText(socialProfile.websiteUrl),
    },
    preferences: {
      workMode: asText(preferences.workMode, 'hybrid') || 'hybrid',
      employmentStatus: asText(preferences.employmentStatus, 'open_to_work') || 'open_to_work',
      preferredCountries: asStringArray(preferences.preferredCountries),
      preferredIndustries: asStringArray(preferences.preferredIndustries),
      willingToRelocate: Boolean(preferences.willingToRelocate),
      timeZone: asText(preferences.timeZone, asText(personal.timeZone)),
      salaryExpectation: {
        min: asText(salaryExpectation.min),
        max: asText(salaryExpectation.max),
        currency: asText(salaryExpectation.currency, 'USD') || 'USD',
        period: asText(salaryExpectation.period, 'yearly') || 'yearly',
      },
    },
    education: asArray(safeProfile.education).map(normalizeEducationEntry),
    experience: asArray(safeProfile.experience).map((value) => {
      const entry = asRecord(value);
      return {
        ...emptyExperience(), ...entry,
        company: asText(entry.company), role: asText(entry.role),
        employmentType: asText(entry.employmentType), country: asText(entry.country),
        location: asText(entry.location), startDate: asText(entry.startDate),
        endDate: asText(entry.endDate), description: asText(entry.description),
        achievements: asStringArray(entry.achievements),
      };
    }),
    skills: asArray(safeProfile.skills).map((value) => {
      const entry = typeof value === 'string' ? { name: value } : asRecord(value);
      return {
        ...emptySkill(asText(entry.category, 'technical')), ...entry,
        name: asText(entry.name), level: asText(entry.level, 'intermediate'),
        category: asText(entry.category, 'technical'), source: asText(entry.source, 'self_reported'),
      };
    }),
    languages: asArray(safeProfile.languages).map((value) => {
      const entry = typeof value === 'string' ? { language: value } : asRecord(value);
      return {
        ...emptyLanguage(), ...entry, language: asText(entry.language),
        proficiency: asText(entry.proficiency, 'conversational'),
      };
    }),
    certificationReferences: asArray(safeProfile.certificationReferences).map((value) => {
      const entry = typeof value === 'string' ? { name: value } : asRecord(value);
      return {
        ...emptyCertification(), ...entry, name: asText(entry.name), issuer: asText(entry.issuer),
        issuedAt: asDateInput(entry.issuedAt), expiresAt: asDateInput(entry.expiresAt),
        externalUrl: asText(entry.externalUrl),
      };
    }),
    portfolioReferences: asArray(safeProfile.portfolioReferences).map((value) => {
      const entry = asRecord(value);
      return {
        ...emptyPortfolio(), ...entry,
        title: asText(entry.title), description: asText(entry.description), url: asText(entry.url),
        technologies: asStringArray(entry.technologies), featured: Boolean(entry.featured),
      };
    }),
    examScores: asArray(safeProfile.examScores).map((value) => {
      const entry = asRecord(value);
      return {
        ...emptyExamScore(), ...entry, testType: asText(entry.testType),
        provider: asText(entry.provider), overallScore: asText(entry.overallScore),
        testDate: asDateInput(entry.testDate), expiryDate: asDateInput(entry.expiryDate),
        status: asText(entry.status, 'completed'), referenceNumber: asText(entry.referenceNumber),
      };
    }),
    studyGoals: asArray(safeProfile.studyGoals).map((value) => {
      const entry = asRecord(value);
      return {
        ...emptyStudyGoal(), ...entry, goalType: asText(entry.goalType, 'study'),
        degreeLevel: asText(entry.degreeLevel), fieldOfStudy: asText(entry.fieldOfStudy),
        destinationCountries: asStringArray(entry.destinationCountries),
        targetIntake: asText(entry.targetIntake), targetYear: asText(entry.targetYear),
        studyMode: asText(entry.studyMode), scholarshipPreference: asText(entry.scholarshipPreference),
        notes: asText(entry.notes), status: asText(entry.status, 'active'),
      };
    }),
    studentPreferences: {
      destinationCountries: asStringArray(studentPreferences.destinationCountries),
      preferredCities: asStringArray(studentPreferences.preferredCities),
      fieldsOfStudy: asStringArray(studentPreferences.fieldsOfStudy),
      degreeLevels: asStringArray(studentPreferences.degreeLevels),
      targetIntake: asText(studentPreferences.targetIntake),
      targetYear: asText(studentPreferences.targetYear),
      studyMode: asText(studentPreferences.studyMode),
      scholarshipRequired: Boolean(studentPreferences.scholarshipRequired),
      fundingPreference: asText(studentPreferences.fundingPreference),
      preferredCurrency: asText(studentPreferences.preferredCurrency),
    },
    budgetProfile: {
      tuition: {
        amountMinor: asText(tuition.amountMinor), currency: asText(tuition.currency),
      },
      living: {
        amountMinor: asText(living.amountMinor), currency: asText(living.currency),
      },
      general: {
        amountMinor: asText(general.amountMinor), currency: asText(general.currency),
      },
      period: asText(budgetProfile.period),
      fundingSource: asText(budgetProfile.fundingSource),
      notes: asText(budgetProfile.notes),
    },
  };
}

export function formToProfilePayload(form) {
  const displayName = joinDisplayName(form.personal?.firstName, form.personal?.lastName) || form.displayName;
  const timeZone = form.personal?.timeZone || form.preferences?.timeZone || '';

  return {
    displayName,
    headline: form.headline,
    summary: form.summary,
    avatarUrl: form.avatarUrl,
    visibility: form.visibility,
    locale: form.locale,
    market: form.personal?.region || form.personal?.country || '',
    personal: {
      ...form.personal,
      dateOfBirth: form.personal?.dateOfBirth || undefined,
      timeZone,
    },
    socialProfile: form.socialProfile,
    preferences: {
      ...form.preferences,
      timeZone,
      salaryExpectation: {
        min: form.preferences?.salaryExpectation?.min === '' ? undefined : Number(form.preferences.salaryExpectation.min),
        max: form.preferences?.salaryExpectation?.max === '' ? undefined : Number(form.preferences.salaryExpectation.max),
        currency: form.preferences?.salaryExpectation?.currency,
        period: form.preferences?.salaryExpectation?.period,
      },
    },
    education: (form.education || []).map((entry) => {
      const payloadEntry = { ...entry };
      delete payloadEntry._legacyGradingSystem;
      return payloadEntry;
    }),
    experience: (form.experience || []).map((e) => ({
      ...e,
      achievements: (e.achievements || []).filter(Boolean),
    })),
    skills: form.skills,
    languages: form.languages,
    certificationReferences: form.certificationReferences,
    portfolioReferences: (form.portfolioReferences || []).map((p) => ({
      ...p,
      technologies: (p.technologies || []).filter(Boolean),
    })),
    examScores: form.examScores,
    studyGoals: form.studyGoals,
    studentPreferences: {
      ...form.studentPreferences,
      targetYear: form.studentPreferences?.targetYear === '' ? null : Number(form.studentPreferences?.targetYear),
    },
    budgetProfile: {
      ...form.budgetProfile,
      tuition: {
        amountMinor: form.budgetProfile?.tuition?.amountMinor === '' ? null : Number(form.budgetProfile?.tuition?.amountMinor),
        currency: form.budgetProfile?.tuition?.currency,
      },
      living: {
        amountMinor: form.budgetProfile?.living?.amountMinor === '' ? null : Number(form.budgetProfile?.living?.amountMinor),
        currency: form.budgetProfile?.living?.currency,
      },
      general: {
        amountMinor: form.budgetProfile?.general?.amountMinor === '' ? null : Number(form.budgetProfile?.general?.amountMinor),
        currency: form.budgetProfile?.general?.currency,
      },
    },
  };
}

export function parseListInput(value) {
  return String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function formatListInput(arr) {
  return asStringArray(arr).join(', ');
}
