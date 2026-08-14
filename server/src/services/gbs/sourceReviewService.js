/**
 * Official source review primitives (Phase 17D-2). No Admin UI.
 * Material reviewed changes create a new sourceVersion. recordVersion is CAS.
 */
import { CATALOG_REVIEW_STATUSES } from '../../../../shared/gbs/catalogConstants.js';
import { catalogFingerprintCanonical } from '../../../../shared/gbs/catalogFingerprint.js';
import { assertLegalFactSourceAllowed } from '../../../../shared/gbs/officialSourcePolicy.js';
import { GBS_AUDIT_EVENTS, redactAuditMetadata } from '../../../../shared/security/gbsAuditEvents.js';
import { applyOptimisticMutation } from '../../../../shared/platform/optimisticConcurrency.js';
import { POLICY_ACTIONS } from '../../../../shared/capability/permissionPolicy.js';

function deny(code, status = 403) {
  return Object.assign(new Error(code), { status, code });
}

function requireStaff(actor) {
  if (!actor?.isStaff || actor?.realm !== 'staff') {
    throw deny('staff_review_required');
  }
}

export function createSourceReviewService({
  store,
  audit = async () => {},
  policyAction = POLICY_ACTIONS.ADMIN_GBS_SOURCE_REVIEW,
} = {}) {
  async function load(sourceId, sourceVersion) {
    return store.get({ sourceId, sourceVersion });
  }

  async function persist(record, actor, action, extra = {}) {
    await store.put(record);
    await audit({
      action,
      status: 'success',
      policyVersion: '17d-2.0',
      metadata: redactAuditMetadata({
        sourceId: record.sourceId,
        jurisdictionId: record.jurisdictionId,
        recordVersion: record.recordVersion,
        sourceVersion: record.sourceVersion,
        reviewStatus: record.reviewStatus,
        reasonCode: extra.reasonCode || null,
        actorId: actor?.id || null,
      }),
    });
    return record;
  }

  return {
    policyAction,
    async createDraft(input, actor) {
      const allowed = assertLegalFactSourceAllowed(input);
      if (!allowed.ok) throw deny(allowed.errors[0], 400);
      const record = {
        ...input,
        sourceUrl: allowed.value,
        reviewStatus: CATALOG_REVIEW_STATUSES.DRAFT,
        superseded: false,
        sourceVersion: input.sourceVersion || 1,
        recordVersion: 0,
        fingerprintCanonical: catalogFingerprintCanonical(input),
      };
      await persist(record, actor, GBS_AUDIT_EVENTS.SOURCE_DRAFT_CREATED);
      return record;
    },

    async submit(sourceId, { expectedVersion, actor }) {
      const current = await load(sourceId, 1);
      if (!current) throw deny('source_not_found', 404);
      const { nextVersion, result } = applyOptimisticMutation({
        currentVersion: current.recordVersion,
        expectedVersion,
        mutate: (recordVersion) => ({
          ...current,
          reviewStatus: CATALOG_REVIEW_STATUSES.UNDER_REVIEW,
          recordVersion,
        }),
      });
      void nextVersion;
      return persist(result, actor, GBS_AUDIT_EVENTS.SOURCE_SUBMITTED);
    },

    async approveReviewedRevision(sourceId, { expectedVersion, actor, nextFact } = {}) {
      requireStaff(actor);
      const current = await store.getLatest(sourceId);
      if (!current) throw deny('source_not_found', 404);
      applyOptimisticMutation({
        currentVersion: current.recordVersion,
        expectedVersion,
        mutate: () => null,
      });
      const incoming = nextFact ? { ...current, ...nextFact } : current;
      const nextFingerprint = catalogFingerprintCanonical(incoming);
      const materialChange =
        current.reviewStatus === CATALOG_REVIEW_STATUSES.REVIEWED &&
        current.fingerprintCanonical &&
        current.fingerprintCanonical !== nextFingerprint;

      if (materialChange) {
        const superseded = {
          ...current,
          superseded: true,
          supersededBy: `${current.sourceId}::${current.sourceVersion + 1}`,
          reviewStatus: CATALOG_REVIEW_STATUSES.SUPERSEDED,
          recordVersion: current.recordVersion + 1,
        };
        await persist(superseded, actor, GBS_AUDIT_EVENTS.SOURCE_SUPERSEDED);
        const revision = {
          ...incoming,
          sourceVersion: current.sourceVersion + 1,
          reviewStatus: CATALOG_REVIEW_STATUSES.REVIEWED,
          superseded: false,
          supersededBy: null,
          recordVersion: 0,
          fingerprintCanonical: nextFingerprint,
          reviewedBy: actor.id,
        };
        return persist(revision, actor, GBS_AUDIT_EVENTS.SOURCE_REVIEWED);
      }

      const reviewed = {
        ...incoming,
        reviewStatus: CATALOG_REVIEW_STATUSES.REVIEWED,
        reviewedBy: actor.id,
        recordVersion: current.recordVersion + 1,
        fingerprintCanonical: nextFingerprint,
      };
      return persist(reviewed, actor, GBS_AUDIT_EVENTS.SOURCE_REVIEWED);
    },

    async markStale(sourceId, { expectedVersion, actor, reasonCode }) {
      requireStaff(actor);
      const current = await store.getLatest(sourceId);
      if (!current) throw deny('source_not_found', 404);
      const { result } = applyOptimisticMutation({
        currentVersion: current.recordVersion,
        expectedVersion,
        mutate: (recordVersion) => ({
          ...current,
          reviewStatus: CATALOG_REVIEW_STATUSES.STALE,
          recordVersion,
        }),
      });
      return persist(result, actor, GBS_AUDIT_EVENTS.SOURCE_MARKED_STALE, { reasonCode });
    },

    async reject(sourceId, { expectedVersion, actor, reasonCode }) {
      requireStaff(actor);
      const current = await store.getLatest(sourceId);
      if (!current) throw deny('source_not_found', 404);
      const { result } = applyOptimisticMutation({
        currentVersion: current.recordVersion,
        expectedVersion,
        mutate: (recordVersion) => ({
          ...current,
          reviewStatus: CATALOG_REVIEW_STATUSES.REJECTED,
          recordVersion,
        }),
      });
      return persist(result, actor, GBS_AUDIT_EVENTS.SOURCE_REJECTED, { reasonCode });
    },
  };
}

export function createMemorySourceStore() {
  const rows = [];
  return {
    async get({ sourceId, sourceVersion }) {
      return rows.find((r) => r.sourceId === sourceId && r.sourceVersion === sourceVersion) || null;
    },
    async getLatest(sourceId) {
      return rows.filter((r) => r.sourceId === sourceId).sort((a, b) => b.sourceVersion - a.sourceVersion)[0] || null;
    },
    async put(record) {
      const idx = rows.findIndex(
        (r) => r.sourceId === record.sourceId && r.sourceVersion === record.sourceVersion
      );
      if (idx >= 0) rows[idx] = record;
      else rows.push(record);
    },
    async list(sourceId) {
      return rows.filter((r) => r.sourceId === sourceId);
    },
  };
}
