import { useEffect, useState } from 'react';
import { adminApi } from '../../../services/listingsService';

/**
 * Shows content lock banner for admin editors (C.7.0.6).
 */
export function ContentLockBanner({ entityType, entityId, currentUserId, onTakeOver }) {
  const [lock, setLock] = useState(null);

  useEffect(() => {
    if (!entityType || !entityId) return undefined;
    let cancelled = false;
    adminApi.workflowAcquireLock(entityType, entityId, false)
      .then(({ data }) => {
        if (!cancelled) setLock(data.lock || null);
        if (!cancelled && data.readOnly) setLock(data.lock);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      adminApi.workflowReleaseLock(entityType, entityId).catch(() => {});
    };
  }, [entityType, entityId]);

  if (!lock) return null;
  const isOwner = String(lock.lockedBy) === String(currentUserId);
  if (isOwner) return null;

  return (
    <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 p-3 text-sm text-amber-900 dark:text-amber-100" role="status">
      Currently being edited by <strong>{lock.lockedByName || lock.lockedByEmail || 'another editor'}</strong>.
      {' '}
      <span className="text-amber-800 dark:text-amber-200">Read-only mode.</span>
      {onTakeOver && (
        <button
          type="button"
          className="ml-2 underline font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded"
          onClick={async () => {
            await adminApi.workflowAcquireLock(entityType, entityId, true);
            onTakeOver?.();
          }}
        >
          Take over editing
        </button>
      )}
    </div>
  );
}
