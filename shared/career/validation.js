/**
 * Shared TalentProfile validation (C.8.0.2A / Mission 3).
 */
import {
  TALENT_PROFILE_STATUSES,
  TALENT_PROFILE_VISIBILITY,
  RESUME_VERSION_STATUSES,
  RESUME_TEMPLATES,
  PROFILE_DOCUMENT_STATUSES,
  PROFILE_DOCUMENT_TYPES,
  CREDENTIAL_STATUSES,
  CREDENTIAL_SOURCES,
  SKILL_LEVELS,
  SKILL_SOURCES,
  WORK_MODES,
  LANGUAGE_PROFICIENCY,
  OPPORTUNITY_TYPES,
  OPPORTUNITY_APPLICATION_STATUSES,
  OPPORTUNITY_APPLICATION_SOURCES,
  PIPELINE_STAGES,
  APPLICATION_NOTE_VISIBILITY,
  APPLICATION_DOCUMENT_ROLES,
  REMINDER_STATUSES,
  ACTOR_TYPES,
  APPLICATION_CONTACT_ROLES,
  INTERVIEW_MODES,
  CANONICAL_DOCUMENT_TYPES,
  DOCUMENT_PARENT_TYPES,
  DOCUMENT_STATUSES,
  DOCUMENT_VISIBILITY,
  DOCUMENT_DOWNLOAD_PERMISSIONS,
} from './constants.js';
import { TIMELINE_VERBS, TIMELINE_OBJECT_TYPES } from './timelineVerbs.js';
import { normalizeLocale } from '../localization/localeResolver.js';
import { canTransition, resolveStageTemplateId } from './applicationStageMachine.js';
import { canonicalizeStoredPhone } from '../international/phone.js';
import {
  parseExamScoreEntry,
  validateExamScoreEntry,
  parseStudyGoalEntry,
  validateStudyGoalEntry,
  parseStudentPreferences,
  validateStudentPreferences,
  parseBudgetProfile,
  validateBudgetProfile,
  parseEducationEntry,
  validateEducationEntry,
  parseExperienceEntry,
  validateExperienceEntry,
} from './studentProfileValidation.js';

const SET = (arr) => new Set(arr);

function trimStr(v, max = 500) {
  return String(v ?? '').trim().slice(0, max);
}

function normalizeStringArray(arr, maxItems = 50, maxLen = 120) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((x) => trimStr(x, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);
}

function validateEnum(value, allowed, field) {
  if (value == null || value === '') return [];
  if (!allowed.has(value)) return [`${field} must be one of: ${[...allowed].join(', ')}`];
  return [];
}

export function validateSocialProfile(input = {}) {
  const errors = [];
  if (!input || typeof input !== 'object') return errors;
  for (const key of ['linkedInUrl', 'githubUrl', 'portfolioUrl', 'twitterUrl', 'websiteUrl']) {
    if (input[key] != null && typeof input[key] !== 'string') errors.push(`${key} must be a string`);
  }
  return errors;
}

export function validateCareerPreference(input = {}) {
  const errors = [];
  if (!input || typeof input !== 'object') return errors;
  if (input.workMode != null) errors.push(...validateEnum(input.workMode, SET(WORK_MODES), 'workMode'));
  if (input.preferredMarkets != null && !Array.isArray(input.preferredMarkets)) {
    errors.push('preferredMarkets must be an array');
  }
  if (input.preferredIndustries != null && !Array.isArray(input.preferredIndustries)) {
    errors.push('preferredIndustries must be an array');
  }
  if (input.salaryExpectation != null && typeof input.salaryExpectation !== 'object') {
    errors.push('salaryExpectation must be an object');
  }
  return errors;
}

export function validateLanguageSkill(input = {}) {
  const errors = [];
  if (!input || typeof input !== 'object') return errors;
  if (!trimStr(input.language)) errors.push('language is required');
  if (input.proficiency != null) {
    errors.push(...validateEnum(input.proficiency, SET(LANGUAGE_PROFICIENCY), 'proficiency'));
  }
  return errors;
}

