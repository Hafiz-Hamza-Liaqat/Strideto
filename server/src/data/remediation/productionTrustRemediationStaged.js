const COLLECTION_MODEL_KEY = {
  jobs: 'Job',
  scholarships: 'Scholarship',
  admissions: 'Admission',
  internships: 'Internship',
  intlScholarships: 'IntlScholarship',
};

export function manifestSummary(entries) {
  const byCollection = {};
  const byAction = {};
  for (const row of entries) {
    byCollection[row.collection] = (byCollection[row.collection] || 0) + 1;
    const actionKey = `${row.collection}:${row.proposedStatus}`;
    byAction[actionKey] = (byAction[actionKey] || 0) + 1;
  }
  return { total: entries.length, byCollection, byAction };
}

export function assertManifestDisjoint(safeNow, deferred, manualRows = []) {
  const safeSet = new Set(safeNow.map((r) => `${r.collection}:${r._id}`));
  const defSet = new Set(deferred.map((r) => `${r.collection}:${r._id}`));
  for (const id of safeSet) {
    if (defSet.has(id)) throw new Error(`Manifest overlap: ${id}`);
  }
  for (const manual of manualRows) {
    const key = manual.key || `${manual.collection}:${manual._id}`;
    if (safeSet.has(key) || defSet.has(key)) {
      throw new Error(`Manual record in apply manifest: ${key}`);
    }
  }
}

export function buildRollbackManifest(entries, executedAt = new Date().toISOString()) {
  return entries.map((row) => ({
    collection: row.collection,
    _id: row._id,
    originalStatus: row.originalStatus,
    changedStatus: row.proposedStatus,
    reason: row.reason,
    executedAt,
    slug: row.slug || null,
    externalId: row.externalId || null,
    title: row.title || null,
  }));
}

export function buildRollbackOperations(rollbackManifest) {
  return rollbackManifest.map((row) => ({
    collection: row.collection,
    _id: row._id,
    filter: { _id: row._id, status: row.changedStatus },
    update: { $set: { status: row.originalStatus } },
  }));
}

export async function applyManifestEntries(models, entries, { strict = false } = {}) {
  const applied = { drafted: 0, closed: 0, unchanged: 0, details: [], failures: [] };
  for (const row of entries) {
    const modelName = COLLECTION_MODEL_KEY[row.collection];
    const Model = models[modelName];
    if (!Model) {
      throw new Error(`Unknown collection: ${row.collection}`);
    }
    const result = await Model.updateOne(
      { _id: row._id, status: row.originalStatus },
      { $set: { status: row.proposedStatus } }
    );
    const modified = result.modifiedCount > 0;
    if (row.proposedStatus === 'draft' && modified) applied.drafted += 1;
    else if (row.proposedStatus === 'closed' && modified) applied.closed += 1;
    else applied.unchanged += 1;

    const detail = {
      collection: row.collection,
      slug: row.slug,
      title: row.title,
      modified,
    };
    applied.details.push(detail);

    if (strict && !modified) {
      applied.failures.push({
        ...detail,
        issue: 'unexpected_modified_count_zero',
        expectedOriginalStatus: row.originalStatus,
        proposedStatus: row.proposedStatus,
      });
    }
  }
  return applied;
}
