import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import { usePermissions } from '../../hooks/usePermissions';
import { PERMISSIONS } from '../../config/rbac';
import { useAdminList } from '../../hooks/useAdminList';
import { AdminRouteGuard } from '../../components/admin/AdminRouteGuard';
import { AdminDataTable } from '../../components/admin/AdminDataTable';
import { AdminStatusBadge } from '../../components/admin/adminTableUtils';
import { AdminSelectBare } from '../../components/admin/AdminFormFields';
import { EscapeWhen } from '../../a11y/EscapeWhen';
import axiosInstance from '../../services/axiosBase';
import { describeEvidencePolicy, classifyEvidenceSourceUrl, EVIDENCE_SOURCE_KINDS } from '@shared/international/evidencePolicy.js';

const STATUS_OPTIONS = [
  { value: '', label: 'Actionable (default)' },
  { value: 'all', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'email_verified', label: 'Email verified' },
  { value: 'verification_pending', label: 'Pending' },
  { value: 'under_review', label: 'Under review' },
  { value: 'needs_information', label: 'Needs information' },
  { value: 'enhanced_review', label: 'Enhanced review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'revoked', label: 'Revoked' },
  { value: 'expired', label: 'Expired' },
];

const TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'employer', label: 'Employer' },
  { value: 'agent', label: 'Agent' },
  { value: 'agency', label: 'Agency' },
  { value: 'institution', label: 'Institution (all)' },
  { value: 'university', label: 'University' },
  { value: 'college', label: 'College' },
  { value: 'institute', label: 'Institute' },
  { value: 'school', label: 'School' },
  { value: 'training_center', label: 'Training center' },
];

