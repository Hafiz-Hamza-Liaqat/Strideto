/**
 * Map TalentProfile API ↔ editor form state (C.8.0.2B.1 / Mission 3).
 */

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

export function profileToForm(profile, authEmail = '') {
  if (!profile) return defaultFormState(authEmail);
  const fromName = splitDisplayName(profile.displayName);
  const personal = profile.personal || {};

  return {
    displayName: profile.displayName || '',
    headline: profile.headline || '',
    summary: profile.summary || '',
    avatarUrl: profile.avatarUrl || '',
    visibility: profile.visibility || 'private',
    locale: profile.locale || 'en',
    personal: {
      firstName: personal.firstName || fromName.firstName,
      lastName: personal.lastName || fromName.lastName,
      dateOfBirth: personal.dateOfBirth ? personal.dateOfBirth.slice(0, 10) : '',
      gender: personal.gender || '',
      nationality: personal.nationality || '',
      country: personal.country || '',
      region: personal.region || profile.market || '',
      city: personal.city || '',
      phone: personal.phone || '',
      timeZone: personal.timeZone || profile.preferences?.timeZone || '',
    },
    contactEmail: authEmail,
    socialProfile: {
      linkedInUrl: profile.socialProfile?.linkedInUrl || '',
      githubUrl: profile.socialProfile?.githubUrl || '',
      portfolioUrl: profile.socialProfile?.portfolioUrl || '',
      twitterUrl: profile.socialProfile?.twitterUrl || '',
      websiteUrl: profile.socialProfile?.websiteUrl || '',
    },
    preferences: {
      workMode: profile.preferences?.workMode || 'hybrid',
      employmentStatus: profile.preferences?.employmentStatus || 'open_to_work',
      preferredCountries: profile.preferences?.preferredCountries || [],
      preferredIndustries: profile.preferences?.preferredIndustries || [],
      willingToRelocate: Boolean(profile.preferences?.willingToRelocate),
      timeZone: profile.preferences?.timeZone || personal.timeZone || '',
      salaryExpectation: {
        min: profile.preferences?.salaryExpectation?.min ?? '',
        max: profile.preferences?.salaryExpectation?.max ?? '',
        currency: profile.preferences?.salaryExpectation?.currency || 'USD',
        period: profile.preferences?.salaryExpectation?.period || 'yearly',
      },
    },
    education: (profile.education || []).map((e) => ({ ...emptyEducation(), ...e })),
    experience: (profile.experience || []).map((e) => ({
      ...emptyExperience(),
      ...e,
      achievements: e.achievements || [],
    })),
    skills: (profile.skills || []).map((s) => ({ ...emptySkill(s.category), ...s })),
    languages: (profile.languages || []).map((l) => ({ ...emptyLanguage(), ...l })),
    certificationReferences: (profile.certificationReferences || []).map((c) => ({ ...emptyCertification(), ...c })),
    portfolioReferences: (profile.portfolioReferences || []).map((p) => ({
      ...emptyPortfolio(),
      ...p,
      technologies: p.technologies || [],
    })),
    examScores: (profile.examScores || []).map((e) => ({ ...emptyExamScore(), ...e })),
    studyGoals: (profile.studyGoals || []).map((g) => ({ ...emptyStudyGoal(), ...g })),
    studentPreferences: {
      destinationCountries: profile.studentPreferences?.destinationCountries || [],
      preferredCities: profile.studentPreferences?.preferredCities || [],
      fieldsOfStudy: profile.studentPreferences?.fieldsOfStudy || [],
      degreeLevels: profile.studentPreferences?.degreeLevels || [],
      targetIntake: profile.studentPreferences?.targetIntake || '',
      targetYear: profile.studentPreferences?.targetYear ?? '',
      studyMode: profile.studentPreferences?.studyMode || '',
      scholarshipRequired: Boolean(profile.studentPreferences?.scholarshipRequired),
      fundingPreference: profile.studentPreferences?.fundingPreference || '',
      preferredCurrency: profile.studentPreferences?.preferredCurrency || '',
    },
    budgetProfile: {
      tuition: {
        amountMinor: profile.budgetProfile?.tuition?.amountMinor ?? '',
        currency: profile.budgetProfile?.tuition?.currency || '',
      },
      living: {
        amountMinor: profile.budgetProfile?.living?.amountMinor ?? '',
        currency: profile.budgetProfile?.living?.currency || '',
      },
      general: {
        amountMinor: profile.budgetProfile?.general?.amountMinor ?? '',
        currency: profile.budgetProfile?.general?.currency || '',
      },
      period: profile.budgetProfile?.period || '',
      fundingSource: profile.budgetProfile?.fundingSource || '',
      notes: profile.budgetProfile?.notes || '',
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
    education: form.education,
    experience: form.experience.map((e) => ({
      ...e,
      achievements: (e.achievements || []).filter(Boolean),
    })),
    skills: form.skills,
    languages: form.languages,
    certificationReferences: form.certificationReferences,
    portfolioReferences: form.portfolioReferences.map((p) => ({
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
  return (arr || []).join(', ');
}
