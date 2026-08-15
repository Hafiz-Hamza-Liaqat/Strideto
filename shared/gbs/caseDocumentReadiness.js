/**
 * Authoritative GBS Case filing-readiness evaluator (Phase 17D-8B1).
 * Pure. Consent is not implemented: consentRequired without satisfaction fails closed.
 */
import { CASE_STATUSES, isCaseTerminal } from './caseContract.js';
import {
  GBS_DOCUMENT_REQUIREMENT_STATUSES,
  GBS_DOCUMENT_REVIEW_STATES,
} from './caseDocumentContract.js';

export function isDocumentRequirementSatisfied(row = {}) {
  if (row.status === GBS_DOCUMENT_REQUIREMENT_STATUSES.WAIVED && row.waivable === true) {
    return Boolean(row.waiverReason);
  }
  if (row.status !== GBS_DOCUMENT_REQUIREMENT_STATUSES.ACCEPTED) return false;
  if (row.scanStatus !== 'clean') return false;
  if (row.reviewRequired !== false && row.reviewState !== GBS_DOCUMENT_REVIEW_STATES.ACCEPTED) {
    return false;
  }
  if (!row.activeVaultDocumentId || !row.activeVaultVersionId) return false;
  return true;
}

export function evaluateCaseFilingReadiness({
  status,
  requiredCustomerTasksComplete,
  professionalAuthorityAllowed,
  consentRequired,
  consentSatisfied,
  requirements,
} = {}) {
  const reasons = [];
  if (!status || isCaseTerminal(status)) reasons.push('case_not_eligible');
  if (status === CASE_STATUSES.OPEN) reasons.push('preparation_pending');
  if (professionalAuthorityAllowed === false) reasons.push('professional_authority_invalid');
  if (requiredCustomerTasksComplete === false) reasons.push('customer_action_pending');
  if (consentRequired === true && consentSatisfied !== true) {
    reasons.push('filing_consent_pending');
  }
  const list = Array.isArray(requirements) ? requirements : [];
  for (const row of list) {
    if (row.required === false) continue;
    if (!isDocumentRequirementSatisfied(row)) {
      reasons.push('document_required');
      break;
    }
  }
  const unique = [...new Set(reasons)];
  return {
    ready: unique.length === 0,
    reasons: unique,
  };
}
