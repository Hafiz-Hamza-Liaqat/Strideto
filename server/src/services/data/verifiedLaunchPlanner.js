/**
 * Verified Data Launch — deterministic import planner (Mission 25).
 *
 * Planning happens BEFORE any mutation. This module never writes: it reads a
 * canonical-state snapshot (injected, plain data) and a validated manifest, and
 * returns a plan, a rollback plan and a data-quality report.
 *
 * No DB driver, no filesystem, no network. The same normalized manifest against
 * the same canonical state always produces the same plan, in the same order,
 * with the same fingerprint.
 *
 * Deletion is not a planner state: absence from a manifest never means delete.
 */
import {
  LAUNCH_FRESHNESS_DECISIONS,
  PLAN_STATES,
  compareRecords,
  entityOrderIndex,
  isMutatingPlanState,
  preservesHistory,
} from '../../../../shared/data/verifiedLaunch.js';

// ── Canonical state snapshot ─────────────────────────────────────────────────

/**
 * Wrap a plain snapshot object into a read-only lookup.
 *
 * Snapshot shape:
 *   { <entityType>: [ { canonicalKey, payload, valueFingerprint, sourceAuthority,
 *                       sourceAuthorityTier, freshnessState, lastVerifiedAt,
 *                       effectiveFrom, effectiveTo, status, identity } ] }
 *
 * `identity` (optional) carries precomputed strong/weak duplicate keys; when
 * absent they are derived from the payload with the same rules used for
 * manifest records, so both sides are compared consistently.
 */
export function createCanonicalStateSnapshot(snapshot = {}) {
  const byType = new Map();
  for (const [entityType, rows] of Object.entries(snapshot)) {
    if (!Array.isArray(rows)) continue;
    byType.set(
      entityType,
      rows.map((row) => ({
        ...row,
        identity: row.identity ?? identityKeys(entityType, row.payload ?? {}, row.dependencies ?? {}),
      }))
    );
  }
  return {
    isEmpty: () => [...byType.values()].every((rows) => rows.length === 0),
    all: (entityType) => byType.get(entityType) ?? [],
    findByCanonicalKey: (entityType, canonicalKey) =>
      (byType.get(entityType) ?? []).find((row) => row.canonicalKey === canonicalKey) ?? null,
  };
}

// ── Duplicate identity keys ──────────────────────────────────────────────────

