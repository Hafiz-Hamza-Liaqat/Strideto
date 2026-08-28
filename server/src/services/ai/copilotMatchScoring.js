/**
 * COPILOT-P1 — Deterministic opportunity match scoring.
 *
 * Transparent, explainable matching — no fake ML precision.
 * Uses normalizeSkillName for skill overlap when available.
 */
import { normalizeSkillName } from '../../../../shared/career/skillVerification.js';
import {
  MATCH_LABEL,
  MATCH_SIGNAL,
  SCHOLARSHIP_ELIGIBILITY,
} from '../../../../shared/ai/copilotP1.js';
import { deriveJobWorkMode } from '../../../../shared/publicDiscovery/publicTruth.js';

function normSkill(s) {
  if (!s) return '';
  try {
    return normalizeSkillName(String(s)).toLowerCase();
  } catch {
    return String(s).trim().toLowerCase();
  }
}

function extractUserSkills(userContext) {
  const skills = userContext?.skills ?? [];
  return skills.map(normSkill).filter(Boolean);
}

function extractRequiredSkills(opportunity) {
  const req = opportunity.skillsRequired ?? opportunity.skillset ?? opportunity.requirements ?? [];
  const list = Array.isArray(req) ? req : (typeof req === 'string' ? req.split(/[,;|]/) : []);
  return list.map(normSkill).filter(Boolean);
}

function skillOverlap(userSkills, requiredSkills) {
  if (requiredSkills.length === 0) return { matched: [], gaps: [], unknown: true };
  const matched = [];
  const gaps = [];
  for (const req of requiredSkills) {
    const hit = userSkills.some((us) => us === req || us.includes(req) || req.includes(us));
    if (hit) matched.push(req);
    else gaps.push(req);
  }
  return { matched, gaps, unknown: userSkills.length === 0 };
}

function workModeCompatible(userMode, jobMode) {
  if (!jobMode || jobMode === 'unspecified') return MATCH_SIGNAL.UNKNOWN;
  if (!userMode) return MATCH_SIGNAL.UNKNOWN;
  if (userMode === jobMode) return MATCH_SIGNAL.MATCH;
  if (userMode === 'remote' && jobMode === 'hybrid') return MATCH_SIGNAL.GAP;
  if (userMode === 'hybrid' && jobMode === 'remote') return MATCH_SIGNAL.MATCH;
  return MATCH_SIGNAL.GAP;
}

function deriveMatchLabel(signalScore) {
  if (signalScore >= 3) return MATCH_LABEL.STRONG_FIT;
  if (signalScore >= 1) return MATCH_LABEL.POTENTIAL_FIT;
  if (signalScore <= -2) return MATCH_LABEL.STRETCH;
  return MATCH_LABEL.INSUFFICIENT_INFO;
}

/**
 * Score a job against user context.
 */
export function scoreJobMatch(job, userContext) {
  const userSkills = extractUserSkills(userContext);
  const requiredSkills = extractRequiredSkills(job);
  const { matched, gaps, unknown: skillsUnknown } = skillOverlap(userSkills, requiredSkills);

  const workMode = deriveJobWorkMode(job);
  const userWorkMode = userContext?.workPreferences?.workMode || null;
  const locationSignal = workModeCompatible(userWorkMode, workMode);

  let signalScore = 0;
  const reasons = [];
  const gapNotes = [];

  if (matched.length > 0) {
    signalScore += 2;
    reasons.push(`Skills overlap: ${matched.slice(0, 3).join(', ')}`);
  }
  if (gaps.length > 0 && !skillsUnknown) {
    signalScore -= 1;
    gapNotes.push(`Role mentions: ${gaps.slice(0, 3).join(', ')}`);
  }
  if (skillsUnknown) {
    gapNotes.push('Your profile has no skills listed — matching is limited');
  }
  if (locationSignal === MATCH_SIGNAL.MATCH) {
    signalScore += 1;
    reasons.push(`Work mode (${workMode}) aligns with your preference`);
  } else if (locationSignal === MATCH_SIGNAL.GAP) {
    gapNotes.push(`Work mode (${workMode}) may not match your preference (${userWorkMode})`);
  }

  const userCountries = userContext?.workPreferences?.preferredCountries ?? [];
  if (job.countryCode && userCountries.length > 0) {
    if (userCountries.includes(job.countryCode)) {
      signalScore += 1;
      reasons.push(`Location country (${job.countryCode}) matches your preferences`);
    } else if (workMode !== 'remote') {
      gapNotes.push(`Role is in ${job.countryCode}; your preferred countries differ`);
    }
  }

  return {
    matchLabel: deriveMatchLabel(signalScore),
    reasons: reasons.slice(0, 5),
    gaps: gapNotes.slice(0, 5),
    signals: {
      skills: skillsUnknown ? MATCH_SIGNAL.UNKNOWN : (matched.length > 0 ? MATCH_SIGNAL.MATCH : MATCH_SIGNAL.GAP),
      location: locationSignal,
      experience: MATCH_SIGNAL.UNKNOWN,
    },
    sortScore: signalScore,
  };
}

