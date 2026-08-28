/**
 * COPILOT-P1 — User Context Builder.
 *
 * Loads a minimal, safe projection for Copilot from TalentProfile + User.
 * Never includes secrets, auth tokens, or internal RBAC data.
 *
 * userId MUST come from authenticated requester context — never from client body.
 */
import { TalentProfile } from '../../models/career/TalentProfile.js';
import { User } from '../../models/User.js';
import { stripSensitiveFields } from '../../../../shared/ai/copilotP1.js';

const PROFILE_COMPLETENESS_FIELDS = [
  'displayName',
  'skills',
  'education',
  'experience',
  'preferences',
  'studentPreferences',
  'careerGoals',
  'studyGoals',
];

function computeProfileCompleteness(profile) {
  if (!profile) return { score: 0, missing: PROFILE_COMPLETENESS_FIELDS };
  const missing = [];
  let filled = 0;
  const checks = [
    () => profile.displayName?.trim(),
    () => Array.isArray(profile.skills) && profile.skills.length > 0,
    () => Array.isArray(profile.education) && profile.education.length > 0,
    () => Array.isArray(profile.experience) && profile.experience.length > 0,
    () => profile.preferences && (profile.preferences.workMode || profile.preferences.preferredCountries?.length),
    () => profile.studentPreferences && (profile.studentPreferences.fieldsOfStudy?.length || profile.studentPreferences.destinationCountries?.length),
    () => Array.isArray(profile.careerGoals) && profile.careerGoals.length > 0,
    () => Array.isArray(profile.studyGoals) && profile.studyGoals.length > 0,
  ];
  const labels = ['display name', 'skills', 'education', 'experience', 'work preferences', 'study preferences', 'career goals', 'study goals'];
  checks.forEach((fn, i) => {
    if (fn()) filled += 1;
    else missing.push(labels[i]);
  });
  return { score: Math.round((filled / checks.length) * 100), missing };
}

function mapExperienceMonths(experience = []) {
  return experience.map((ex) => {
    let months = null;
    if (ex.startDate) {
      const start = new Date(ex.startDate);
      const end = ex.isCurrent ? new Date() : (ex.endDate ? new Date(ex.endDate) : null);
      if (!Number.isNaN(start.getTime()) && end && !Number.isNaN(end.getTime())) {
        months = Math.max(0, Math.round((end - start) / (1000 * 60 * 60 * 24 * 30.44)));
      }
    }
    return {
      role: ex.role || null,
      company: ex.company || null,
      location: ex.location || null,
      country: ex.country || null,
      employmentType: ex.employmentType || null,
      isCurrent: ex.isCurrent === true,
      months,
    };
  });
}

/**
 * Build safe user context for Copilot.
 * @param {string} userId - from authenticated session only
 */
export async function buildUserCopilotContext(userId) {
  const [profile, user] = await Promise.all([
    TalentProfile.findOne({ userId }).lean(),
    User.findById(userId).select('name countryCode region city savedJobs savedScholarships savedInternships savedAdmissions savedIntlScholarships onboardingGoal careerPreferences').lean(),
  ]);

  if (!profile && !user) return null;

  const completeness = computeProfileCompleteness(profile);
  const skillNames = (profile?.skills ?? []).map((s) => (typeof s === 'string' ? s : s?.name)).filter(Boolean);

  const ctx = {
    userId: String(userId),
    displayName: profile?.displayName || user?.name || null,
    headline: profile?.headline || null,
    country: profile?.personal?.country || user?.countryCode || null,
    region: user?.region || profile?.personal?.region || null,
    city: user?.city || profile?.personal?.city || null,
    nationality: profile?.personal?.nationality || null,
    education: (profile?.education ?? []).slice(0, 10).map((e) => ({
      degree: e.degree || e.qualificationLevel || null,
      field: e.fieldOfStudy || null,
      institution: e.institution || null,
      country: e.country || null,
      graduationYear: e.graduationYear || e.endYear || null,
    })),
    experience: mapExperienceMonths(profile?.experience ?? []).slice(0, 10),
    skills: skillNames.slice(0, 50),
    skillDetails: (profile?.skills ?? []).slice(0, 50).map((s) => ({
      name: s.name,
      level: s.level || null,
      yearsOfExperience: s.yearsOfExperience ?? null,
      category: s.category || null,
    })),
    careerGoals: (profile?.careerGoals ?? []).filter((g) => g.status === 'active').slice(0, 5).map((g) => ({
      title: g.title,
      targetDate: g.targetDate || null,
    })),
    studyGoals: (profile?.studyGoals ?? []).filter((g) => g.status === 'active').slice(0, 5).map((g) => ({
      goalType: g.goalType,
      fieldOfStudy: g.fieldOfStudy || null,
      degreeLevel: g.degreeLevel || null,
      destinationCountries: g.destinationCountries || [],
    })),
    workPreferences: {
      workMode: profile?.preferences?.workMode || null,
      preferredCountries: profile?.preferences?.preferredCountries || [],
      preferredIndustries: profile?.preferences?.preferredIndustries || [],
      willingToRelocate: profile?.preferences?.willingToRelocate ?? null,
    },
    studyPreferences: {
      destinationCountries: profile?.studentPreferences?.destinationCountries || [],
      fieldsOfStudy: profile?.studentPreferences?.fieldsOfStudy || [],
      degreeLevels: profile?.studentPreferences?.degreeLevels || [],
      studyMode: profile?.studentPreferences?.studyMode || null,
    },
    examScores: (profile?.examScores ?? []).slice(0, 10).map((t) => ({
      testType: t.testType,
      overallScore: t.overallScore ?? null,
      status: t.status || null,
    })),
    profileCompleteness: completeness.score,
    missingProfileFields: completeness.missing,
    savedCounts: {
      jobs: user?.savedJobs?.length ?? 0,
      scholarships: user?.savedScholarships?.length ?? 0,
      internships: user?.savedInternships?.length ?? 0,
      admissions: user?.savedAdmissions?.length ?? 0,
      intlScholarships: user?.savedIntlScholarships?.length ?? 0,
    },
    onboardingGoal: user?.onboardingGoal || null,
  };

  return stripSensitiveFields(ctx);
}

/** Re-export for Mission 19 compatibility */
export async function loadStudentContextProjection(userId) {
  return buildUserCopilotContext(userId);
}
