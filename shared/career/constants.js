/**
 * Canonical career domain constants (C.8.0.2A).
 */

export const TALENT_PROFILE_STATUSES = ['draft', 'active', 'archived'];

export const TALENT_PROFILE_VISIBILITY = ['private', 'public'];

export const RESUME_VERSION_STATUSES = ['draft', 'published', 'superseded'];

export const RESUME_TEMPLATES = [
  'modern-professional',
  'minimal-ats',
  'creative-portfolio',
  'academic-cv',
];

export const PROFILE_DOCUMENT_STATUSES = ['uploaded', 'verified', 'archived', 'deleted'];

export const PROFILE_DOCUMENT_TYPES = [
  'resume',
  'cover_letter',
  'certificate',
  'portfolio',
  'transcript',
  'other',
];

/** Canonical document types (C.8.0.5). Superset of profile document types. */
export const CANONICAL_DOCUMENT_TYPES = [
  'resume',
  'cv',
  'cover_letter',
  'transcript',
  'degree',
  'passport',
  'visa',
  'portfolio',
  'certificate',
  'other',
];

export const DOCUMENT_PARENT_TYPES = ['talent_profile', 'application', 'credential'];

export const DOCUMENT_STATUSES = ['active', 'archived', 'deleted'];

export const DOCUMENT_VISIBILITY = ['private', 'employer_scoped', 'public'];

export const DOCUMENT_DOWNLOAD_PERMISSIONS = ['owner_only', 'employer_scoped', 'public'];

export const CREDENTIAL_STATUSES = ['pending_verification', 'active', 'expired', 'revoked'];

export const CREDENTIAL_SOURCES = ['manual', 'assessment', 'import', 'hydration'];

export const SKILL_LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'];

export const SKILL_SOURCES = ['self_reported', 'verified', 'imported'];

export const WORK_MODES = ['onsite', 'remote', 'hybrid'];

export const EMPLOYMENT_STATUSES = [
  'employed',
  'unemployed',
  'student',
  'freelance',
  'self_employed',
  'open_to_work',
];

/**
 * Skill categories. Additive-only: 'technical' and 'soft' are the original
 * values and remain valid for all stored records. The rest were added so skill
 * claims and their evidence are not implicitly developer-shaped — a designer,
 * researcher, translator or accountant needs a category that fits their
 * evidence, not a forced choice between "technical" and "soft".
 */
export const SKILL_CATEGORIES = [
  'technical',
  'soft',
  'design',
  'business',
  'research',
  'language',
  'other',
];

export const LANGUAGE_PROFICIENCY = ['basic', 'conversational', 'professional', 'native'];

export const CAREER_DOMAIN_EVENTS = [
  'TalentProfileCreated',
  'TalentProfileUpdated',
  'ResumeVersionCreated',
  'ResumePublished',
  // OpportunityApplication (C.8.0.3A)
  'ApplicationCreated',
  'ApplicationUpdated',
  'StageChanged',
  'ApplicationWithdrawn',
  'NoteAdded',
  'ReminderCreated',
  'DocumentAttached',
  'OfferAccepted',
  'ApplicationArchived',
  'ContactAdded',
  'InterviewScheduled',
  'TimelineEventCreated',
  // Documents & Credentials (C.8.0.5)
  'DocumentCreated',
  'DocumentUpdated',
  'DocumentVersionCreated',
  'DocumentArchived',
  'CredentialIssued',
  'CredentialVerified',
  'CredentialRevoked',
  // Scoring / Readiness (C.8.2)
  'CareerScoreComputed',
  'CareerScoreUpdated',
  'ScoreSnapshotCreated',
  'ReadinessUpdated',
  // Assessments (C.8.4)
  'AssessmentPublished',
  'AssessmentStarted',
  'AssessmentCompleted',
  'AssessmentPassed',
  'AssessmentFailed',
  // Employer Intelligence (C.8.5)
  'CandidateViewed',
  'CandidateShortlisted',
  'InterviewCompleted',
  'OfferSent',
  'OfferRejected',
  'CandidateRejected',
  'CandidateHired',
  'HiringNoteAdded',
];

export const CAREER_SCORE_TYPES = [
  'career_readiness',
  'resume_strength',
  'employer_match',
  'technical_readiness',
  'interview_readiness',
  'learning_progress',
];


/** Canonical 13-stage pipeline (C.8.0.3A). */
export const PIPELINE_STAGES = [
  'interested',
  'preparing',
  'applied',
  'viewed',
  'screening',
  'assessment',
  'interview',
  'offer',
  'negotiation',
  'accepted',
  'joined',
  'rejected',
  'withdrawn',
];

export const TERMINAL_PIPELINE_STAGES = ['rejected', 'withdrawn', 'joined'];

export const OPPORTUNITY_TYPES = [
  'job',
  'internship',
  'scholarship',
  'admission',
  'graduate_program',
  'fellowship',
];

export const OPPORTUNITY_APPLICATION_STATUSES = ['active', 'archived'];

export const OPPORTUNITY_APPLICATION_SOURCES = ['platform', 'external', 'manual', 'migration'];

export const STAGE_TEMPLATE_IDS = [
  'job_default',
  'internship_default',
  'scholarship_default',
  'admission_default',
  'graduate_default',
  'fellowship_default',
];

export const APPLICATION_NOTE_VISIBILITY = ['private', 'employer_scoped'];

export const APPLICATION_DOCUMENT_ROLES = [
  'resume',
  'cover_letter',
  'transcript',
  'portfolio',
  'certificate',
  'other',
];

export const REMINDER_STATUSES = ['scheduled', 'sent', 'cancelled', 'failed'];

export const APPLICATION_CONTACT_ROLES = [
  'recruiter',
  'hiring_manager',
  'hr',
  'referrer',
  'other',
];

export const INTERVIEW_MODES = ['in_person', 'phone', 'video', 'other'];

export const ACTOR_TYPES = ['talent', 'employer', 'system', 'staff'];

// Mission 3 — student profile domain events
export const STUDENT_PROFILE_EVENTS = [
  'ExamScoreAdded',
  'ExamScoreUpdated',
  'ExamScoreRemoved',
  'StudyGoalAdded',
  'StudyGoalUpdated',
  'StudyGoalRemoved',
  'StudentPreferencesUpdated',
  'BudgetProfileUpdated',
];