export function validateSkillEntry(input = {}) {
  const errors = [];
  if (!input || typeof input !== 'object') return errors;
  if (!trimStr(input.name)) errors.push('skill name is required');
  if (input.level != null) errors.push(...validateEnum(input.level, SET(SKILL_LEVELS), 'level'));
  if (input.source != null) errors.push(...validateEnum(input.source, SET(SKILL_SOURCES), 'source'));
  return errors;
}

/**
 * Whitelist and normalize TalentProfile patch/create body.
 * @param {object} body
 * @param {{ partial?: boolean }} [options]
 */
export function parseTalentProfileInput(body = {}, options = {}) {
  const partial = Boolean(options.partial);
  const out = {};

  const set = (key, val) => {
    if (val !== undefined) out[key] = val;
  };

  if (body.displayName !== undefined) set('displayName', trimStr(body.displayName, 120));
  if (body.headline !== undefined) set('headline', trimStr(body.headline, 200));
  if (body.summary !== undefined) set('summary', trimStr(body.summary, 5000));
  if (body.publicSlug !== undefined) {
    const slug = trimStr(body.publicSlug, 80).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
    set('publicSlug', slug);
  }
  if (body.status !== undefined) set('status', trimStr(body.status, 20));
  if (body.visibility !== undefined) set('visibility', trimStr(body.visibility, 20));
  if (body.locale !== undefined) set('locale', normalizeLocale(body.locale));
  if (body.market !== undefined) set('market', trimStr(body.market, 80));
  if (body.avatarUrl !== undefined) set('avatarUrl', trimStr(body.avatarUrl, 500));

  if (body.personal !== undefined && typeof body.personal === 'object') {
    const p = body.personal;
    out.personal = {
      firstName: trimStr(p.firstName, 80),
      lastName: trimStr(p.lastName, 80),
      dateOfBirth: p.dateOfBirth ? new Date(p.dateOfBirth) : undefined,
      gender: trimStr(p.gender, 40),
      nationality: trimStr(p.nationality, 80),
      country: trimStr(p.country, 80),
      region: trimStr(p.region, 80),
      city: trimStr(p.city, 80),
      phone: trimStr(p.phone, 40),
      timeZone: trimStr(p.timeZone, 80),
    };
  }

  if (body.socialProfile !== undefined && typeof body.socialProfile === 'object') {
    out.socialProfile = {
      linkedInUrl: trimStr(body.socialProfile.linkedInUrl, 300),
      githubUrl: trimStr(body.socialProfile.githubUrl, 300),
      portfolioUrl: trimStr(body.socialProfile.portfolioUrl, 300),
      twitterUrl: trimStr(body.socialProfile.twitterUrl, 300),
      websiteUrl: trimStr(body.socialProfile.websiteUrl, 300),
    };
  }

  if (body.preferences !== undefined && typeof body.preferences === 'object') {
    const p = body.preferences;
    out.preferences = {
      workMode: p.workMode ? trimStr(p.workMode, 20) : undefined,
      preferredMarkets: normalizeStringArray(p.preferredMarkets, 20, 80),
      preferredIndustries: normalizeStringArray(p.preferredIndustries, 30, 80),
      preferredCountries: normalizeStringArray(p.preferredCountries, 30, 80),
      willingToRelocate: Boolean(p.willingToRelocate),
      salaryExpectation: p.salaryExpectation && typeof p.salaryExpectation === 'object'
        ? {
            min: p.salaryExpectation.min != null ? Number(p.salaryExpectation.min) : undefined,
            max: p.salaryExpectation.max != null ? Number(p.salaryExpectation.max) : undefined,
            currency: trimStr(p.salaryExpectation.currency, 8),
            period: trimStr(p.salaryExpectation.period, 20),
          }
        : undefined,
      employmentStatus: p.employmentStatus ? trimStr(p.employmentStatus, 40) : undefined,
      timeZone: p.timeZone ? trimStr(p.timeZone, 80) : undefined,
    };
  }

  if (body.availability !== undefined && typeof body.availability === 'object') {
    const a = body.availability;
    out.availability = {
      availableFrom: a.availableFrom ? new Date(a.availableFrom) : undefined,
      noticePeriodDays: a.noticePeriodDays != null ? Number(a.noticePeriodDays) : undefined,
      hoursPerWeek: a.hoursPerWeek != null ? Number(a.hoursPerWeek) : undefined,
    };
  }

  const arrayFields = [
    ['education', body.education],
    ['experience', body.experience],
    ['careerGoals', body.careerGoals],
    ['interests', body.interests],
    ['certificationReferences', body.certificationReferences],
    ['portfolioReferences', body.portfolioReferences],
  ];

  for (const [key, val] of arrayFields) {
    if (val !== undefined) {
      out[key] = Array.isArray(val) ? val.slice(0, 100) : [];
    }
  }

  if (body.skills !== undefined) {
    out.skills = Array.isArray(body.skills) ? body.skills.slice(0, 200) : [];
  }
  if (body.languages !== undefined) {
    out.languages = Array.isArray(body.languages) ? body.languages.slice(0, 30) : [];
  }

  // Mission 3 — student profile extensions
  if (body.examScores !== undefined) {
    out.examScores = Array.isArray(body.examScores)
      ? body.examScores.slice(0, 30).map(parseExamScoreEntry)
      : [];
  }
  if (body.studyGoals !== undefined) {
    out.studyGoals = Array.isArray(body.studyGoals)
      ? body.studyGoals.slice(0, 20).map(parseStudyGoalEntry)
      : [];
  }
  if (body.studentPreferences !== undefined && typeof body.studentPreferences === 'object') {
    out.studentPreferences = parseStudentPreferences(body.studentPreferences);
  }
  if (body.budgetProfile !== undefined && typeof body.budgetProfile === 'object') {
    out.budgetProfile = parseBudgetProfile(body.budgetProfile);
  }

  if (!partial && !out.displayName) {
    out.displayName = '';
  }

  return out;
}

