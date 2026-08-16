import { randomBytes } from 'node:crypto';
import { GBS_CASE_BOUNDS } from '../../../shared/gbs/caseContract.js';

export function generatePublicAuthorizationRef() {
  return randomBytes(18).toString('base64url').slice(0, GBS_CASE_BOUNDS.REF_MAX);
}

export function generatePublicSubmissionRef() {
  return randomBytes(18).toString('base64url').slice(0, GBS_CASE_BOUNDS.REF_MAX);
}

export function generateClaimRef() {
  return randomBytes(18).toString('base64url').slice(0, GBS_CASE_BOUNDS.REF_MAX);
}
