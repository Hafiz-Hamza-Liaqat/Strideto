import { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { vaultApi } from '../../services/vaultApi';
import { ROUTES } from '../../constants';
import { useOverlayA11y } from '../../a11y/useOverlayA11y';
import { Modal } from '../../components/ui/Modals';

const VAULT_DOCUMENT_TYPES = [
  'passport', 'national_identity', 'transcript', 'degree_certificate', 'marksheet',
  'language_test_result', 'standardized_test_result', 'cv_resume', 'statement_of_purpose',
  'recommendation_letter', 'financial_document', 'employment_document', 'portfolio',
  'admission_letter', 'scholarship_letter', 'visa_document', 'other',
];

const EXPIRY_STATE_COLORS = {
  valid: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  expiring_soon: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  expired: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  unknown: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
};

function ExpiryBadge({ state }) {
  if (!state || state === 'unknown') return null;
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium capitalize ${EXPIRY_STATE_COLORS[state] || EXPIRY_STATE_COLORS.unknown}`}>
      {state.replace('_', ' ')}
    </span>
  );
}

function DocumentCard({ doc, onArchive }) {
  const { t } = useTranslation('common');
  return (
    <article className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex flex-col gap-2 hover:shadow-md transition-shadow min-w-0">
      <Link to={`${ROUTES.VAULT}/${doc._id}`} className="block min-w-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 break-words flex-1">{doc.displayName}</h3>
        {doc.expiryState && doc.expiryState !== 'unknown' && <ExpiryBadge state={doc.expiryState} />}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
        {doc.documentType?.replace(/_/g, ' ')}
      </p>
      {doc.issuingOrganization && (
        <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{doc.issuingOrganization}</p>
      )}
      {doc.expiresAt && (
        <p className="text-xs text-gray-400 dark:text-gray-500">
          {t('vault.expires', 'Expires')}: {new Date(doc.expiresAt).toLocaleDateString()}
        </p>
      )}
      <div className="flex items-center gap-2 mt-1">
        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium capitalize ${doc.status === 'active' ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>
          {doc.status}
        </span>
        {!doc.currentVersionId && (
          <span className="text-xs text-yellow-600 dark:text-yellow-400">{t('vault.noFile', 'No file uploaded')}</span>
        )}
      </div>
      </Link>
      {doc.status === 'active' && (
        <button
          type="button"
          className="min-h-[44px] px-2 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-300 mt-1 self-start"
          onClick={() => onArchive(doc._id, doc.displayName)}
        >
          {t('vault.archive', 'Archive')}
        </button>
      )}
    </article>
  );
}

function UploadModal({ onClose, onSuccess }) {
  const { t } = useTranslation('common');
  const [form, setForm] = useState({ displayName: '', documentType: 'other', description: '', expiresAt: '', issuingOrganization: '' });
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef();
  const panelRef = useRef(null);
  useOverlayA11y({ open: true, onClose, containerRef: panelRef, trapFocus: true });
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.displayName.trim()) { setError(t('vault.nameRequired', 'Document name is required')); return; }
    setLoading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('displayName', form.displayName.trim());
      fd.append('documentType', form.documentType);
      if (form.description.trim()) fd.append('description', form.description.trim());
      if (form.expiresAt) fd.append('expiresAt', form.expiresAt);
      if (form.issuingOrganization.trim()) fd.append('issuingOrganization', form.issuingOrganization.trim());
      if (file) fd.append('file', file);
      const { data } = await vaultApi.create(fd);
      onSuccess(data);
    } catch (err) {
      setError(err?.response?.data?.error || t('vault.uploadError', 'Upload failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="vault-upload-title" tabIndex={-1} className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6 relative outline-none">
        <button type="button" aria-label={t('close', 'Close')} className="absolute top-2 end-2 min-h-[44px] min-w-[44px] text-gray-500 hover:text-gray-700" onClick={onClose}>✕</button>
        <h2 id="vault-upload-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 pe-10">{t('vault.addDocument', 'Add Document')}</h2>
        {error && <div className="mb-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm px-3 py-2" role="alert">{error}</div>}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label htmlFor="vault-document-name" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('vault.name', 'Document Name')} *</label>
            <input id="vault-document-name" required className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.displayName} onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))} maxLength={200} />
          </div>
          <div>
            <label htmlFor="vault-document-type" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('vault.type', 'Document Type')}</label>
            <select id="vault-document-type" className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.documentType} onChange={(e) => setForm((f) => ({ ...f, documentType: e.target.value }))}>
              {VAULT_DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="vault-issuing-organization" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('vault.issuingOrg', 'Issuing Organization')}</label>
            <input id="vault-issuing-organization" className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.issuingOrganization} onChange={(e) => setForm((f) => ({ ...f, issuingOrganization: e.target.value }))} maxLength={300} />
          </div>
          <div>
            <label htmlFor="vault-expiry-date" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('vault.expiresAt', 'Expiry Date (optional)')}</label>
            <input id="vault-expiry-date" type="date" className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.expiresAt} onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))} />
          </div>
          <div>
            <label htmlFor="vault-document-file" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('vault.file', 'File (PDF, DOCX, JPG, PNG — max 20 MB)')}</label>
            <input id="vault-document-file" ref={fileRef} type="file" accept=".pdf,.docx,.jpg,.jpeg,.png,.webp" className="min-h-[44px] max-w-full text-sm text-gray-600 dark:text-gray-400" onChange={(e) => setFile(e.target.files[0] || null)} />
          </div>
          <div className="flex gap-2 mt-2">
            <button type="button" className="flex-1 min-h-[44px] rounded-lg border border-gray-300 dark:border-gray-600 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700" onClick={onClose}>{t('cancel', 'Cancel')}</button>
            <button type="submit" disabled={loading} className="flex-1 min-h-[44px] rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 py-2 text-sm font-medium text-white">
              {loading ? t('vault.uploading', 'Uploading…') : t('vault.save', 'Save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const TABS = ['All', 'Expiring', 'Archived'];

export default function VaultPage() {
  const { t } = useTranslation('common');
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [archiveConfirm, setArchiveConfirm] = useState(null);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (tab === 'Archived') params.status = 'archived';
      else if (tab === 'Expiring') params.expiring = 'true';
      const { data } = await vaultApi.list(params);
      setDocuments(data.items || []);
    } catch {
      setError(t('vault.fetchError', 'Could not load documents'));
    } finally {
      setLoading(false);
    }
  }, [tab, t]);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

  async function handleArchive(id, name) {
    setArchiveConfirm({ id, name });
  }

  async function confirmArchive() {
    if (!archiveConfirm) return;
    try {
      await vaultApi.archive(archiveConfirm.id);
      setArchiveConfirm(null);
      fetchDocuments();
    } catch {
      setArchiveConfirm(null);
    }
  }

  function handleCreated() {
    setShowModal(false);
    fetchDocuments();
  }

  const expiringCount = documents.filter((d) => d.expiryState === 'expiring_soon').length;
  const expiredCount = documents.filter((d) => d.expiryState === 'expired').length;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('vault.title', 'My Document Vault')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{t('vault.subtitle', 'Private. Owned by you. Shared only when you choose.')}</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="min-h-[44px] shrink-0 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2"
        >
          + {t('vault.add', 'Add Document')}
        </button>
      </div>

      {(expiringCount > 0 || expiredCount > 0) && (
        <div className="mb-4 rounded-xl border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 px-4 py-3 text-sm text-yellow-800 dark:text-yellow-300">
          {expiredCount > 0 && <span className="font-medium">{expiredCount} document{expiredCount > 1 ? 's' : ''} expired. </span>}
          {expiringCount > 0 && <span>{expiringCount} expiring within 30 days.</span>}
        </div>
      )}

      <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-700">
        {TABS.map((label) => (
          <button
            key={label}
            onClick={() => setTab(label)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === label ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
          >
            {t(`vault.tab${label}`, label)}
          </button>
        ))}
      </div>

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-3 text-sm">{error}</div>
      )}

      {!loading && !error && documents.length === 0 && (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <p className="text-4xl mb-3">🔒</p>
          <p className="font-medium">{t('vault.empty', 'No documents yet')}</p>
          <p className="text-sm mt-1">{t('vault.emptyHint', 'Add your passport, transcripts, and other important documents.')}</p>
        </div>
      )}

      {!loading && !error && documents.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {documents.map((doc) => (
            <DocumentCard key={doc._id} doc={doc} onArchive={handleArchive} />
          ))}
        </div>
      )}

      {showModal && <UploadModal onClose={() => setShowModal(false)} onSuccess={handleCreated} />}

      <Modal
        open={!!archiveConfirm}
        onClose={() => setArchiveConfirm(null)}
        title={t('vault.archiveConfirmTitle', 'Archive document?')}
      >
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 break-words">
          {t('vault.archiveConfirmBody', 'This will move "{name}" to your archive.').replace('{name}', archiveConfirm?.name || '')}
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="flex-1 min-h-[44px] rounded-lg border border-gray-300 dark:border-gray-600 py-2 text-sm" onClick={() => setArchiveConfirm(null)}>{t('cancel', 'Cancel')}</button>
          <button type="button" className="flex-1 min-h-[44px] rounded-lg bg-yellow-500 hover:bg-yellow-600 py-2 text-sm font-medium text-white" onClick={confirmArchive}>{t('vault.archiveConfirm', 'Archive')}</button>
        </div>
      </Modal>
    </div>
  );
}
