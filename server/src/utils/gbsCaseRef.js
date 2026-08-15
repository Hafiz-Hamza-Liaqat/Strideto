import { randomBytes } from 'node:crypto';
import { GBS_CASE_BOUNDS, isOpaqueCaseRef } from '../../../shared/gbs/caseContract.js';

export function generatePublicCaseRef() {
  return randomBytes(18).toString('base64url').slice(0, GBS_CASE_BOUNDS.REF_MAX);
}

export function generatePublicTaskRef() {
  return randomBytes(18).toString('base64url').slice(0, GBS_CASE_BOUNDS.REF_MAX);
}

export { isOpaqueCaseRef };