/**
 * @param {object} input - parsed profile input
 * @param {{ partial?: boolean }} [options]
 * @returns {string[]}
 */
export function validateTalentProfileInput(input = {}, options = {}) {
  const errors = [];
  const partial = Boolean(options.partial);

  if (!partial && !trimStr(input.displayName)) {
    errors.push('displayName is required');
  }

  if (input.status != null) errors.push(...validateEnum(input.status, SET(TALENT_PROFILE_STATUSES), 'status'));
  if (input.visibility != null) {
    errors.push(...validateEnum(input.visibility, SET(TALENT_PROFILE_VISIBILITY), 'visibility'));
  }

  if (input.socialProfile) errors.push(...validateSocialProfile(input.socialProfile));
  if (input.preferences) errors.push(...validateCareerPreference(input.preferences));

  if (Array.isArray(input.skills)) {
    for (let i = 0; i < input.skills.length; i += 1) {
      errors.push(...validateSkillEntry(input.skills[i]).map((e) => `skills[${i}]: ${e}`));
    }
  }

  if (Array.isArray(input.languages)) {
    for (let i = 0; i < input.languages.length; i += 1) {
      errors.push(...validateLanguageSkill(input.languages[i]).map((e) => `languages[${i}]: ${e}`));
    }
  }

  // Mission 3 student profile extensions
  if (Array.isArray(input.education)) {
    for (let i = 0; i < input.education.length; i += 1) {
      errors.push(...validateEducationEntry(input.education[i]).map((e) => `education[${i}]: ${e}`));
    }
  }
  if (Array.isArray(input.experience)) {
    for (let i = 0; i < input.experience.length; i += 1) {
      errors.push(...validateExperienceEntry(input.experience[i]).map((e) => `experience[${i}]: ${e}`));
    }
  }
  if (Array.isArray(input.examScores)) {
    for (let i = 0; i < input.examScores.length; i += 1) {
      errors.push(...validateExamScoreEntry(input.examScores[i]).map((e) => `examScores[${i}]: ${e}`));
    }
  }
  if (Array.isArray(input.studyGoals)) {
    for (let i = 0; i < input.studyGoals.length; i += 1) {
      errors.push(...validateStudyGoalEntry(input.studyGoals[i]).map((e) => `studyGoals[${i}]: ${e}`));
    }
  }
  if (input.studentPreferences != null) {
    errors.push(...validateStudentPreferences(input.studentPreferences).map((e) => `studentPreferences: ${e}`));
  }
  if (input.budgetProfile != null) {
    errors.push(...validateBudgetProfile(input.budgetProfile).map((e) => `budgetProfile: ${e}`));
  }

  return errors;
}