function norm(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function normDomain(value) {
  return norm(value).replace(/^www\./, '');
}

/**
 * Duplicate-detection keys for an entity.
 *   strong — a match means the same real-world entity with high confidence
 *   weak   — a match is *suspicious* and must go to manual review, never a
 *            silent merge
 */
export function identityKeys(entityType, payload = {}, dependencies = {}) {
  const strong = [];
  const weak = [];
  const country = norm(payload.countryCode || payload.country);

  switch (entityType) {
    case 'canonical_institution': {
      const domain = normDomain(payload.officialDomain);
      const name = norm(payload.officialName);
      if (domain) strong.push(`domain:${country}|${domain}`);
      if (payload.identifiers && typeof payload.identifiers === 'object') {
        for (const [scheme, id] of Object.entries(payload.identifiers).sort()) {
          if (id) strong.push(`id:${norm(scheme)}|${norm(id)}`);
        }
      }
      if (name) weak.push(`name:${country}|${name}`);
      if (Array.isArray(payload.aliases)) {
        for (const alias of payload.aliases.slice(0, 20)) {
          if (alias) weak.push(`alias:${country}|${norm(alias)}`);
        }
      }
      break;
    }
    case 'test_provider': {
      const name = norm(payload.name);
      const domain = normDomain(payload.officialWebsite);
      if (name) strong.push(`provider:${name}`);
      if (domain) weak.push(`provider-site:${domain}`);
      break;
    }
    case 'test': {
      if (payload.stableId) strong.push(`test:${norm(payload.stableId)}`);
      const name = norm(payload.name);
      if (name) weak.push(`test-name:${name}`);
      if (payload.shortName) weak.push(`test-short:${norm(payload.shortName)}`);
      break;
    }
    case 'program': {
      const inst = norm(dependencies.institutionKey);
      const name = norm(payload.name);
      const level = norm(payload.degreeLevel);
      const campus = norm(payload.campus);
      if (inst && name && level) {
        strong.push(`program:${inst}|${name}|${level}|${campus}`);
        weak.push(`program-nc:${inst}|${name}|${level}`);
      }
      break;
    }
    case 'canonical_scholarship': {
      const provider = norm(payload.provider?.name);
      const title = norm(payload.title);
      const cycle = norm(payload.cycleLabel);
      const jurisdiction = country || norm((payload.destinationCountries ?? []).join(','));
      if (provider && title) {
        strong.push(`scholarship:${provider}|${title}|${cycle}|${jurisdiction}`);
        weak.push(`scholarship-nc:${provider}|${title}`);
      }
      break;
    }
    case 'test_acceptance': {
      strong.push(
        [
          'acceptance',
          norm(dependencies.testKey),
          norm(payload.acceptanceScope),
          norm(dependencies.institutionKey),
          norm(dependencies.programKey),
          country,
          norm(payload.intake),
        ].join('|')
      );
      break;
    }
    case 'program_requirement': {
      strong.push(
        [
          'requirement',
          norm(dependencies.programKey),
          norm(payload.requirementType),
          norm(dependencies.testKey),
          norm(payload.subjectName),
          norm(payload.intake),
        ].join('|')
      );
      break;
    }
    case 'scholarship_applicability': {
      strong.push(
        [
          'applicability',
          norm(dependencies.scholarshipKey),
          norm(payload.scope),
          norm(dependencies.institutionKey),
          norm(dependencies.programKey),
          country,
        ].join('|')
      );
      break;
    }
    case 'canonical_source': {
      if (payload.normalizedUrl) strong.push(`source:${norm(payload.normalizedUrl)}`);
      break;
    }
    default:
      break;
  }

  return { strong, weak };
}

// ── Conflict detail ──────────────────────────────────────────────────────────

function conflictDetail(record, existing, changedFacts) {
  return {
    changedFacts,
    existing: {
      canonicalKey: existing.canonicalKey,
      sourceAuthority: existing.sourceAuthority ?? null,
      sourceAuthorityTier: existing.sourceAuthorityTier ?? null,
      freshnessState: existing.freshnessState ?? 'unknown',
      lastVerifiedAt: existing.lastVerifiedAt ?? null,
      effectiveFrom: existing.effectiveFrom ?? null,
      effectiveTo: existing.effectiveTo ?? null,
      valueFingerprint: existing.valueFingerprint ?? null,
      values: pickFacts(existing.payload ?? {}, changedFacts),
    },
    proposed: {
      recordKey: record.recordKey,
      sourceAuthority: record.sourceAuthority,
      sourceAuthorityTier: record.sourceAuthorityTier,
      freshnessState: record.freshnessState,
      lastVerifiedAt: record.lastVerifiedAt,
      effectiveFrom: record.effectiveFrom,
      effectiveTo: record.effectiveTo,
      valueFingerprint: record.valueFingerprint,
      values: pickFacts(record.payload ?? {}, changedFacts),
    },
  };
}

function pickFacts(payload, keys) {
  const out = {};
  for (const key of keys) out[key] = payload?.[key] ?? null;
  return out;
}

function diffFacts(a = {}, b = {}) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const changed = [];
  for (const key of [...keys].sort()) {
    if (JSON.stringify(a[key] ?? null) !== JSON.stringify(b[key] ?? null)) changed.push(key);
  }
  return changed;
}

// ── Planner ──────────────────────────────────────────────────────────────────

/**
 * Build the deterministic import plan.
 *
 * @param {object} validation result from validateManifest()
 * @param {object} [canonicalState] snapshot from createCanonicalStateSnapshot()
 * @returns {object} plan
 */
