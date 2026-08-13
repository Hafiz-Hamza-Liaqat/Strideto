/**
 * Generic reauthentication / step-up purposes.
 * Initial factor is current password. Stronger factors can be added later
 * without per-realm reimplementations.
 */
export const STEP_UP_PURPOSES = Object.freeze([
  'password_change',
  'email_change',
  'phone_change',
  'team_ownership_change',
  'payout_kyc',
  'staff_security',
]);

export function isStepUpPurpose(value) {
  return STEP_UP_PURPOSES.includes(String(value || ''));
}