// Re-export student profile helpers so callers can use one import
export {
  parseExamScoreEntry,
  validateExamScoreEntry,
  parseStudyGoalEntry,
  validateStudyGoalEntry,
  parseStudentPreferences,
  validateStudentPreferences,
  parseBudgetProfile,
  validateBudgetProfile,
  parseEducationEntry,
  validateEducationEntry,
  parseExperienceEntry,
  validateExperienceEntry,
} from './studentProfileValidation.js';

/**
 * @param {object} body
 * @param {{ partial?: boolean }} [options]
 */
export function validateResumeVersionInput(body = {}, options = {}) {
  const errors = [];
  const partial = Boolean(options.partial);

  if (!partial && !trimStr(body.title)) errors.push('title is required');
  if (body.status != null) errors.push(...validateEnum(body.status, SET(RESUME_VERSION_STATUSES), 'status'));
  if (body.template != null) errors.push(...validateEnum(body.template, SET(RESUME_TEMPLATES), 'template'));

  return errors;
}

export function parseResumeVersionInput(body = {}) {
  const out = {};
  if (body.title !== undefined) out.title = trimStr(body.title, 120);
  if (body.template !== undefined) out.template = trimStr(body.template, 40);
  if (body.status !== undefined) out.status = trimStr(body.status, 20);
  if (body.isPrimary !== undefined) out.isPrimary = Boolean(body.isPrimary);
  if (body.snapshot !== undefined && typeof body.snapshot === 'object') out.snapshot = body.snapshot;
  return out;
}

export function validateProfileDocumentInput(body = {}) {
  const errors = [];
  if (!trimStr(body.label)) errors.push('label is required');
  if (body.documentType != null) {
    errors.push(...validateEnum(body.documentType, SET(PROFILE_DOCUMENT_TYPES), 'documentType'));
  }
  if (body.status != null) {
    errors.push(...validateEnum(body.status, SET(PROFILE_DOCUMENT_STATUSES), 'status'));
  }
  return errors;
}

export function parseProfileDocumentInput(body = {}) {
  return {
    label: body.label !== undefined ? trimStr(body.label, 200) : undefined,
    documentType: body.documentType !== undefined ? trimStr(body.documentType, 40) : undefined,
    mediaAssetId: body.mediaAssetId,
    visibility: body.visibility !== undefined ? trimStr(body.visibility, 20) : undefined,
    status: body.status !== undefined ? trimStr(body.status, 20) : undefined,
  };
}

export function validateCredentialInput(body = {}) {
  const errors = [];
  if (!trimStr(body.title)) errors.push('title is required');
  if (body.verificationStatus != null) {
    errors.push(...validateEnum(body.verificationStatus, SET(CREDENTIAL_STATUSES), 'verificationStatus'));
  }
  if (body.source != null) errors.push(...validateEnum(body.source, SET(CREDENTIAL_SOURCES), 'source'));
  return errors;
}

export function parseCredentialInput(body = {}) {
  return {
    title: body.title !== undefined ? trimStr(body.title, 200) : undefined,
    issuer: body.issuer !== undefined ? trimStr(body.issuer, 200) : undefined,
    description: body.description !== undefined ? trimStr(body.description, 2000) : undefined,
    verificationStatus: body.verificationStatus !== undefined ? trimStr(body.verificationStatus, 30) : undefined,
    source: body.source !== undefined ? trimStr(body.source, 20) : undefined,
    issuedAt: body.issuedAt,
    expiresAt: body.expiresAt,
    documentId: body.documentId,
    mediaAssetId: body.mediaAssetId,
    skillName: body.skillName !== undefined ? trimStr(body.skillName, 120) : undefined,
    score: body.score !== undefined ? Number(body.score) : undefined,
    assessmentAttemptId: body.assessmentAttemptId,
    metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : undefined,
  };
}

// Canonical Document (C.8.0.5)