export function planLaunchBatch(validation, canonicalState = createCanonicalStateSnapshot({})) {
  const records = [...(validation.records ?? [])].sort(compareRecords);
  const entries = [];

  // Records already planned in this batch, for dependency resolution.
  const plannedByKey = new Map();
  // Duplicate identity index across canonical state + this batch.
  const strongIndex = new Map();
  const weakIndex = new Map();

  // Seed the index from existing canonical state so a manifest record that
  // duplicates an existing entity under a different key is caught.
  for (const entityType of new Set(records.map((r) => r.entityType))) {
    for (const row of canonicalState.all(entityType)) {
      for (const key of row.identity?.strong ?? []) {
        if (!strongIndex.has(`${entityType}::${key}`)) {
          strongIndex.set(`${entityType}::${key}`, { source: 'canonical', canonicalKey: row.canonicalKey });
        }
      }
      for (const key of row.identity?.weak ?? []) {
        if (!weakIndex.has(`${entityType}::${key}`)) {
          weakIndex.set(`${entityType}::${key}`, { source: 'canonical', canonicalKey: row.canonicalKey });
        }
      }
    }
  }

  // Invalid records from validation are surfaced as skip_invalid plan entries so
  // the plan is a complete account of the manifest.
  for (const bad of validation.invalidRecords ?? []) {
    entries.push({
      recordKey: bad.recordKey,
      entityType: bad.entityType,
      planState: PLAN_STATES.SKIP_INVALID,
      reason: 'record_validation_failed',
      errors: bad.errors,
    });
  }

  for (const record of records) {
    const entry = {
      recordKey: record.recordKey,
      entityType: record.entityType,
      canonicalKey: record.recordKey,
      countryCode: record.countryCode || '',
      sourceAuthority: record.sourceAuthority,
      sourceAuthorityTier: record.sourceAuthorityTier,
      freshnessState: record.freshnessState,
      attribution: record.provenance.attribution,
      origin: record.provenance.origin,
      effectiveFrom: record.effectiveFrom,
      effectiveTo: record.effectiveTo,
      valueFingerprint: record.valueFingerprint,
      planState: null,
      reason: '',
    };

    // ── 1. Freshness gate ───────────────────────────────────────────────────
    switch (record.freshnessDecision) {
      case LAUNCH_FRESHNESS_DECISIONS.NOT_LAUNCHABLE_STALE:
        entry.planState = PLAN_STATES.SKIP_STALE;
        entry.reason = record.freshnessReason;
        break;
      case LAUNCH_FRESHNESS_DECISIONS.NOT_LAUNCHABLE_BROKEN:
      case LAUNCH_FRESHNESS_DECISIONS.NOT_LAUNCHABLE_UNKNOWN:
        entry.planState = PLAN_STATES.SKIP_INVALID;
        entry.reason = record.freshnessReason;
        break;
      case LAUNCH_FRESHNESS_DECISIONS.REVIEW_REQUIRED:
        entry.planState = PLAN_STATES.MANUAL_REVIEW;
        entry.reason = record.freshnessReason;
        break;
      default:
        break;
    }
    if (entry.planState) {
      entries.push(entry);
      plannedByKey.set(record.recordKey, entry);
      continue;
    }

    // ── 2. Dependencies ─────────────────────────────────────────────────────
    const unresolved = [];
    for (const dep of record.dependencies) {
      const planned = plannedByKey.get(dep.recordKey);
      const existing = canonicalState.findByCanonicalKey(dep.entityType, dep.recordKey);
      if (planned) {
        if (planned.entityType !== dep.entityType) {
          unresolved.push({ field: dep.field, reason: 'dependency_entity_type_mismatch' });
          continue;
        }
        if (entityOrderIndex(planned.entityType) >= entityOrderIndex(record.entityType)) {
          unresolved.push({ field: dep.field, reason: 'dependency_order_violation' });
          continue;
        }
        if (!isMutatingPlanState(planned.planState) && planned.planState !== PLAN_STATES.NO_CHANGE) {
          unresolved.push({
            field: dep.field,
            reason: `dependency_not_launchable:${planned.planState}`,
          });
        }
        continue;
      }
      if (existing) continue;
      unresolved.push({ field: dep.field, reason: 'dependency_not_found' });
    }
    if (unresolved.length) {
      entry.planState = PLAN_STATES.SKIP_DEPENDENCY_FAILED;
      entry.reason = 'dependency_unresolved';
      entry.dependencyErrors = unresolved;
      entries.push(entry);
      plannedByKey.set(record.recordKey, entry);
      continue;
    }

    // ── 3. Existing canonical match by stable key ───────────────────────────
    const existing = canonicalState.findByCanonicalKey(record.entityType, record.recordKey);
    const identity = identityKeys(record.entityType, record.payload ?? {}, record.declaredDependencies);
    entry.identity = identity;

    if (!existing) {
      // ── 4. Duplicate detection against other entities ─────────────────────
      let strongHit = null;
      for (const key of identity.strong) {
        const hit = strongIndex.get(`${record.entityType}::${key}`);
        if (hit) {
          strongHit = { key, ...hit };
          break;
        }
      }
      if (strongHit) {
        entry.planState = PLAN_STATES.SKIP_DUPLICATE;
        entry.reason = 'duplicate_of_existing_canonical_entity';
        entry.duplicateOf = strongHit;
        entries.push(entry);
        plannedByKey.set(record.recordKey, entry);
        continue;
      }

      let weakHit = null;
      for (const key of identity.weak) {
        const hit = weakIndex.get(`${record.entityType}::${key}`);
        if (hit) {
          weakHit = { key, ...hit };
          break;
        }
      }
      if (weakHit) {
        entry.planState = PLAN_STATES.MANUAL_REVIEW;
        entry.reason = 'uncertain_duplicate_requires_manual_review';
        entry.duplicateCandidate = weakHit;
        entries.push(entry);
        plannedByKey.set(record.recordKey, entry);
        registerIdentity(strongIndex, weakIndex, record.entityType, identity, record.recordKey);
        continue;
      }

      entry.planState = PLAN_STATES.CREATE;
      entry.reason = 'new_verified_entity';
      // Importing into canonical storage is not publishing.
      entry.publicationState = 'draft_pending_publication_policy';
      entries.push(entry);
      plannedByKey.set(record.recordKey, entry);
      registerIdentity(strongIndex, weakIndex, record.entityType, identity, record.recordKey);
      continue;
    }

    // ── 5. Same canonical entity — compare ──────────────────────────────────
    if (existing.valueFingerprint && existing.valueFingerprint === record.valueFingerprint) {
      entry.planState = PLAN_STATES.NO_CHANGE;
      entry.reason = 'canonical_state_already_matches';
      entries.push(entry);
      plannedByKey.set(record.recordKey, entry);
      continue;
    }

    const changedFacts = diffFacts(existing.payload ?? {}, record.payload ?? {});
    if (!changedFacts.length) {
      entry.planState = PLAN_STATES.NO_CHANGE;
      entry.reason = 'no_material_difference';
      entries.push(entry);
      plannedByKey.set(record.recordKey, entry);
      continue;
    }

    const existingTier = existing.sourceAuthorityTier ?? 99;
    const proposedTier = record.sourceAuthorityTier ?? 99;
    const existingVerified = existing.lastVerifiedAt ? Date.parse(existing.lastVerifiedAt) : 0;
    const proposedVerified = record.lastVerifiedAt ? Date.parse(record.lastVerifiedAt) : 0;

    const authorityAtLeastAsGood = proposedTier <= existingTier;
    const evidenceNewer = proposedVerified > existingVerified;

    if (!authorityAtLeastAsGood || !evidenceNewer) {
      entry.planState = PLAN_STATES.CONFLICT;
      entry.reason = !authorityAtLeastAsGood
        ? 'proposed_source_authority_weaker_than_existing'
        : 'proposed_evidence_not_newer_than_existing';
      entry.conflict = conflictDetail(record, existing, changedFacts);
      entries.push(entry);
      plannedByKey.set(record.recordKey, entry);
      continue;
    }

    if (preservesHistory(record.entityType)) {
      entry.planState = PLAN_STATES.SUPERSEDE;
      entry.reason = 'material_change_superseded_history_preserved';
      entry.supersedes = {
        canonicalKey: existing.canonicalKey,
        priorValueFingerprint: existing.valueFingerprint ?? null,
        priorEffectiveFrom: existing.effectiveFrom ?? null,
        priorEffectiveTo: existing.effectiveTo ?? null,
      };
    } else {
      entry.planState = PLAN_STATES.UPDATE;
      entry.reason = 'material_change_with_stronger_or_equal_newer_evidence';
      entry.updates = changedFacts;
    }
    entry.conflictContext = conflictDetail(record, existing, changedFacts);
    entries.push(entry);
    plannedByKey.set(record.recordKey, entry);
  }

  // Deterministic final ordering: dependency order, then canonical key.
  entries.sort(compareRecords);

  // Records present in canonical state but absent from the manifest are never
  // deleted. They are listed for operator awareness only.
  const absentFromManifest = [];
  for (const entityType of new Set(records.map((r) => r.entityType))) {
    for (const row of canonicalState.all(entityType)) {
      if (!records.some((r) => r.recordKey === row.canonicalKey)) {
        absentFromManifest.push({
          entityType,
          canonicalKey: row.canonicalKey,
          recommendation: 'retain_no_delete',
        });
      }
    }
  }

  return {
    batchId: validation.batchId,
    manifestFingerprint: validation.fingerprint,
    manifestVersion: validation.manifestVersion,
    environmentIntent: validation.environmentIntent,
    scope: validation.scope,
    entries,
    absentFromManifest,
    counts: countPlanStates(entries),
  };
}

