/**
 * Requirement-pack DTO projection and mutation allowlists (Phase 17D-8B2B).
 * Client-safe. Does not import Node crypto or the production pack file.
 */
import { GBS_CASE_BOUNDS } from './caseContract.js';
import {
  DERIVED_CHECK_KEYS,
  FILING_METHOD_VALUES,
  MANUAL_CHECK_KEYS,
  RA_CONSENT_KEY,
  REQUIREMENT_FACT_CLASSES,
  derivedCheckStatus,
  evaluateRequirementPackReadiness,
  whoMaySupply,
} from './requirementPackContract.js';

const FACT_UPDATE_ALLOWED = new Set([
  'expectedVersion',
  'commandId',
  'creationCommandId',
  'subjectType',
  'subjectId',
  'factKey',
  'value',
]);

const CHECK_UPDATE_ALLOWED = new Set([
  'expectedVersion',
  'commandId',
  'creationCommandId',
  'subjectType',
  'subjectId',
  'checkKey',
  'attested',
  'selectedMethod',
]);

const RA_ATTEST_ALLOWED = new Set([
  'expectedVersion',
  'commandId',
  'creationCommandId',
  'subjectType',
  'subjectId',
  'attested',
]);

const CLIENT_AUTHORITATIVE_FORBIDDEN = new Set([
  'packId',
  'packVersion',
  'sourceSetId',
  'activationStatus',
  'reviewStatus',
  'schemaVersion',
  'suppliedByLane',
  'waiver',
  'waived',
  'waivable',
]);

function rejectUnknown(body, allowed) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'invalid_body' };
  }
  for (const key of Object.keys(body)) {
    if (CLIENT_AUTHORITATIVE_FORBIDDEN.has(key)) return { ok: false, error: 'client_pack_selection_rejected' };
    if (!allowed.has(key)) return { ok: false, error: 'unknown_field' };
  }
  return { ok: true };
}

function boundCommand(body) {
  const raw = body.commandId || body.creationCommandId;
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim().slice(0, GBS_CASE_BOUNDS.COMMAND_ID_MAX);
  return trimmed || undefined;
}

export function allowlistedRequirementFactInput(body = {}) {
  const gate = rejectUnknown(body, FACT_UPDATE_ALLOWED);
  if (!gate.ok) return gate;
  const factKey = typeof body.factKey === 'string' ? body.factKey.trim() : '';
  if (!factKey) return { ok: false, error: 'fact_key_required' };
  return {
    ok: true,
    value: {
      factKey,
      rawValue: body.value,
      commandId: boundCommand(body),
    },
  };
}

export function allowlistedProviderCheckInput(body = {}) {
  const gate = rejectUnknown(body, CHECK_UPDATE_ALLOWED);
  if (!gate.ok) return gate;
  const checkKey = typeof body.checkKey === 'string' ? body.checkKey.trim() : '';
  if (!checkKey) return { ok: false, error: 'check_key_required' };
  if (DERIVED_CHECK_KEYS.includes(checkKey)) return { ok: false, error: 'check_is_derived' };
  if (!MANUAL_CHECK_KEYS.includes(checkKey)) return { ok: false, error: 'unknown_check_key' };
  if (body.attested !== true) return { ok: false, error: 'attestation_required' };
  let selectedMethod;
  if (checkKey === 'filing_method_selected') {
    selectedMethod = typeof body.selectedMethod === 'string' ? body.selectedMethod.trim() : '';
    if (!FILING_METHOD_VALUES.includes(selectedMethod)) return { ok: false, error: 'invalid_filing_method' };
  }
  return {
    ok: true,
    value: {
      checkKey,
      attested: true,
      selectedMethod,
      commandId: boundCommand(body),
    },
  };
}

export function allowlistedRaConsentInput(body = {}) {
  const gate = rejectUnknown(body, RA_ATTEST_ALLOWED);
  if (!gate.ok) return gate;
  if (body.attested !== true) return { ok: false, error: 'attestation_required' };
  return {
    ok: true,
    value: {
      attested: true,
      commandId: boundCommand(body),
    },
  };
}