const RISK_OPTIONS = [
  { value: '', label: 'All risk levels' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

const CLAIM_STATE_OPTIONS = [
  { value: '', label: 'Any canonical claim' },
  { value: 'submitted', label: 'Claim submitted' },
  { value: 'under_review', label: 'Claim under review' },
  { value: 'needs_information', label: 'Claim needs information' },
  { value: 'approved', label: 'Claim approved' },
  { value: 'rejected', label: 'Claim rejected' },
];

function EvidencePolicyHint({ evidenceType, sourceUrl }) {
  const policy = describeEvidencePolicy(evidenceType);
  const sourceKind = classifyEvidenceSourceUrl(sourceUrl);
  return (
    <div className="mt-2 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/40 p-2 text-xs text-gray-600 dark:text-gray-300 space-y-1">
      <p><span className="font-semibold text-gray-800 dark:text-gray-100">Policy:</span> {policy.applicablePolicy}</p>
      <p><span className="font-semibold text-gray-800 dark:text-gray-100">Max trust outcome:</span> {policy.maxTrustOutcome}</p>
      <p><span className="font-semibold text-gray-800 dark:text-gray-100">Source rule:</span> {policy.sourceConstraint}</p>
      {policy.supportingOnly && (
        <p className="text-amber-800 dark:text-amber-200 font-medium">Maps / website note: Google Maps is supporting-only and never grants VERIFIED badges.</p>
      )}
      {sourceKind === EVIDENCE_SOURCE_KINDS.ORDINARY_WEBSITE && evidenceType === 'official_domain' && (
        <p className="text-blue-800 dark:text-blue-200">Website URLs are domain-evidence only — not registration, credential, or accreditation proof.</p>
      )}
      {sourceKind === EVIDENCE_SOURCE_KINDS.GOOGLE_MAPS && evidenceType !== 'google_maps' && (
        <p className="text-red-700 dark:text-red-300 font-medium">This source is a Maps URL and cannot be accepted for this evidence type.</p>
      )}
    </div>
  );
}

function Field({ label, value }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="min-w-0">
      <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="font-medium text-gray-900 dark:text-white break-words">{String(value)}</dd>
    </div>
  );
}

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

  useEffect(() => { load(); }, [orgId]); // eslint-disable-line react-hooks/exhaustive-deps

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
      <div className="p-6 text-center text-gray-500 dark:text-gray-400" aria-busy="true">
        Loading verification details…
      </div>
    );
  }
  if (!detail) return null;

  const { verification: v, evidence, history, jurisdiction } = detail;
  const profile = v?.profile || {};
  const address = profile.registeredAddress || {};
  const mapsUrl = address.googleMapsUrl;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/40" onClick={onClose}>
      <EscapeWhen active onEscape={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="verification-dossier-title"
        className="relative bg-white dark:bg-gray-900 w-full max-w-xl h-full overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <h2 id="verification-dossier-title" className="text-lg font-semibold text-gray-900 dark:text-white">
            Verification dossier
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close verification dossier"
            className="min-h-[44px] min-w-[44px] text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-xl font-bold"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <AdminStatusBadge value={v.status} label={v.status?.replace(/_/g, ' ')} />
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                Risk: {v.riskLevel || '—'}
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
            {v.nextReviewAt && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Re-review due: {new Date(v.nextReviewAt).toLocaleString()}
              </p>
            )}
          </div>

          <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3 text-xs text-amber-900 dark:text-amber-200">
            <p className="font-semibold">Jurisdiction-aware review</p>
            <p className="mt-1">Country: {jurisdiction?.countryCode || profile.countryCode || '—'}</p>
            <p>Organization type: {jurisdiction?.organizationType || v.organizationType || '—'}</p>
            <p>License / credential policy: {(jurisdiction?.credentialPolicy || 'not_applicable').replace(/_/g, ' ')}</p>
            <p className="mt-1 font-medium">{jurisdiction?.reviewMode || 'Manual verification required'}</p>
            <p>No live external registry check is performed. Official registry URLs may be opened manually.</p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Identity</h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <Field label="Legal name" value={profile.legalName} />
              <Field label="Display name" value={profile.displayName} />
              <Field label="Organization type" value={v.organizationType} />
              <Field label="Country" value={profile.countryCode || v.countryCode} />
              <Field label="City / region" value={[address.city, address.region].filter(Boolean).join(', ')} />
              <Field label="Phone" value={profile.phone} />
              <Field label="Official email" value={profile.officialEmail} />
              <Field label="Website" value={profile.officialWebsite} />
              <Field label="Official domain" value={profile.officialDomain} />
            </dl>
            {address.addressLine1 && (
              <p className="text-sm text-gray-700 dark:text-gray-200 mt-2">
                {address.addressLine1}{address.addressLine2 ? `, ${address.addressLine2}` : ''}
                {address.postalCode ? ` ${address.postalCode}` : ''}
              </p>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Registration / regulatory</h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <Field label="Registration authority" value={profile.registrationAuthority} />
              <Field label="Registration number" value={profile.registrationNumber} />
              <Field label="Registration country" value={profile.registrationCountry} />
              <Field label="License / accreditation authority" value={profile.licenseIssuer || profile.accreditationBody} />
              <Field label="License / accreditation number" value={profile.licenseNumber || profile.accreditationNumber} />
              <Field label="Jurisdiction" value={profile.licenseJurisdiction} />
              <Field label="License expiry" value={profile.licenseExpiresAt ? new Date(profile.licenseExpiresAt).toLocaleDateString() : ''} />
              <Field label="Policy classification" value={(jurisdiction?.credentialPolicy || '').replace(/_/g, ' ')} />
            </dl>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Representative</h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <Field label="Name" value={profile.authorizedRepresentative} />
              <Field label="Role" value={profile.representativeRole} />
              <Field label="Authority evidence ref" value={profile.representativeAuthorizationRef} />
            </dl>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Location / supporting evidence</h3>
            {mapsUrl ? (
              <div className="space-y-2">
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  Google Maps / Business is supporting evidence only. It can never by itself verify an organization.
                </p>
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary dark:text-mint underline break-all"
                >
                  Open submitted Maps / Business URL
                </a>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No Maps / Business URL submitted.</p>
            )}
            <Field label="Official website" value={profile.officialWebsite} />
          </div>

          {v.informationRequestReason && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-3">
              <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-400">Information requested:</p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">{v.informationRequestReason}</p>
            </div>
          )}

          {evidence?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Evidence ({evidence.length})</h3>
              <ul className="space-y-2">
                {evidence.map((e) => (
                  <li key={e._id} className="bg-gray-50 dark:bg-gray-800 rounded p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{e.evidenceType?.replace(/_/g, ' ')}</span>
                        <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                          {e.status}
                        </span>
                        <p className="text-xs text-gray-500 mt-1">
                          Submitted {e.submittedAt ? new Date(e.submittedAt).toLocaleDateString() : '—'}
                          {e.expiresAt ? ` · Expires ${new Date(e.expiresAt).toLocaleDateString()}` : ''}
                        </p>
                        {e.sourceUrl && (
                          <p className="text-xs text-gray-500 break-all">Source: {e.sourceUrl}</p>
                        )}
                        {e.evidenceRef && (
                          <p className="text-xs text-gray-500">Reference: {e.evidenceRef}</p>
                        )}
                        <EvidencePolicyHint evidenceType={e.evidenceType} sourceUrl={e.sourceUrl} />
                      </div>
                      {can(PERMISSIONS.VERIFICATION_REVIEW) && e.status === 'pending' && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => reviewEvidence(e._id, 'accepted')}
                            disabled={actionLoading === `ev-${e._id}`}
                            className="min-h-[44px] text-xs px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            onClick={() => reviewEvidence(e._id, 'rejected')}
                            disabled={actionLoading === `ev-${e._id}`}
                            className="min-h-[44px] text-xs px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {can(PERMISSIONS.VERIFICATION_REVIEW) && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Review actions</h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {v.status === 'verification_pending' && (
                  <button type="button" onClick={() => runAction('begin-review')} disabled={!!actionLoading} className="min-h-[44px] text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">Start review</button>
                )}
                {['under_review', 'enhanced_review', 'needs_information'].includes(v.status) && (
                  <button type="button" onClick={() => setActiveAction('request-information')} className="min-h-[44px] text-xs px-3 py-1.5 bg-yellow-600 text-white rounded hover:bg-yellow-700">Request more information</button>
                )}
                {['under_review', 'needs_information'].includes(v.status) && (
                  <button type="button" onClick={() => setActiveAction('escalate')} className="min-h-[44px] text-xs px-3 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700">Move to enhanced review</button>
                )}
                {can(PERMISSIONS.VERIFICATION_APPROVE) && ['under_review', 'needs_information', 'enhanced_review'].includes(v.status) && (
                  <>
                    <button type="button" onClick={() => runAction('approve', false)} disabled={!!actionLoading} className="min-h-[44px] text-xs px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">Approve</button>
                    <button type="button" onClick={() => setActiveAction('reject')} className="min-h-[44px] text-xs px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700">Reject</button>
                  </>
                )}
                {can(PERMISSIONS.VERIFICATION_APPROVE) && v.status === 'approved' && (
                  <button type="button" onClick={() => setActiveAction('suspend')} className="min-h-[44px] text-xs px-3 py-1.5 bg-orange-600 text-white rounded hover:bg-orange-700">Suspend</button>
                )}
                {can(PERMISSIONS.VERIFICATION_APPROVE) && v.status === 'suspended' && (
                  <button type="button" onClick={() => runAction('unsuspend', false)} disabled={!!actionLoading} className="min-h-[44px] text-xs px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">Unsuspend</button>
                )}
                {can(PERMISSIONS.VERIFICATION_REVOKE) && ['approved', 'suspended'].includes(v.status) && (
                  <button type="button" onClick={() => setActiveAction('revoke')} className="min-h-[44px] text-xs px-3 py-1.5 bg-red-800 text-white rounded hover:bg-red-900">Revoke</button>
                )}
              </div>

              {activeAction && (
                <div className="mt-2 space-y-2">
                  <label htmlFor="verification-action-reason" className="text-xs text-gray-600 dark:text-gray-300">
                    Reason for {activeAction.replace(/-/g, ' ')}
                  </label>
                  <textarea
                    id="verification-action-reason"
                    value={reasonInput}
                    onChange={(e) => setReasonInput(e.target.value)}
                    className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded p-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => runAction(activeAction, true)} disabled={!!actionLoading} className="min-h-[44px] text-xs px-3 py-1.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded disabled:opacity-50">Confirm</button>
                    <button type="button" onClick={() => { setActiveAction(''); setReasonInput(''); }} className="min-h-[44px] text-xs px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {history?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Transition history</h3>
              <ol className="space-y-2">
                {history.map((t, i) => (
                  <li key={t._id || i} className="text-xs text-gray-600 dark:text-gray-400 flex gap-2">
                    <span className="shrink-0 text-gray-400">{t.occurredAt ? new Date(t.occurredAt).toLocaleString() : '—'}</span>
                    <span>
                      <span className="font-medium text-gray-900 dark:text-white">{t.fromStatus}</span>
                      {' → '}
                      <span className="font-medium text-gray-900 dark:text-white">{t.toStatus}</span>
                      {t.actorRole && <span className="ml-1">({t.actorRole})</span>}
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedOrgId, setSelectedOrgId] = useState(searchParams.get('org') || null);

  const { data, pagination, filters, setFilters, loading, error, setPage, refetch } = useAdminList(
    '/admin/verification/queue',
    {
      initialFilters: {
        status: '',
        organizationType: '',
        countryCode: '',
        riskLevel: '',
        q: '',
        submittedFrom: '',
        submittedTo: '',
        claimState: '',
      },
      limit: 20,
    }
  );

  useEffect(() => {
    const org = searchParams.get('org');
    if (org) setSelectedOrgId(org);
    const status = searchParams.get('status');
    if (status) {
      setFilters((prev) => (prev.status === status ? prev : { ...prev, status }));
    }
  }, [searchParams, setFilters]);

  const updateFilter = (key, val) => {
    setFilters({ ...filters, [key]: val });
    setPage(1);
  };

  const openDossier = (orgId) => {
    setSelectedOrgId(orgId);
    const next = new URLSearchParams(searchParams);
    next.set('org', orgId);
    setSearchParams(next, { replace: true });
  };

  const closeDossier = () => {
    setSelectedOrgId(null);
    const next = new URLSearchParams(searchParams);
    next.delete('org');
    setSearchParams(next, { replace: true });
  };

  const columns = [
    {
      key: 'org',
      label: 'Organization',
      render: (row) => (
        <div className="min-w-0">
          <div className="font-medium text-gray-900 dark:text-white text-sm break-words">
            {row.organizationId?.displayName || row.profile?.legalName || '—'}
          </div>
          <div className="text-xs text-gray-500">{row.organizationType} · {row.countryCode || '—'}</div>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Verification',
      render: (row) => (
        <AdminStatusBadge value={row.status} label={row.status?.replace(/_/g, ' ')} />
      ),
    },
    {
      key: 'canonicalClaimState',
      label: 'Canonical claim',
      render: (row) => row.canonicalClaimState
        ? <span className="text-xs text-gray-700 dark:text-gray-300">{row.canonicalClaimState.replace(/_/g, ' ')}</span>
        : <span className="text-xs text-gray-400">—</span>,
    },
    {
      key: 'riskLevel',
      label: 'Risk',
      render: (row) => (
        <span className={`text-xs font-semibold ${row.riskLevel === 'high' || row.riskLevel === 'critical' ? 'text-red-600 dark:text-red-400' : row.riskLevel === 'medium' ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}`}>
          {(row.riskLevel || '—').toUpperCase()}
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
      key: 'reviewer',
      label: 'Reviewer',
      render: (row) => (
        <span className="text-xs text-gray-600 dark:text-gray-400">
          {row.currentReviewerId?.email || 'Unassigned'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <button
          type="button"
          onClick={() => openDossier(row.organizationId?._id || row.organizationId)}
          className="min-h-[44px] text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Review
        </button>
      ),
    },
  ];

  return (
    <AdminRouteGuard permission={PERMISSIONS.VERIFICATION_READ}>
      <div className="space-y-4 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Verification Queue</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Employer, Agent/Agency, and Institution organization verification. Canonical claims are listed separately and do not prove legitimacy.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <label className="sr-only" htmlFor="vq-search">Search organization name or registration number</label>
          <input
            id="vq-search"
            type="search"
            placeholder="Name or registration #"
            value={filters.q}
            onChange={(e) => updateFilter('q', e.target.value)}
            className="text-sm border border-gray-300 dark:border-gray-600 rounded px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white w-48 min-h-[44px]"
          />
          <AdminSelectBare aria-label="Verification status" value={filters.status} onChange={(e) => updateFilter('status', e.target.value)}>
            {STATUS_OPTIONS.map((o) => <option key={o.value || 'all'} value={o.value}>{o.label}</option>)}
          </AdminSelectBare>
          <AdminSelectBare aria-label="Organization type" value={filters.organizationType} onChange={(e) => updateFilter('organizationType', e.target.value)}>
            {TYPE_OPTIONS.map((o) => <option key={o.value || 'all'} value={o.value}>{o.label}</option>)}
          </AdminSelectBare>
          <AdminSelectBare aria-label="Risk level" value={filters.riskLevel} onChange={(e) => updateFilter('riskLevel', e.target.value)}>
            {RISK_OPTIONS.map((o) => <option key={o.value || 'all'} value={o.value}>{o.label}</option>)}
          </AdminSelectBare>
          <AdminSelectBare aria-label="Canonical claim state" value={filters.claimState} onChange={(e) => updateFilter('claimState', e.target.value)}>
            {CLAIM_STATE_OPTIONS.map((o) => <option key={o.value || 'all'} value={o.value}>{o.label}</option>)}
          </AdminSelectBare>
          <input
            type="text"
            aria-label="Country code"
            placeholder="Country (e.g. PK)"
            value={filters.countryCode}
            onChange={(e) => updateFilter('countryCode', e.target.value.toUpperCase())}
            className="text-sm border border-gray-300 dark:border-gray-600 rounded px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white w-36 min-h-[44px]"
            maxLength={2}
          />
          <label className="text-xs text-gray-500 flex items-center gap-1">
            From
            <input type="date" value={filters.submittedFrom} onChange={(e) => updateFilter('submittedFrom', e.target.value)} className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white min-h-[44px]" />
          </label>
          <label className="text-xs text-gray-500 flex items-center gap-1">
            To
            <input type="date" value={filters.submittedTo} onChange={(e) => updateFilter('submittedTo', e.target.value)} className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white min-h-[44px]" />
          </label>
        </div>

        <AdminDataTable
          columns={columns}
          data={data}
          loading={loading}
          error={error}
          pagination={pagination}
          onPageChange={setPage}
          tableLabel="Organization verification queue"
        />

        {selectedOrgId && (
          <VerificationDetailPanel
            orgId={selectedOrgId}
            onClose={closeDossier}
            onAction={refetch}
            can={can}
          />
        )}
      </div>
    </AdminRouteGuard>
  );
}
