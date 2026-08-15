import { randomBytes } from 'node:crypto';
import { GBS_CASE_DOCUMENT_BOUNDS, isOpaqueDocumentRef } from '../../../shared/gbs/caseDocumentContract.js';

export function generatePublicRequirementRef() {
  return randomBytes(18).toString('base64url').slice(0, GBS_CASE_DOCUMENT_BOUNDS.REF_MAX);
}

export { isOpaqueDocumentRef };