function snapshotIdentity(snapshot) {
  if (!snapshot) return null;
  return {
    packId: snapshot.packId,
    packVersion: snapshot.packVersion,
    schemaVersion: snapshot.schemaVersion,
    sourceSetId: snapshot.sourceSetId,
    sourceSnapshotHash: snapshot.sourceSnapshotHash,
    capabilityId: snapshot.capabilityId,
    jurisdictionId: snapshot.jurisdictionId,
    entityTypeId: snapshot.entityTypeId,
    authorityId: snapshot.authorityId,
    packApplicableFrom: snapshot.packApplicableFrom,
    delayedEffectiveDateMaxDays: snapshot.delayedEffectiveDateMaxDays,
    documentRequirementCount: Array.isArray(snapshot.documentRequirements)
      ? snapshot.documentRequirements.length
      : 0,
    hsiRequirementCount: snapshot.hsiRequirementCount || 0,
  };
}

function factRowMap(facts = []) {
  const out = {};
  for (const row of facts) {
    if (row?.factKey) out[row.factKey] = row;
  }
  return out;
}

export function emptyRequirementPackProjection() {
  return {
    attached: false,
    available: false,
    message: 'No active requirement pack is attached to this Case.',
  };
}

export function projectRequirementPackState(record, {
  lane,
  professionalAuthorityAllowed = true,
} = {}) {
  const snapshot = record?.requirementPackSnapshot;
  if (!snapshot) return emptyRequirementPackProjection();
  const facts = record.requirementFacts || [];
  const storedChecks = record.requirementChecks || [];
  const raConsent = record.raConsentAttestation || { status: 'missing', consentKey: RA_CONSENT_KEY };
  const values = factRowMap(facts);
  const readiness = evaluateRequirementPackReadiness({
    snapshot,
    facts,
    checks: storedChecks,
    raConsent,
    professionalAuthorityAllowed,
  });
  const factDefs = (snapshot.facts || []).map((def) => {
    const row = values[def.factKey];
    return {
      factKey: def.factKey,
      label: def.label,
      help: def.help || '',
      class: def.class,
      optional: def.class === REQUIREMENT_FACT_CLASSES.OPTIONAL_FACT,
      whoSupplies: def.whoSupplies,
      valueType: def.valueType,
      enumValues: def.enumValues,
      value: row?.value ?? null,
      suppliedByLane: row?.suppliedByLane || null,
      updatedAt: row?.updatedAt || null,
      canEdit: whoMaySupply(def, lane),
    };
  });
  const checks = (snapshot.providerChecks || []).map((def) => {
    const stored = storedChecks.find((row) => row.checkKey === def.checkKey);
    const derived = def.mode === 'derived'
      ? derivedCheckStatus(def.checkKey, { snapshot, facts, raConsent })
      : null;
    return {
      checkKey: def.checkKey,
      label: def.label,
      help: def.help || '',
      mode: def.mode,
      status: derived || stored?.status || 'missing',
      selectedMethod: stored?.selectedMethod || null,
      canAttest: lane === 'provider' && def.mode === 'manual',
    };
  });
  return {
    attached: true,
    available: true,
    identity: snapshotIdentity(snapshot),
    displayName: 'Wyoming LLC formation pack v1',
    facts: factDefs,
    checks,
    raConsent: {
      consentKey: RA_CONSENT_KEY,
      label: 'Registered agent written consent',
      status: raConsent.status === 'attested' ? 'attested' : 'missing',
      attestedAt: raConsent.attestedAt || null,
      canAttest: lane === 'provider',
      waivable: false,
      helper: 'Confirm that the registered agent\'s written consent has been obtained and will be retained or included as required for the external Wyoming filing.',
    },
    readiness: {
      b2bRequirementsReady: readiness.b2bRequirementsReady === true,
      authorizedForExternalFiling: false,
      reasons: readiness.reasons,
      copy: 'Required for STRIDETO pre-submission preparation. This is not government approval or registration.',
    },
  };
}
