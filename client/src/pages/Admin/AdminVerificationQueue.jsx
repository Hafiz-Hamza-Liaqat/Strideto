import { useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { usePermissions } from '../../hooks/usePermissions';
import { PERMISSIONS } from '../../config/rbac';
import { useAdminList } from '../../hooks/useAdminList';
import { AdminRouteGuard } from '../../components/admin/AdminRouteGuard';
import { AdminDataTable } from '../../components/admin/AdminDataTable';
import { AdminStatusBadge } from '../../components/admin/adminTableUtils';
import { AdminSelectBare } from '../../components/admin/AdminFormFields';
import axiosInstance from '../../services/axiosBase';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'verification_pending', label: 'Pending' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'needs_information', label: 'Needs Information' },
  { value: 'enhanced_review', label: 'Enhanced Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'revoked', label: 'Revoked' },
];

const TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'employer', label: 'Employer' },
  { value: 'agent', label: 'Agent' },
  { value: 'agency', label: 'Agency' },
  { value: 'university', label: 'University' },
  { value: 'college', label: 'College' },
  { value: 'institute', label: 'Institute' },
];

const RISK_OPTIONS = [
  { value: '', label: 'All risk levels' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

const STATUS_COLOR = {
  draft: 'gray',
  email_verified: 'blue',
  verification_pending: 'yellow',
  under_review: 'blue',
  needs_information: 'orange',
  enhanced_review: 'purple',
  approved: 'green',
  rejected: 'red',
  suspended: 'orange',
  revoked: 'red',
  expired: 'gray',
};

const RISK_COLOR = {
  low: 'green',
  medium: 'yellow',
  high: 'orange',
  critical: 'red',
};

function VerificationDetailPanel({ orgId, onClose, onAction, can }) {
  const { toast } = useToast();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [reasonInput, setReasonInput] = useState('');
  const [activeAction, setActiveAction] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get(`/admin/verification/${orgId}`);
      setDetail(res.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load verification details');
    } finally {
      setLoading(false);
    }
  };

  useState(() => { load(); }, []);

  const runAction = async (action, needsReason = false) => {
    if (needsReason && !reasonInput.trim()) {
      toast.error('A reason is required for this action');
      return;
    }
    setActionLoading(action);
    try {
      await axiosInstance.post(`/admin/verification/${orgId}/${action}`, {
        reason: reasonInput.trim() || undefined,
      });
      toast.success('Action completed');
      setActiveAction('');
      setReasonInput('');
      load();
      onAction?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Action failed');
    } finally {
      setActionLoading('');
    }
  };

  const reviewEvidence = async (evidenceId, status) => {
    setActionLoading(`ev-${evidenceId}`);
    try {
      await axiosInstance.post(
        `/admin/verification/${orgId}/evidence/${evidenceId}/review`,
        { status }
      );
      toast.success('Evidence updated');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update evidence');
    } finally {
      setActionLoading('');
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-center text-gray-500 dark:text-gray-400">Loading verification details…</div>
    );
  }
  if (!detail) return null;

  const { verification: v, evidence, history } = detail;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/40" onClick={onClose}>
      <div
        className="relative bg-white dark:bg-gray-900 w-full max-w-xl h-full overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Verification Detail</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-xl font-bold">×</button>
        </div>

        <div className="p-6 space-y-6">
          {/* Status + badges */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-${STATUS_COLOR[v.status] || 'gray'}-100 text-${STATUS_COLOR[v.status] || 'gray'}-800 dark:bg-${STATUS_COLOR[v.status] || 'gray'}-900/30 dark:text-${STATUS_COLOR[v.status] || 'gray'}-400`}>
                {v.status?.replace(/_/g, ' ')}
              </span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-${RISK_COLOR[v.riskLevel] || 'gray'}-100 text-${RISK_COLOR[v.riskLevel] || 'gray'}-800`}>
                Risk: {v.riskLevel}
              </span>
            </div>
            {v.submittedAt && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Submitted: {new Date(v.submittedAt).toLocaleString()}
                {v.slaDeadlineAt && (
                  <span className={`ml-2 ${new Date() > new Date(v.slaDeadlineAt) ? 'text-red-600 font-semibold' : ''}`}>
                    · SLA: {new Date(v.slaDeadlineAt).toLocaleString()}
                    {new Date() > new Date(v.slaDeadlineAt) ? ' (BREACHED)' : ''}
                  </span>
                )}
              </p>
            )}
            {v.earnedBadges?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {v.earnedBadges.map((b) => (
                  <span key={b} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                    {b.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Profile summary */}
          {v.profile && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Verification Profile</h3>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {[
                  ['Legal Name', v.profile.legalName],
                  ['Country', v.profile.countryCode],
                  ['Official Email', v.profile.officialEmail],
                  ['Website', v.profile.officialWebsite],
                  ['Registration #', v.profile.registrationNumber],
                  ['License #', v.profile.licenseNumber],
                  ['Representative', v.profile.authorizedRepresentative],
                  ['Rep. Role', v.profile.representativeRole],
                ].filter(([, val]) => val).map(([label, val]) => (
                  <div key={label}>
                    <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
                    <dd className="font-medium text-gray-900 dark:text-white truncate">{val}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {v.informationRequestReason && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-3">
              <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-400">Information requested:</p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">{v.informationRequestReason}</p>
            </div>
          )}
          {v.rejectionReason && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3">
              <p className="text-sm font-semibold text-red-800 dark:text-red-400">Rejection reason:</p>
              <p className="text-sm text-red-700 dark:text-red-300">{v.rejectionReason}</p>
            </div>
          )}

          {/* Evidence */}
          {evidence?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Evidence ({evidence.length})</h3>
              <ul className="space-y-2">
                {evidence.map((e) => (
                  <li key={e._id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded p-3">
                    <div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{e.evidenceType?.replace(/_/g, ' ')}</span>
                      <span className={`ml-2 text-xs px-1.5 py-0.5 rounded bg-${STATUS_COLOR[e.status] || 'gray'}-100 text-${STATUS_COLOR[e.status] || 'gray'}-800`}>
                        {e.status}
                      </span>
                    </div>
                    {can(PERMISSIONS.VERIFICATION_REVIEW) && e.status === 'pending' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => reviewEvidence(e._id, 'accepted')}
                          disabled={actionLoading === `ev-${e._id}`}
                          className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                        >Accept</button>
                        <button
                          onClick={() => reviewEvidence(e._id, 'rejected')}
                          disabled={actionLoading === `ev-${e._id}`}
                          className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                        >Reject</button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          {can(PERMISSIONS.VERIFICATION_REVIEW) && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Review Actions</h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {v.status === 'verification_pending' && (
                  <button
                    onClick={() => runAction('begin-review')}
                    disabled={!!actionLoading}
                    className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >Begin Review</button>
                )}
                {['under_review', 'enhanced_review', 'needs_information'].includes(v.status) && (
                  <button
                    onClick={() => setActiveAction('request-information')}
                    className="text-xs px-3 py-1.5 bg-yellow-600 text-white rounded hover:bg-yellow-700"
                  >Request Info</button>
                )}
                {['under_review', 'needs_information'].includes(v.status) && (
                  <button
                    onClick={() => setActiveAction('escalate')}
                    className="text-xs px-3 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700"
                  >Escalate</button>
                )}
                {can(PERMISSIONS.VERIFICATION_APPROVE) && ['under_review', 'needs_information', 'enhanced_review'].includes(v.status) && (
                  <>
                    <button
                      onClick={() => runAction('approve', false)}
                      disabled={!!actionLoading}
                      className="text-xs px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                    >Approve</button>
                    <button
                      onClick={() => setActiveAction('reject')}
                      className="text-xs px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700"
                    >Reject</button>
                  </>
                )}
                {can(PERMISSIONS.VERIFICATION_APPROVE) && v.status === 'approved' && (
                  <button
                    onClick={() => setActiveAction('suspend')}
                    className="text-xs px-3 py-1.5 bg-orange-600 text-white rounded hover:bg-orange-700"
                  >Suspend</button>
                )}
                {can(PERMISSIONS.VERIFICATION_APPROVE) && v.status === 'suspended' && (
                  <button
                    onClick={() => runAction('unsuspend', false)}
                    disabled={!!actionLoading}
                    className="text-xs px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                  >Unsuspend</button>
                )}
                {can(PERMISSIONS.VERIFICATION_REVOKE) && ['approved', 'suspended'].includes(v.status) && (
                  <button
                    onClick={() => setActiveAction('revoke')}
                    className="text-xs px-3 py-1.5 bg-red-800 text-white rounded hover:bg-red-900"
                  >Revoke (SuperAdmin)</button>
                )}
              </div>

              {activeAction && (
                <div className="mt-2 space-y-2">
                  <textarea
                    value={reasonInput}
                    onChange={(e) => setReasonInput(e.target.value)}
                    placeholder={`Reason for ${activeAction.replace(/-/g, ' ')}…`}
                    className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded p-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => runAction(activeAction, true)}
                      disabled={!!actionLoading}
                      className="text-xs px-3 py-1.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded hover:bg-gray-700 dark:hover:bg-gray-100 disabled:opacity-50"
                    >Confirm</button>
                    <button
                      onClick={() => { setActiveAction(''); setReasonInput(''); }}
                      className="text-xs px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Transition history */}
          {history?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Audit History</h3>
              <ol className="space-y-2">
                {history.slice(0, 10).map((t, i) => (
                  <li key={i} className="text-xs text-gray-600 dark:text-gray-400 flex gap-2">
                    <span className="shrink-0 text-gray-400">{new Date(t.occurredAt).toLocaleString()}</span>
                    <span>
                      <span className="font-medium text-gray-900 dark:text-white">{t.fromStatus}</span>
                      {' → '}
                      <span className="font-medium text-gray-900 dark:text-white">{t.toStatus}</span>
                      {t.reason && <span className="ml-1 italic">&quot;{t.reason}&quot;</span>}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminVerificationQueue() {
  const { can } = usePermissions();
  const [selectedOrgId, setSelectedOrgId] = useState(null);

  const { data, pagination, filters, setFilters, loading, error, setPage, refetch } = useAdminList(
    '/admin/verification/queue',
    {
      initialFilters: { status: '', organizationType: '', countryCode: '', riskLevel: '' },
      limit: 20,
    }
  );

  const updateFilter = (key, val) => {
    setFilters({ ...filters, [key]: val });
    setPage(1);
  };

  const columns = [
    {
      key: 'org',
      label: 'Organization',
      render: (row) => (
        <div>
          <div className="font-medium text-gray-900 dark:text-white text-sm">
            {row.organizationId?.displayName || '—'}
          </div>
          <div className="text-xs text-gray-500">{row.organizationType} · {row.countryCode || '—'}</div>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <AdminStatusBadge value={row.status} label={row.status?.replace(/_/g, ' ')} />
      ),
    },
    {
      key: 'riskLevel',
      label: 'Risk',
      render: (row) => (
        <span className={`text-xs font-semibold ${row.riskLevel === 'high' || row.riskLevel === 'critical' ? 'text-red-600 dark:text-red-400' : row.riskLevel === 'medium' ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}`}>
          {row.riskLevel?.toUpperCase()}
        </span>
      ),
    },
    {
      key: 'submittedAt',
      label: 'Submitted',
      render: (row) => row.submittedAt ? (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {new Date(row.submittedAt).toLocaleDateString()}
        </span>
      ) : '—',
    },
    {
      key: 'sla',
      label: 'SLA',
      render: (row) => {
        if (!row.slaDeadlineAt) return '—';
        const breached = new Date() > new Date(row.slaDeadlineAt);
        return (
          <span className={`text-xs font-medium ${breached ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>
            {breached ? 'BREACHED' : new Date(row.slaDeadlineAt).toLocaleDateString()}
          </span>
        );
      },
    },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <button
          onClick={() => setSelectedOrgId(row.organizationId?._id || row.organizationId)}
          className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Review
        </button>
      ),
    },
  ];

  return (
    <AdminRouteGuard permission={PERMISSIONS.VERIFICATION_READ}>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Verification Queue</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Organization trust &amp; verification review
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <AdminSelectBare
            value={filters.status}
            onChange={(e) => updateFilter('status', e.target.value)}
            options={STATUS_OPTIONS}
          />
          <AdminSelectBare
            value={filters.organizationType}
            onChange={(e) => updateFilter('organizationType', e.target.value)}
            options={TYPE_OPTIONS}
          />
          <AdminSelectBare
            value={filters.riskLevel}
            onChange={(e) => updateFilter('riskLevel', e.target.value)}
            options={RISK_OPTIONS}
          />
          <input
            type="text"
            placeholder="Country code (e.g. PK)"
            value={filters.countryCode}
            onChange={(e) => updateFilter('countryCode', e.target.value.toUpperCase())}
            className="text-sm border border-gray-300 dark:border-gray-600 rounded px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white w-36"
            maxLength={2}
          />
        </div>

        <AdminDataTable
          columns={columns}
          data={data}
          loading={loading}
          error={error}
          pagination={pagination}
          onPageChange={setPage}
        />

        {selectedOrgId && (
          <VerificationDetailPanel
            orgId={selectedOrgId}
            onClose={() => setSelectedOrgId(null)}
            onAction={refetch}
            can={can}
          />
        )}
      </div>
    </AdminRouteGuard>
  );
}
