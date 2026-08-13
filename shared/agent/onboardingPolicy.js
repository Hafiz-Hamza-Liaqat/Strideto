/**
 * Agent onboarding step policy — shared by client UI and server authority.
 * Verification, Trust badges, marketplace, and Vault are NEVER granted here.
 */
import { AGENT_ONBOARDING_STEPS } from './constants.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const AGENT_ONBOARDING_STEP_POLICY = Object.freeze({
  [AGENT_ONBOARDING_STEPS.IDENTITY]: Object.freeze({
    skippable: false,
    requiredLabels: Object.freeze({
      professionalName: 'Professional name',
      countryCode: 'Primary country',
    }),
  }),
  [AGENT_ONBOARDING_STEPS.SERVICES]: Object.freeze({
    skippable: false,
    requiredLabels: Object.freeze({
      officialEmail: 'Official email',
    }),
  }),
  [AGENT_ONBOARDING_STEPS.MARKETS]: Object.freeze({
    skippable: true,
    requiredLabels: Object.freeze({}),
    requireAnyWhenSaving: Object.freeze([
      'serviceCountries',
      'destinationCountries',
      'languages',
      'specialties',
    ]),
  }),
  [AGENT_ONBOARDING_STEPS.REPRESENTATIVE]: Object.freeze({
    skippable: false,
    agencyOnly: true,
    requiredLabels: Object.freeze({
      legalName: 'Legal entity name',
    }),
  }),
  [AGENT_ONBOARDING_STEPS.VERIFICATION]: Object.freeze({
    skippable: true,
    requiredLabels: Object.freeze({}),
  }),
  [AGENT_ONBOARDING_STEPS.REVIEW]: Object.freeze({
    skippable: false,
    requiredLabels: Object.freeze({}),
  }),
});

function hasValue(value) {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.values(value).some(hasValue);
  return true;
}

function readField(profile, key) {
  if (key === 'legalName') {
    return profile.legalName || profile.organizationLegalName || '';
  }
  return profile[key];
}

/**
 * Validate a step against persisted/proposed profile fields.
 * @returns {{ ok: true } | { ok: false, errors: Record<string, string>, message: string }}
 */
export function validateAgentOnboardingStep(step, profile = {}, { skip = false } = {}) {
  const policy = AGENT_ONBOARDING_STEP_POLICY[step];
  if (!policy) {
    return { ok: false, errors: {}, message: 'Invalid onboarding step' };
  }

  if (skip) {
    if (!policy.skippable) {
      return {
        ok: false,
        errors: {},
        message: 'This step cannot be skipped. Complete the required fields.',
      };
    }
    return { ok: true, skipped: true };
  }

  const errors = {};
  for (const [key, label] of Object.entries(policy.requiredLabels || {})) {
    const value = readField(profile, key);
    if (key === 'officialEmail') {
      const email = String(value || '').trim();
      if (!email || !EMAIL.test(email)) {
        errors[key] = `${label} is required and must be a valid email.`;
      }
      continue;
    }
    if (!hasValue(value)) {
      errors[key] = `${label} is required.`;
    }
  }

  if (policy.requireAnyWhenSaving?.length) {
    const anyFilled = policy.requireAnyWhenSaving.some((key) => hasValue(readField(profile, key)));
    if (!anyFilled) {
      return {
        ok: false,
        errors: {
          markets: 'Add at least one service region, destination, language, or specialty — or skip this step for now.',
        },
        message: 'Add at least one expertise value, or choose Skip for now.',
      };
    }
  }

  if (Object.keys(errors).length) {
    return {
      ok: false,
      errors,
      message: Object.values(errors)[0],
    };
  }
  return { ok: true };
}
