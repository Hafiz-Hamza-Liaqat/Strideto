/**
 * Purpose-scoped consent persistence. Fail-soft so frozen handoff flows
 * never 5xx because a consent row could not be written.
 */
import { ConsentGrant } from '../models/platform/ConsentGrant.js';
import {
  CONSENT_PURPOSES,
  isConsentActive,
  validateConsentRecord,
} from '../../../shared/platform/consentContract.js';

function finishQuietly(fn) {
  return Promise.resolve()
    .then(fn)
    .catch(() => ({ recorded: false }));
}

export async function recordHandoffConsent(input = {}) {
  const validated = validateConsentRecord({
    ...input,
    grantedAt: input.grantedAt || new Date(),
    provenance: input.provenance || 'handoff',
    auditIdentity: input.auditIdentity || input.resourceScope || 'handoff',
  });
  if (!validated.ok) return { recorded: false, errors: validated.errors };
  return finishQuietly(async () => {
    const value = validated.value;
    await ConsentGrant.updateOne(
      {
        subjectId: value.subjectId,
        purpose: value.purpose,
        resourceScope: value.resourceScope,
        counterpartyId: String(value.counterpartyId),
        revokedAt: null,
      },
      { $setOnInsert: value },
      { upsert: true }
    );
    return { recorded: true };
  });
}

export async function revokeHandoffConsent({
  subjectId,
  purpose,
  resourceScope,
  counterpartyId,
} = {}) {
  if (!subjectId || !purpose || !resourceScope) return { revoked: 0 };
  return finishQuietly(async () => {
    const filter = {
      subjectId,
      purpose,
      resourceScope,
      revokedAt: null,
    };
    if (counterpartyId) filter.counterpartyId = String(counterpartyId);
    const result = await ConsentGrant.updateMany(filter, { $set: { revokedAt: new Date() } });
    return { revoked: result.modifiedCount || 0 };
  });
}

export { CONSENT_PURPOSES, isConsentActive };
