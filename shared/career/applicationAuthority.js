/**
 * Student application channel + stage-write authority (Phase 3).
 *
 * Internal Strideto employer applications: Employer/server owns workflow
 * states (viewed / screening / interview / offer / hired / rejected).
 * Students may submit and withdraw; they must not write Employer states.
 *
 * External personal trackers: Student may maintain "My tracking status".
 * That status is never Employer-confirmed.
 *
 * Institution applications (student-side): same Student write set as
 * internal employer until Phase 6/8 own institution workflow.
 */
import { getAllowedTransitions } from './applicationStageMachine.js';

export const APPLICATION_CHANNELS = Object.freeze({
  INTERNAL_EMPLOYER: 'internal_employer',
  EXTERNAL_PERSONAL: 'external_personal',
  INSTITUTION: 'institution',
});

export const STAGE_AUTHORITY = Object.freeze({
  EMPLOYER: 'employer',
  INSTITUTION: 'institution',
  PERSONAL: 'personal',
});

/** Employer-authoritative workflow states Students must not write. */
export const EMPLOYER_AUTHORITATIVE_STAGES = Object.freeze([
  'viewed',
  'screening',
  'assessment',
  'interview',
  'offer',
  'negotiation',
  'accepted',
  'joined',
  'rejected',
]);

/** Pre-submit stages students may write before employer/institution pipeline ownership. */
export const STUDENT_WRITABLE_INTERNAL_STAGES = Object.freeze([
  'interested',
  'preparing',
  'applied',
]);

/** Stages students may set on external personal trackers (never employer-confirmed). */
export const STUDENT_WRITABLE_EXTERNAL_STAGES = Object.freeze([
  'interested',
  'preparing',
  'applied',
  'withdrawn',
]);

const PRE_APPLY_STAGES = new Set(['interested', 'preparing']);

const EMPLOYER_TYPES = new Set(['job', 'internship']);
const INSTITUTION_TYPES = new Set([
  'admission',
  'scholarship',
  'fellowship',
  'graduate_program',
]);

function opportunityTypeOf(app = {}) {
  return String(app.opportunityRef?.opportunityType || app.opportunityType || '').trim();
}

function opportunityIdOf(app = {}) {
  return app.opportunityRef?.opportunityId || app.opportunityId || null;
}

export function isEmployerAuthoritativeStage(stage) {
  return EMPLOYER_AUTHORITATIVE_STAGES.includes(String(stage || ''));
}

export function resolveApplicationChannel(app = {}) {
  const source = String(app.source || 'platform');
  const type = opportunityTypeOf(app);
  const opportunityId = opportunityIdOf(app);
  const employerLinked = Boolean(app.legacyApplicationId || app.organizationId);

  if (source === 'external' || source === 'manual' || !opportunityId) {
    return APPLICATION_CHANNELS.EXTERNAL_PERSONAL;
  }
  if (INSTITUTION_TYPES.has(type)) {
    return APPLICATION_CHANNELS.INSTITUTION;
  }
  if (EMPLOYER_TYPES.has(type) || employerLinked) {
    return APPLICATION_CHANNELS.INTERNAL_EMPLOYER;
  }
  return APPLICATION_CHANNELS.EXTERNAL_PERSONAL;
}

export function resolveStageAuthority(app = {}) {
  const channel = resolveApplicationChannel(app);
  if (channel === APPLICATION_CHANNELS.INTERNAL_EMPLOYER) return STAGE_AUTHORITY.EMPLOYER;
  if (channel === APPLICATION_CHANNELS.INSTITUTION) return STAGE_AUTHORITY.INSTITUTION;
  return STAGE_AUTHORITY.PERSONAL;
}

export function isInternalEmployerApplication(app = {}) {
  return resolveApplicationChannel(app) === APPLICATION_CHANNELS.INTERNAL_EMPLOYER;
}

export function isExternalPersonalTracker(app = {}) {
  return resolveApplicationChannel(app) === APPLICATION_CHANNELS.EXTERNAL_PERSONAL;
}

/**
 * Student-allowed transitions. Machine transitions are the upper bound;
 * internal/institution channels are further restricted.
 */
export function getStudentAllowedTransitions(app = {}, machineTransitions) {
  const fromStage = String(app.pipelineStage || '');
  const templateId = app.stageTemplateId || opportunityTypeOf(app);
  const machine = Array.isArray(machineTransitions)
    ? machineTransitions
    : getAllowedTransitions(templateId, fromStage);
  const authority = resolveStageAuthority(app);

  if (authority === STAGE_AUTHORITY.PERSONAL) {
    return machine.filter((to) => {
      if (isEmployerAuthoritativeStage(to)) return false;
      return STUDENT_WRITABLE_EXTERNAL_STAGES.includes(to);
    });
  }

  return machine.filter((to) => {
    if (to === 'withdrawn') return true;
    if (isEmployerAuthoritativeStage(to)) return false;
    if (PRE_APPLY_STAGES.has(fromStage)) {
      return PRE_APPLY_STAGES.has(to) || to === 'applied';
    }
    return false;
  });
}

export function assertStudentMayTransition(app = {}, toStage) {
  const allowed = getStudentAllowedTransitions(app);
  if (!allowed.includes(toStage)) {
    const err = new Error(
      'Students cannot set employer-authoritative application states'
    );
    err.status = 403;
    err.code = 'STUDENT_CANNOT_SET_EMPLOYER_STATE';
    throw err;
  }
}