export function parseDocumentInput(body = {}) {
  return {
    label: body.label !== undefined ? trimStr(body.label, 200) : undefined,
    documentType: body.documentType !== undefined ? trimStr(body.documentType, 40) : undefined,
    parentType: body.parentType !== undefined ? trimStr(body.parentType, 40) : 'talent_profile',
    parentId: body.parentId,
    mediaAssetId: body.mediaAssetId,
    visibility: body.visibility !== undefined ? trimStr(body.visibility, 20) : undefined,
    downloadPermission: body.downloadPermission !== undefined ? trimStr(body.downloadPermission, 20) : undefined,
    status: body.status !== undefined ? trimStr(body.status, 20) : undefined,
    tags: Array.isArray(body.tags) ? body.tags.map((t) => trimStr(t, 60)).filter(Boolean) : undefined,
    expiresAt: body.expiresAt,
    metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : undefined,
  };
}

export function validateDocumentInput(body = {}, options = {}) {
  const partial = Boolean(options.partial);
  const errors = [];
  if (!partial && !trimStr(body.label)) errors.push('label is required');
  if (body.documentType != null) {
    errors.push(...validateEnum(body.documentType, SET(CANONICAL_DOCUMENT_TYPES), 'documentType'));
  }
  if (body.parentType != null) {
    errors.push(...validateEnum(body.parentType, SET(DOCUMENT_PARENT_TYPES), 'parentType'));
  }
  if (body.visibility != null) {
    errors.push(...validateEnum(body.visibility, SET(DOCUMENT_VISIBILITY), 'visibility'));
  }
  if (body.downloadPermission != null) {
    errors.push(...validateEnum(body.downloadPermission, SET(DOCUMENT_DOWNLOAD_PERMISSIONS), 'downloadPermission'));
  }
  if (body.status != null) {
    errors.push(...validateEnum(body.status, SET(DOCUMENT_STATUSES), 'status'));
  }
  if (!partial && !body.mediaAssetId && !trimStr(body.metadata?.fileUrl)) {
    errors.push('mediaAssetId or uploaded file is required');
  }
  return errors;
}

// --- OpportunityApplication (C.8.0.3A) ---

export function validateOpportunityReference(input = {}) {
  const errors = [];
  if (!input || typeof input !== 'object') return ['opportunityRef is required'];
  if (!trimStr(input.opportunityType)) errors.push('opportunityType is required');
  else if (!OPPORTUNITY_TYPES.includes(input.opportunityType)) {
    errors.push(`opportunityType must be one of: ${OPPORTUNITY_TYPES.join(', ')}`);
  }
  if (input.opportunityId != null && !String(input.opportunityId).match(/^[a-f\d]{24}$/i)) {
    errors.push('opportunityId must be a valid ObjectId');
  }
  return errors;
}

export function parseOpportunityReference(input = {}) {
  if (!input || typeof input !== 'object') return null;
  return {
    opportunityType: trimStr(input.opportunityType, 40),
    opportunityId: input.opportunityId ? String(input.opportunityId) : null,
    locale: input.locale ? trimStr(input.locale, 10) : undefined,
    market: input.market ? trimStr(input.market, 80) : undefined,
  };
}

export function parseOpportunityApplicationInput(body = {}, options = {}) {
  const partial = Boolean(options.partial);
  const out = {};
  const set = (k, v) => { if (v !== undefined) out[k] = v; };

  if (body.opportunityRef !== undefined) set('opportunityRef', parseOpportunityReference(body.opportunityRef));
  if (body.opportunityType !== undefined) {
    set('opportunityRef', parseOpportunityReference({
      opportunityType: body.opportunityType,
      opportunityId: body.opportunityId ?? body.opportunityRef?.opportunityId ?? null,
      locale: body.locale,
      market: body.market,
    }));
  }
  if (body.title !== undefined) set('title', trimStr(body.title, 300));
  if (body.externalUrl !== undefined) set('externalUrl', trimStr(body.externalUrl, 2000));
  if (body.companyName !== undefined) set('companyName', trimStr(body.companyName, 200));
  if (body.source !== undefined) set('source', trimStr(body.source, 20));
  if (body.locale !== undefined) set('locale', trimStr(body.locale, 10));
  if (body.market !== undefined) set('market', trimStr(body.market, 80));
  if (body.organizationId !== undefined) set('organizationId', body.organizationId);
  if (body.pipelineStage !== undefined) set('pipelineStage', trimStr(body.pipelineStage, 40));
  if (body.status !== undefined) set('status', trimStr(body.status, 20));
  if (body.metadata !== undefined && typeof body.metadata === 'object') set('metadata', body.metadata);

  if (!partial && !out.opportunityRef?.opportunityType && !body.externalUrl) {
    // external manual apps allowed without opportunityId
  }

  return out;
}

