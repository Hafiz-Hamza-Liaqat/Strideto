import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { vaultApi } from '../../services/vaultApi';
import { ROUTES } from '../../constants';

const EXPIRY_STATE_COLORS = {
  valid: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  expiring_soon: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  expired: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  unknown: '',
};

function Section({ title, children }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 mb-4">
      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">{title}</h2>
      {children}
    </div>
  );
}

function MetaRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-gray-500 dark:text-gray-400 w-36 shrink-0">{label}</span>
      <span className="text-gray-900 dark:text-gray-100 break-words">{value}</span>
    </div>
  );
}

function UploadVersionModal({ documentId, onClose, onSuccess }) {
  const { t } = useTranslation('common');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) { setError(t('vault.fileRequired', 'Please select a file')); return; }
    setLoading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await vaultApi.uploadVersion(documentId, fd);
      onSuccess(data);
    } catch (err) {
      setError(err?.response?.data?.error || t('vault.uploadError', 'Upload failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">{t('vault.uploadNewVersion', 'Upload New Version')}</h3>
        {error && <div className="mb-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded px-3 py-2">{error}</div>}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input type="file" accept=".pdf,.docx,.jpg,.jpeg,.png,.webp" onChange={(e) => setFile(e.target.files[0] || null)} className="text-sm text-gray-600 dark:text-gray-400" />
          <p className="text-xs text-gray-400 dark:text-gray-500">{t('vault.versionHint', 'Previous version is preserved in history.')}</p>
          <div className="flex gap-2">
            <button type="button" className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 py-2 text-sm" onClick={onClose}>{t('cancel', 'Cancel')}</button>
            <button type="submit" disabled={loading} className="flex-1 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 py-2 text-sm font-medium text-white">
              {loading ? t('vault.uploading', 'Uploading…') : t('vault.upload', 'Upload')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ShareModal({ documentId, onClose }) {
  const { t } = useTranslation('common');
  const [grants, setGrants] = useState([]);
  const [form, setForm] = useState({ granteeType: 'agent', granteeId: '', purpose: '', permissions: ['view'] });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [revokeConfirm, setRevokeConfirm] = useState(null);

  useEffect(() => {
    vaultApi.listGrants(documentId).then(({ data }) => setGrants(data.data || [])).finally(() => setFetching(false));
  }, [documentId]);

  async function handleGrant(e) {
    e.preventDefault();
    if (!form.granteeId.trim()) { setError(t('vault.granteeRequired', 'Grantee ID is required')); return; }
    setLoading(true);
    setError('');
    try {
      const { data } = await vaultApi.createGrant(documentId, form);
      setGrants((g) => [data, ...g]);
      setForm((f) => ({ ...f, granteeId: '', purpose: '' }));
    } catch (err) {
      setError(err?.response?.data?.error || t('vault.grantError', 'Failed to create grant'));
    } finally {
      setLoading(false);
    }
  }

  async function confirmRevoke() {
    if (!revokeConfirm) return;
    try {
      await vaultApi.revokeGrant(documentId, revokeConfirm);
      setGrants((g) => g.map((gr) => String(gr._id) === revokeConfirm ? { ...gr, status: 'revoked' } : gr));
    } catch (err) {
      setError(err?.response?.data?.error || t('vault.revokeError', 'Failed to revoke access'));
    }
    setRevokeConfirm(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('vault.manageSharing', 'Manage Sharing')}</h3>
          <button className="text-gray-400 hover:text-gray-600" onClick={onClose}>✕</button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">{t('vault.shareDisclaimer', 'Sharing gives temporary access to this single document. You can revoke at any time.')}</p>

        {error && <div className="mb-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded px-3 py-2">{error}</div>}

        <form onSubmit={handleGrant} className="flex flex-col gap-2 mb-5">
          <div className="flex gap-2">
            <select className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1.5 text-sm" value={form.granteeType} onChange={(e) => setForm((f) => ({ ...f, granteeType: e.target.value }))}>
              <option value="agent">Agent</option>
              <option value="case">Case</option>
              <option value="system">System</option>
            </select>
            <input className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1.5 text-sm" placeholder={t('vault.granteeId', 'Grantee ID')} value={form.granteeId} onChange={(e) => setForm((f) => ({ ...f, granteeId: e.target.value }))} />
          </div>
          <input className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1.5 text-sm" placeholder={t('vault.purpose', 'Purpose (optional)')} value={form.purpose} onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))} />
          <button type="submit" disabled={loading} className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 py-1.5 text-sm font-medium text-white">
            {loading ? t('vault.granting', 'Granting…') : t('vault.grantAccess', 'Grant Access')}
          </button>
        </form>

        {fetching ? <div className="text-sm text-gray-400">{t('loading', 'Loading…')}</div> : (
          <div className="flex flex-col gap-2">
            {grants.length === 0 && <p className="text-sm text-gray-400">{t('vault.noGrants', 'No active access grants')}</p>}
            {grants.map((g) => (
              <div key={g._id} className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2">
                <div className="text-xs">
                  <span className="font-medium text-gray-700 dark:text-gray-300 capitalize">{g.granteeType}</span>
                  <span className="text-gray-400 dark:text-gray-500 ml-1">· {g.granteeId}</span>
                  {g.purpose && <span className="block text-gray-400 dark:text-gray-500">{g.purpose}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${g.status === 'active' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>{g.status}</span>
                  {g.status === 'active' && (
                    <button className="text-xs text-red-500 hover:text-red-700" onClick={() => setRevokeConfirm(String(g._id))}>
                      {t('vault.revoke', 'Revoke')}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {revokeConfirm && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6">
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">{t('vault.revokeConfirm', 'Revoke this grant immediately?')}</p>
              <div className="flex gap-2">
                <button className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 py-2 text-sm" onClick={() => setRevokeConfirm(null)}>{t('cancel', 'Cancel')}</button>
                <button className="flex-1 rounded-lg bg-red-600 hover:bg-red-700 py-2 text-sm font-medium text-white" onClick={confirmRevoke}>{t('vault.revokeConfirmBtn', 'Revoke')}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VaultDocumentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation('common');
  const [doc, setDoc] = useState(null);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  useEffect(() => {
    Promise.all([
      vaultApi.get(id),
      vaultApi.listVersions(id),
    ]).then(([docRes, vRes]) => {
      setDoc(docRes.data);
      setVersions(vRes.data.data || []);
    }).catch(() => setError(t('vault.notFound', 'Document not found'))).finally(() => setLoading(false));
  }, [id, t]);

  function handleVersionUploaded(v) {
    setShowVersionModal(false);
    setVersions((vs) => [v, ...vs]);
    vaultApi.get(id).then(({ data }) => setDoc(data));
  }

  function openAccess(versionId, download = false) {
    const url = vaultApi.accessUrl(id, { versionId, download });
    window.open(url, '_blank', 'noopener');
  }

  if (loading) return <div className="max-w-3xl mx-auto px-4 py-16 text-center text-gray-400 animate-pulse">{t('loading', 'Loading…')}</div>;
  if (error) return <div className="max-w-3xl mx-auto px-4 py-8 text-red-600">{error}</div>;
  if (!doc) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <button className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-4 flex items-center gap-1" onClick={() => navigate(ROUTES.VAULT)}>
        ← {t('vault.backToVault', 'Back to Vault')}
      </button>

      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{doc.displayName}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 capitalize mt-0.5">{doc.documentType?.replace(/_/g, ' ')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {doc.currentVersionId && (
            <button className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700" onClick={() => openAccess(null, false)}>
              {t('vault.view', 'View')}
            </button>
          )}
          {doc.currentVersionId && (
            <button className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700" onClick={() => openAccess(null, true)}>
              {t('vault.download', 'Download')}
            </button>
          )}
          <button className="rounded-lg bg-blue-600 hover:bg-blue-700 px-3 py-1.5 text-sm font-medium text-white" onClick={() => setShowVersionModal(true)}>
            {t('vault.uploadVersion', 'Upload New Version')}
          </button>
          <button className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700" onClick={() => setShowShareModal(true)}>
            {t('vault.share', 'Share')}
          </button>
        </div>
      </div>

      {doc.expiryState && doc.expiryState !== 'unknown' && (
        <div className={`mb-4 rounded-xl px-4 py-2 text-sm font-medium ${EXPIRY_STATE_COLORS[doc.expiryState]}`}>
          {doc.expiryState === 'expired' && t('vault.docExpired', 'This document has expired.')}
          {doc.expiryState === 'expiring_soon' && t('vault.docExpiringSoon', 'This document expires soon.')}
          {doc.expiryState === 'valid' && t('vault.docValid', 'Valid')}
        </div>
      )}

      <Section title={t('vault.details', 'Details')}>
        <div className="flex flex-col gap-1.5">
          <MetaRow label={t('vault.status', 'Status')} value={doc.status} />
          <MetaRow label={t('vault.issuingOrg', 'Issuing Org')} value={doc.issuingOrganization} />
          <MetaRow label={t('vault.countryCode', 'Country')} value={doc.countryCode} />
          {doc.issuedAt && <MetaRow label={t('vault.issuedAt', 'Issued')} value={new Date(doc.issuedAt).toLocaleDateString()} />}
          {doc.expiresAt && <MetaRow label={t('vault.expiresAt', 'Expires')} value={new Date(doc.expiresAt).toLocaleDateString()} />}
          <MetaRow label={t('vault.verification', 'Verification')} value={doc.verificationStatus} />
          <MetaRow label={t('vault.privacy', 'Privacy')} value={doc.privacyClassification} />
          <MetaRow label={t('vault.added', 'Added')} value={new Date(doc.createdAt).toLocaleDateString()} />
        </div>
      </Section>

      <Section title={t('vault.versionHistory', 'Version History')}>
        {versions.length === 0 && <p className="text-sm text-gray-400">{t('vault.noVersions', 'No files uploaded yet')}</p>}
        {versions.map((v, i) => (
          <div key={v._id} className={`flex items-center justify-between gap-2 py-2 ${i < versions.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''}`}>
            <div className="text-sm">
              <span className="font-medium text-gray-700 dark:text-gray-300">v{v.versionNumber}</span>
              <span className="text-gray-400 dark:text-gray-500 ml-2 text-xs">{v.originalFilename}</span>
              <span className="block text-xs text-gray-400 dark:text-gray-500">{new Date(v.uploadedAt).toLocaleString()} · {v.scanStatus}</span>
            </div>
            <div className="flex gap-2">
              <button className="text-xs text-blue-600 dark:text-blue-400 hover:underline" onClick={() => openAccess(v._id, false)}>{t('vault.view', 'View')}</button>
              <button className="text-xs text-blue-600 dark:text-blue-400 hover:underline" onClick={() => openAccess(v._id, true)}>{t('vault.download', 'Download')}</button>
            </div>
          </div>
        ))}
      </Section>

      {showVersionModal && <UploadVersionModal documentId={id} onClose={() => setShowVersionModal(false)} onSuccess={handleVersionUploaded} />}
      {showShareModal && <ShareModal documentId={id} onClose={() => setShowShareModal(false)} />}
    </div>
  );
}
