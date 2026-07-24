import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SeoHead } from '../../components/seo';
import { adminApi } from '../../services/listingsService';
import { usePermissions } from '../../hooks/usePermissions';
import { PERMISSIONS } from '../../config/rbac';
import { AdminRouteGuard } from '../../components/admin/AdminRouteGuard';
import { workflowResourceLabel } from '@shared/workflow/resources.js';
import { workflowStateLabel } from '@shared/workflow/states.js';
import { EscapeWhen } from '../../a11y/EscapeWhen';

const TABS = [
  { id: 'awaiting', label: 'Awaiting review' },
  { id: 'assigned', label: 'Assigned to me' },
  { id: 'approved', label: 'Approved' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'drafts', label: 'Drafts' },
];

function StatusBadge({ status }) {
  const colors = {
    draft: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
    in_review: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100',
    changes_requested: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-100',
    approved: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100',
    scheduled: 'bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-100',
    published: 'bg-indigo-100 text-indigo-900 dark:bg-indigo-900/40 dark:text-indigo-100',
    archived: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${colors[status] || colors.draft}`}>
      {workflowStateLabel(status)}
    </span>
  );
}

export default function AdminReviewQueue() {
  const { can, canAny } = usePermissions();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'awaiting';
  const [dashboard, setDashboard] = useState(null);
  const [queue, setQueue] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [actionLoading, setActionLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [reviewerId, setReviewerId] = useState('');
  const abortRef = useRef(null);

  const hasAccess = canAny([PERMISSIONS.WORKFLOW_VIEW, PERMISSIONS.WORKFLOW_REVIEW, PERMISSIONS.WORKFLOW_APPROVE]);
  const canApprove = can(PERMISSIONS.WORKFLOW_APPROVE) || can(PERMISSIONS.MODERATE_JOBS);
  const canReview = can(PERMISSIONS.WORKFLOW_REVIEW);

  const load = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    Promise.all([
      adminApi.workflowDashboard({ signal: controller.signal }),
      adminApi.workflowReviewQueue({ tab, page: 1, limit: 50 }, { signal: controller.signal }),
    ])
      .then(([dashRes, queueRes]) => {
        if (controller.signal.aborted) return;
        setDashboard(dashRes.data);
        setQueue(queueRes.data);
      })
      .catch((e) => {
        if (controller.signal.aborted || e.code === 'ERR_CANCELED') return;
        setError(e.response?.data?.error || 'Failed to load review queue');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
  }, [tab]);

  useEffect(() => {
    if (!hasAccess) {
      setLoading(false);
      return undefined;
    }
    load();
    return () => abortRef.current?.abort();
  }, [hasAccess, load]);

  const setTab = (id) => {
    setSearchParams({ tab: id });
    setSelected(new Set());
  };

  const itemKey = (item) => `${item.entityType}:${item.entityId}`;

  const toggleSelect = (item) => {
    const key = itemKey(item);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectedItems = () =>
    queue.items.filter((item) => selected.has(itemKey(item))).map(({ entityType, entityId }) => ({ entityType, entityId }));

  const confirmAction = (message) => window.confirm(message);

  const bulkApprove = async () => {
    if (!selected.size || !confirmAction(`Approve ${selected.size} item(s)?`)) return;
    setActionLoading(true);
    try {
      await adminApi.workflowBulkApprove(selectedItems());
      setSelected(new Set());
      load();
    } catch (e) {
      window.alert(e.response?.data?.error || 'Bulk approve failed');
    } finally {
      setActionLoading(false);
    }
  };

  const bulkReject = async () => {
    if (!selected.size) return;
    const reason = rejectReason.trim() || window.prompt('Rejection reason (optional):') || '';
    if (!confirmAction(`Reject ${selected.size} item(s)?`)) return;
    setActionLoading(true);
    try {
      await adminApi.workflowBulkReject(selectedItems(), reason);
      setSelected(new Set());
      setShowRejectDialog(false);
      setRejectReason('');
      load();
    } catch (e) {
      window.alert(e.response?.data?.error || 'Bulk reject failed');
    } finally {
      setActionLoading(false);
    }
  };

  const bulkAssign = async () => {
    if (!selected.size || !reviewerId.trim()) {
      window.alert('Enter a reviewer user ID');
      return;
    }
    if (!confirmAction(`Assign reviewer to ${selected.size} item(s)?`)) return;
    setActionLoading(true);
    try {
      await adminApi.workflowBulkAssign(selectedItems(), reviewerId.trim());
      setSelected(new Set());
      setReviewerId('');
      load();
    } catch (e) {
      window.alert(e.response?.data?.error || 'Bulk assign failed');
    } finally {
      setActionLoading(false);
    }
  };

  const openDetail = async (item) => {
    setActionLoading(true);
    try {
      const { data } = await adminApi.workflowGet(item.entityType, item.entityId);
      setDetail({ ...item, ...data });
    } catch (e) {
      window.alert(e.response?.data?.error || 'Failed to load workflow detail');
    } finally {
      setActionLoading(false);
    }
  };

  const runSingleAction = async (fn) => {
    setActionLoading(true);
    try {
      await fn();
      if (detail) {
        const { data } = await adminApi.workflowGet(detail.entityType, detail.entityId);
        setDetail((d) => ({ ...d, ...data }));
      }
      load();
    } catch (e) {
      window.alert(e.response?.data?.error || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const addComment = async () => {
    if (!detail || !commentText.trim()) return;
    await runSingleAction(() =>
      adminApi.workflowAddComment(detail.entityType, detail.entityId, {
        body: commentText.trim(),
        scope: 'page',
      })
    );
    setCommentText('');
  };

  if (!hasAccess) {
    return (
      <AdminRouteGuard anyPermission={[PERMISSIONS.WORKFLOW_VIEW, PERMISSIONS.WORKFLOW_REVIEW]}>
        <div />
      </AdminRouteGuard>
    );
  }

  return (
    <AdminRouteGuard anyPermission={[PERMISSIONS.WORKFLOW_VIEW, PERMISSIONS.WORKFLOW_REVIEW, PERMISSIONS.WORKFLOW_APPROVE]}>
      <SeoHead title="Editorial Review" noindex />
      <div className="max-w-6xl">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Editorial Review</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Unified workflow queue for all content modules.
        </p>

        {dashboard && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-8" role="region" aria-label="Workflow dashboard">
            {[
              ['Pending', dashboard.pendingReviews],
              ['Assigned', dashboard.assignedReviews],
              ['Scheduled today', dashboard.scheduledToday],
              ['Published today', dashboard.publishedToday],
              ['Rejected', dashboard.rejected],
              ['Drafts', dashboard.drafts],
              ['Avg approval (h)', dashboard.averageApprovalHours ?? '—'],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0 rounded-xl border border-gray-200 dark:border-gray-700 p-3 bg-white dark:bg-gray-800">
                <div className="text-xs text-gray-500 dark:text-gray-400 break-words leading-tight">{label}</div>
                <div className="text-xl font-semibold text-gray-900 dark:text-white">{value}</div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-4" role="tablist" aria-label="Review queue tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                tab === t.id
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
              }`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {(canApprove || canReview) && selected.size > 0 && (
          <div className="flex flex-wrap gap-2 mb-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700">
            <span className="text-sm text-gray-600 dark:text-gray-300 self-center">{selected.size} selected</span>
            {canApprove && (
              <button
                type="button"
                disabled={actionLoading}
                className="px-3 py-1.5 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                onClick={bulkApprove}
              >
                Bulk approve
              </button>
            )}
            {canReview && (
              <>
                <button
                  type="button"
                  disabled={actionLoading}
                  className="px-3 py-1.5 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                  onClick={() => setShowRejectDialog(true)}
                >
                  Bulk reject
                </button>
                <input
                  type="text"
                  placeholder="Reviewer user ID"
                  value={reviewerId}
                  onChange={(e) => setReviewerId(e.target.value)}
                  className="px-2 py-1 text-sm rounded border dark:bg-gray-900 dark:border-gray-600"
                  aria-label="Reviewer user ID for bulk assign"
                />
                <button
                  type="button"
                  disabled={actionLoading}
                  className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                  onClick={bulkAssign}
                >
                  Bulk assign
                </button>
              </>
            )}
          </div>
        )}

        {showRejectDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="reject-dialog-title">
            <EscapeWhen active onEscape={() => setShowRejectDialog(false)} />
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-xl">
              <h2 id="reject-dialog-title" className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">Reject selected</h2>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Reason for rejection (optional)"
                className="w-full border rounded-lg p-2 text-sm dark:bg-gray-900 dark:border-gray-600 mb-4"
                rows={3}
              />
              <div className="flex justify-end gap-2">
                <button type="button" className="px-3 py-1.5 text-sm rounded-lg border" onClick={() => setShowRejectDialog(false)}>Cancel</button>
                <button type="button" className="px-3 py-1.5 text-sm rounded-lg bg-red-600 text-white" onClick={bulkReject}>Confirm reject</button>
              </div>
            </div>
          </div>
        )}

        {loading && <div className="animate-pulse h-40 bg-gray-200 dark:bg-gray-700 rounded-xl" />}
        {error && <p className="text-red-600">{error}</p>}

        {!loading && !error && (
          <div className="table-scroll rounded-xl border border-gray-200 dark:border-gray-700">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 text-left">
                <tr>
                  <th className="p-3 w-10"><span className="sr-only">Select</span></th>
                  <th className="p-3">Title</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Reviewer</th>
                  <th className="p-3">Updated</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {queue.items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-gray-500">No items in this queue.</td>
                  </tr>
                ) : (
                  queue.items.map((item) => {
                    const key = itemKey(item);
                    return (
                      <tr key={key} className="border-t border-gray-100 dark:border-gray-700">
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={selected.has(key)}
                            onChange={() => toggleSelect(item)}
                            aria-label={`Select ${item.title || item.entityId}`}
                          />
                        </td>
                        <td className="p-3 font-medium text-gray-900 dark:text-white">{item.title || item.entityId}</td>
                        <td className="p-3">{workflowResourceLabel(item.entityType)}</td>
                        <td className="p-3"><StatusBadge status={item.status} /></td>
                        <td className="p-3 text-gray-600 dark:text-gray-400">{item.assignedReviewerEmail || '—'}</td>
                        <td className="p-3 text-gray-600 dark:text-gray-400">
                          {item.updatedAt ? new Date(item.updatedAt).toLocaleString() : '—'}
                        </td>
                        <td className="p-3">
                          <button
                            type="button"
                            className="text-primary-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
                            onClick={() => openDetail(item)}
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {detail && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="detail-dialog-title">
            <EscapeWhen active onEscape={() => setDetail(null)} />
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 id="detail-dialog-title" className="text-lg font-semibold text-gray-900 dark:text-white">
                    {detail.title || detail.workflow?.title}
                  </h2>
                  <p className="text-sm text-gray-500">{workflowResourceLabel(detail.entityType)} · {detail.entityId}</p>
                </div>
                <button type="button" className="text-gray-500 hover:text-gray-800" onClick={() => setDetail(null)} aria-label="Close">✕</button>
              </div>

              {detail.lock && (
                <p className="mb-3 text-amber-700 dark:text-amber-300 text-sm">
                  Currently being edited by {detail.lock.lockedByName || detail.lock.lockedByEmail || 'another editor'}.
                </p>
              )}

              <div className="flex flex-wrap gap-2 mb-4">
                <StatusBadge status={detail.workflow?.status || detail.status} />
                {detail.workflow?.reviewRound > 0 && (
                  <span className="text-xs text-gray-500">Round {detail.workflow.reviewRound}</span>
                )}
              </div>

              <div className="flex flex-wrap gap-2 mb-6">
                {canApprove && (
                  <button
                    type="button"
                    disabled={actionLoading}
                    className="px-3 py-1.5 text-sm rounded-lg bg-emerald-600 text-white"
                    onClick={() => runSingleAction(() => adminApi.workflowApprove(detail.entityType, detail.entityId))}
                  >
                    Approve
                  </button>
                )}
                {canReview && (
                  <button
                    type="button"
                    disabled={actionLoading}
                    className="px-3 py-1.5 text-sm rounded-lg bg-red-600 text-white"
                    onClick={() => {
                      const reason = window.prompt('Request changes — reason:') || '';
                      runSingleAction(() => adminApi.workflowRequestChanges(detail.entityType, detail.entityId, reason));
                    }}
                  >
                    Request changes
                  </button>
                )}
                {can(PERMISSIONS.WORKFLOW_PUBLISH) && (
                  <button
                    type="button"
                    disabled={actionLoading}
                    className="px-3 py-1.5 text-sm rounded-lg bg-indigo-600 text-white"
                    onClick={() => runSingleAction(() => adminApi.workflowPublish(detail.entityType, detail.entityId))}
                  >
                    Publish
                  </button>
                )}
              </div>

              <h3 className="font-medium text-gray-900 dark:text-white mb-2">Comments</h3>
              <ul className="space-y-2 mb-4 max-h-40 overflow-y-auto">
                {(detail.comments || []).map((c) => (
                  <li key={c._id} className={`text-sm p-2 rounded-lg ${c.resolved ? 'bg-gray-50 dark:bg-gray-900 opacity-60' : 'bg-gray-100 dark:bg-gray-700'}`}>
                    <div className="text-xs text-gray-500">{c.authorEmail} · {c.scope}{c.fieldKey ? ` · ${c.fieldKey}` : ''}</div>
                    <p>{c.body}</p>
                  </li>
                ))}
              </ul>
              {canReview && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add a comment…"
                    className="flex-1 border rounded-lg px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-600"
                    onKeyDown={(e) => e.key === 'Enter' && addComment()}
                  />
                  <button type="button" className="px-3 py-2 text-sm rounded-lg bg-primary-600 text-white" onClick={addComment}>Post</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminRouteGuard>
  );
}