export function validateOpportunityApplicationInput(body = {}, options = {}) {
  const errors = [];
  const partial = Boolean(options.partial);

  if (!partial) {
    const type = body.opportunityRef?.opportunityType || body.opportunityType;
    if (!type) errors.push('opportunityType is required');
    else if (!OPPORTUNITY_TYPES.includes(type)) {
      errors.push(`opportunityType must be one of: ${OPPORTUNITY_TYPES.join(', ')}`);
    }
    const oppId = body.opportunityRef?.opportunityId ?? body.opportunityId;
    if (oppId != null && !String(oppId).match(/^[a-f\d]{24}$/i)) {
      errors.push('opportunityId must be a valid ObjectId');
    }
    if (!oppId && !body.externalUrl && !trimStr(body.title) && body.source !== 'external') {
      errors.push('opportunityId or external application details required');
    }
  }

  if (body.source != null) {
    errors.push(...validateEnum(body.source, SET(OPPORTUNITY_APPLICATION_SOURCES), 'source'));
  }
  if (body.status != null) {
    errors.push(...validateEnum(body.status, SET(OPPORTUNITY_APPLICATION_STATUSES), 'status'));
  }
  if (body.pipelineStage != null && !PIPELINE_STAGES.includes(body.pipelineStage)) {
    errors.push(`pipelineStage must be one of: ${PIPELINE_STAGES.join(', ')}`);
  }
  return errors;
}

export function validateStageTransitionInput(body = {}, fromStage, opportunityType) {
  const errors = [];
  const toStage = trimStr(body.toStage || body.stage, 40);
  if (!toStage) errors.push('toStage is required');
  else if (!PIPELINE_STAGES.includes(toStage)) {
    errors.push(`toStage must be one of: ${PIPELINE_STAGES.join(', ')}`);
  } else if (fromStage && opportunityType && !canTransition(resolveStageTemplateId(opportunityType), fromStage, toStage)) {
    errors.push(`Invalid transition from ${fromStage} to ${toStage}`);
  }
  if (body.byActorType != null) errors.push(...validateEnum(body.byActorType, SET(ACTOR_TYPES), 'byActorType'));
  return errors;
}

export function parseApplicationNoteInput(body = {}) {
  return {
    body: body.body !== undefined ? trimStr(body.body, 10000) : undefined,
    visibility: body.visibility !== undefined ? trimStr(body.visibility, 20) : 'private',
  };
}

export function validateApplicationNoteInput(body = {}) {
  const errors = [];
  if (!trimStr(body.body)) errors.push('note body is required');
  if (body.visibility != null) {
    errors.push(...validateEnum(body.visibility, SET(APPLICATION_NOTE_VISIBILITY), 'visibility'));
  }
  return errors;
}

export function parseApplicationDocumentReferenceInput(body = {}) {
  return {
    profileDocumentId: body.profileDocumentId,
    documentId: body.documentId,
    label: body.label !== undefined ? trimStr(body.label, 200) : undefined,
    role: body.role !== undefined ? trimStr(body.role, 40) : 'other',
    url: body.url !== undefined ? trimStr(body.url, 2000) : undefined,
  };
}

export function validateApplicationDocumentReferenceInput(body = {}) {
  const errors = [];
  if (!body.profileDocumentId && !body.documentId && !trimStr(body.url)) {
    errors.push('documentId, profileDocumentId, or url is required');
  }
  if (body.role != null) errors.push(...validateEnum(body.role, SET(APPLICATION_DOCUMENT_ROLES), 'role'));
  return errors;
}