export function scoreInternshipMatch(internship, userContext) {
  const userSkills = extractUserSkills(userContext);
  const requiredSkills = extractRequiredSkills(internship);
  const { matched, gaps, unknown: skillsUnknown } = skillOverlap(userSkills, requiredSkills);

  let signalScore = 0;
  const reasons = [];
  const gapNotes = [];

  if (matched.length > 0) {
    signalScore += 2;
    reasons.push(`Skills overlap: ${matched.slice(0, 3).join(', ')}`);
  }
  if (gaps.length > 0 && !skillsUnknown) gapNotes.push(`Internship mentions: ${gaps.slice(0, 3).join(', ')}`);
  if (skillsUnknown) gapNotes.push('Add skills to your profile for better internship matching');

  const field = internship.field || internship.specialization;
  const userFields = [
    ...(userContext?.studyPreferences?.fieldsOfStudy ?? []),
    ...(userContext?.education ?? []).map((e) => e.field).filter(Boolean),
  ];
  if (field && userFields.some((f) => String(f).toLowerCase().includes(String(field).toLowerCase()))) {
    signalScore += 1;
    reasons.push(`Field aligns with your study/education interests`);
  }

  return {
    matchLabel: deriveMatchLabel(signalScore),
    reasons: reasons.slice(0, 5),
    gaps: gapNotes.slice(0, 5),
    sortScore: signalScore,
  };
}

export function deriveScholarshipEligibility(scholarship, userContext) {
  if (!userContext) return SCHOLARSHIP_ELIGIBILITY.INSUFFICIENT_INFORMATION;
  const hasEducation = (userContext.education?.length ?? 0) > 0;
  const hasStudyPrefs = (userContext.studyPreferences?.destinationCountries?.length ?? 0) > 0;
  if (!hasEducation && !hasStudyPrefs) return SCHOLARSHIP_ELIGIBILITY.INSUFFICIENT_INFORMATION;

  const countryMatch = scholarship.country && userContext.studyPreferences?.destinationCountries?.includes(scholarship.country);
  if (countryMatch && hasEducation) return SCHOLARSHIP_ELIGIBILITY.LIKELY_MATCH;
  if (hasEducation || hasStudyPrefs) return SCHOLARSHIP_ELIGIBILITY.POSSIBLE_MATCH;
  return SCHOLARSHIP_ELIGIBILITY.INSUFFICIENT_INFORMATION;
}

export function compareOpportunities(entities, type) {
  const dimensions = {
    job: ['title', 'company', 'location', 'workMode', 'experience', 'deadline', 'salaryRange'],
    internship: ['title', 'organization', 'location', 'workMode', 'duration', 'deadline'],
    scholarship: ['name', 'provider', 'country', 'fundingType', 'deadline'],
    program: ['name', 'institution', 'degreeLevel', 'field', 'country', 'tuitionFee', 'durationMonths'],
  };
  const dims = dimensions[type] || dimensions.job;
  return entities.map((e) => {
    const row = { id: e._id || e.entityId, type };
    for (const d of dims) {
      row[d] = e[d] ?? e[mapField(d)] ?? null;
      if (row[d] == null || row[d] === '') row[d] = 'Unknown / Not provided';
    }
    return row;
  });
}

function mapField(d) {
  const m = {
    company: 'company',
    organization: 'organization',
    institution: 'institutionName',
    name: 'name',
    title: 'title',
  };
  return m[d] || d;
}

export function profileGapForOpportunity(userContext, opportunity, type = 'job') {
  const gaps = [];
  const userSkills = extractUserSkills(userContext);
  const required = extractRequiredSkills(opportunity);
  if (required.length > 0 && userSkills.length === 0) {
    gaps.push({ field: 'skills', state: MATCH_SIGNAL.UNKNOWN, note: 'No skills in profile' });
  } else {
    const { gaps: skillGaps } = skillOverlap(userSkills, required);
    for (const g of skillGaps.slice(0, 5)) {
      gaps.push({ field: 'skills', state: MATCH_SIGNAL.GAP, note: g });
    }
  }
  if (type === 'job' && opportunity.experience && userContext?.experience?.length === 0) {
    gaps.push({ field: 'experience', state: MATCH_SIGNAL.UNKNOWN, note: 'Experience not in profile' });
  }
  return gaps;
}