function registerIdentity(strongIndex, weakIndex, entityType, identity, canonicalKey) {
  for (const key of identity.strong) {
    const composite = `${entityType}::${key}`;
    if (!strongIndex.has(composite)) {
      strongIndex.set(composite, { source: 'manifest', canonicalKey });
    }
  }
  for (const key of identity.weak) {
    const composite = `${entityType}::${key}`;
    if (!weakIndex.has(composite)) {
      weakIndex.set(composite, { source: 'manifest', canonicalKey });
    }
  }
}

export function countPlanStates(entries = []) {
  const counts = {};
  for (const state of Object.values(PLAN_STATES)) counts[state] = 0;
  for (const entry of entries) {
    if (counts[entry.planState] === undefined) counts[entry.planState] = 0;
    counts[entry.planState] += 1;
  }
  return counts;
}

// ── Rollback plan ────────────────────────────────────────────────────────────

/**
 * Build rollback metadata for every mutation-capable entry, BEFORE any apply.
 *
 * Rollback is compensating, never destructive: a created record is archived,
 * an updated record has its prior field values restored, a supersession is
 * reverted by clearing the supersession pointer and archiving the replacement.
 * Immutable history is never deleted.
 */
export function buildRollbackPlan(plan) {
  const operations = [];
  for (const entry of plan.entries ?? []) {
    if (!isMutatingPlanState(entry.planState)) continue;
    if (entry.planState === 'create') {
      operations.push({
        recordKey: entry.recordKey,
        entityType: entry.entityType,
        appliedOperation: 'create',
        compensatingOperation: 'archive_created_record',
        destructive: false,
        priorState: null,
      });
    } else if (entry.planState === 'update') {
      operations.push({
        recordKey: entry.recordKey,
        entityType: entry.entityType,
        appliedOperation: 'update',
        compensatingOperation: 'restore_prior_field_values',
        destructive: false,
        changedFields: entry.updates ?? [],
        priorState: entry.conflictContext?.existing ?? null,
      });
    } else if (entry.planState === 'supersede') {
      operations.push({
        recordKey: entry.recordKey,
        entityType: entry.entityType,
        appliedOperation: 'supersede',
        compensatingOperation: 'clear_supersession_pointer_and_archive_replacement',
        destructive: false,
        supersedes: entry.supersedes ?? null,
        priorState: entry.conflictContext?.existing ?? null,
      });
    }
  }

  return {
    batchId: plan.batchId,
    manifestFingerprint: plan.manifestFingerprint,
    generatedBeforeApply: true,
    preservesImmutableHistory: true,
    hardDeletes: 0,
    operations,
  };
}