export function parseReminderReferenceInput(body = {}) {
  return {
    title: body.title !== undefined ? trimStr(body.title, 200) : undefined,
    remindAt: body.remindAt,
    channel: body.channel !== undefined ? trimStr(body.channel, 40) : 'in_app',
    status: body.status !== undefined ? trimStr(body.status, 20) : 'scheduled',
    metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : undefined,
  };
}

export function validateReminderReferenceInput(body = {}) {
  const errors = [];
  if (!trimStr(body.title)) errors.push('reminder title is required');
  if (!body.remindAt) errors.push('remindAt is required');
  if (body.status != null) errors.push(...validateEnum(body.status, SET(REMINDER_STATUSES), 'status'));
  return errors;
}

export function parseApplicationContactInput(body = {}) {
  const phoneResult = body.phone !== undefined ? canonicalizeStoredPhone(body.phone) : { ok: true, value: '' };
  return {
    name: body.name !== undefined ? trimStr(body.name, 120) : undefined,
    role: body.role !== undefined ? trimStr(body.role, 40) : 'recruiter',
    email: body.email !== undefined ? trimStr(body.email, 200) : '',
    phone: phoneResult.ok ? phoneResult.value : '__invalid_phone__',
    organization: body.organization !== undefined ? trimStr(body.organization, 200) : '',
    notes: body.notes !== undefined ? trimStr(body.notes, 1000) : '',
  };
}

export function validateApplicationContactInput(body = {}) {
  const errors = [];
  if (!trimStr(body.name)) errors.push('contact name is required');
  if (body.role != null) errors.push(...validateEnum(body.role, SET(APPLICATION_CONTACT_ROLES), 'role'));
  if (body.phone && !canonicalizeStoredPhone(body.phone).ok) {
    errors.push('phone must be a valid international number');
  }
  return errors;
}

export function parseInterviewScheduleInput(body = {}) {
  return {
    scheduledAt: body.scheduledAt || null,
    mode: body.mode !== undefined ? trimStr(body.mode, 40) : 'video',
    location: body.location !== undefined ? trimStr(body.location, 300) : '',
    meetingUrl: body.meetingUrl !== undefined ? trimStr(body.meetingUrl, 2000) : '',
    notes: body.notes !== undefined ? trimStr(body.notes, 2000) : '',
    outcome: body.outcome !== undefined ? trimStr(body.outcome, 200) : '',
  };
}

export function validateInterviewScheduleInput(body = {}) {
  const errors = [];
  if (body.mode != null) errors.push(...validateEnum(body.mode, SET(INTERVIEW_MODES), 'mode'));
  if (body.scheduledAt && Number.isNaN(new Date(body.scheduledAt).getTime())) {
    errors.push('scheduledAt must be a valid date');
  }
  return errors;
}

// Timeline (C.8.0.4)

const TIMELINE_VERB_SET = new Set(TIMELINE_VERBS);
const TIMELINE_OBJECT_SET = new Set(TIMELINE_OBJECT_TYPES);

export function parseTimelineQueryInput(query = {}) {
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 25));
  return {
    limit,
    cursor: trimStr(query.cursor, 200) || undefined,
    verb: query.verb !== undefined ? trimStr(query.verb, 80) : undefined,
    objectType: query.objectType !== undefined ? trimStr(query.objectType, 40) : undefined,
    objectId: query.objectId !== undefined ? trimStr(query.objectId, 80) : undefined,
    since: query.since ? new Date(query.since) : undefined,
    until: query.until ? new Date(query.until) : undefined,
  };
}

export function validateTimelineQueryInput(parsed = {}) {
  const errors = [];
  if (parsed.verb != null && !TIMELINE_VERB_SET.has(parsed.verb)) {
    errors.push(`verb must be one of: ${TIMELINE_VERBS.join(', ')}`);
  }
  if (parsed.objectType != null && !TIMELINE_OBJECT_SET.has(parsed.objectType)) {
    errors.push(`objectType must be one of: ${TIMELINE_OBJECT_TYPES.join(', ')}`);
  }
  if (parsed.since instanceof Date && Number.isNaN(parsed.since.getTime())) {
    errors.push('since must be a valid date');
  }
  if (parsed.until instanceof Date && Number.isNaN(parsed.until.getTime())) {
    errors.push('until must be a valid date');
  }
  return errors;
}
