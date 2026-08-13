import { useEffect, useState } from 'react';
import { consumeMilestoneOnce } from '../../welcome/portalWelcome';

/**
 * Accessible one-shot milestone banner. Only mounts when `ready` is true
 * (caller must pass a genuine server-backed state change). Deduped per user+event.
 */
export function MilestoneDelight({ userId, eventKey, title, body, ready = false }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ready || !userId || !eventKey) return;
    if (consumeMilestoneOnce(userId, eventKey)) setVisible(true);
  }, [ready, userId, eventKey]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-6 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 motion-safe:animate-fade-in-up"
    >
      <div className="min-w-0">
        <p className="font-semibold text-gray-900 dark:text-white">{title}</p>
        {body ? <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5">{body}</p> : null}
      </div>
      <button
        type="button"
        onClick={() => setVisible(false)}
        className="inline-flex items-center min-h-[44px] px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        Dismiss
      </button>
    </div>
  );
}