// ── Data quality report ──────────────────────────────────────────────────────

/**
 * Truthful launch-quality report. Counts only — no synthesized quality score.
 */
export function buildLaunchReport(validation, plan) {
  const byEntityType = {};
  const bySourceAuthority = {};
  const byFreshness = {};
  const byCountry = {};

  for (const record of validation.records ?? []) {
    byEntityType[record.entityType] = (byEntityType[record.entityType] ?? 0) + 1;
    const auth = record.sourceAuthority ?? 'unknown';
    bySourceAuthority[auth] = (bySourceAuthority[auth] ?? 0) + 1;
    byFreshness[record.freshnessState] = (byFreshness[record.freshnessState] ?? 0) + 1;
    const country = record.countryCode || 'unspecified';
    byCountry[country] = (byCountry[country] ?? 0) + 1;
  }

  const counts = plan.counts ?? {};
  const publishable = plan.entries.filter(
    (e) => e.planState === PLAN_STATES.CREATE || e.planState === PLAN_STATES.NO_CHANGE
  ).length;

  const sourceCoverage = (validation.records ?? []).map((record) => ({
    recordKey: record.recordKey,
    entityType: record.entityType,
    allMaterialFactsSourced: (record.unsourcedFacts ?? []).length === 0,
    unsourcedFacts: record.unsourcedFacts ?? [],
    sourceCount: record.sources.length,
  }));

  return {
    batchId: plan.batchId,
    manifestFingerprint: plan.manifestFingerprint,
    scope: plan.scope,
    totalRecords: validation.summary.totalRecords,
    validRecords: validation.summary.validRecords,
    byEntityType,
    byPlanState: counts,
    bySourceAuthority,
    byFreshness,
    byCountry,
    conflicts: counts[PLAN_STATES.CONFLICT] ?? 0,
    duplicates: counts[PLAN_STATES.SKIP_DUPLICATE] ?? 0,
    stale: counts[PLAN_STATES.SKIP_STALE] ?? 0,
    invalid: counts[PLAN_STATES.SKIP_INVALID] ?? 0,
    dependencyFailures: counts[PLAN_STATES.SKIP_DEPENDENCY_FAILED] ?? 0,
    reviewRequired: counts[PLAN_STATES.MANUAL_REVIEW] ?? 0,
    unknownSource: validation.invalidRecords.filter((r) =>
      (r.errors ?? []).some((e) => e.reason === 'source_required')
    ).length,
    publishable,
    publicationSeparation:
      'canonical_import_does_not_grant_publication; publication remains governed by Mission 5 policy',
    sourceCoverage,
    absentFromManifest: plan.absentFromManifest ?? [],
    hardDeletesPlanned: 0,
  };
}

export { PLAN_STATES };
