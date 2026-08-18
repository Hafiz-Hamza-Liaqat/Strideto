import { useState } from 'react';
import { AdminSelectBare } from '../../components/admin/AdminFormFields';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../context/ToastContext';
import { AdminRouteGuard } from '../../components/admin/AdminRouteGuard';
import { AdminDataTable } from '../../components/admin/AdminDataTable';
import { PERMISSIONS } from '../../config/rbac';
import { useAdminList } from '../../hooks/useAdminList';
import { adminContentApi } from '../../services/adminContentApi';
import { EscapeWhen } from '../../a11y/EscapeWhen';

const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const STATUSES = ['open', 'in_progress', 'waiting', 'resolved', 'closed'];

export default function AdminSupport() {
  const { t } = useTranslation(['admin', 'common']);
  const { toast } = useToast();
  const { data, pagination, filters, setFilters, loading, error, setPage, refetch } = useAdminList('/admin/support/tickets');
  const [detail, setDetail] = useState(null);
  const [reply, setReply] = useState('');

  const openDetail = async (id) => {
    const res = await adminContentApi.supportTickets.get(id);
    setDetail(res.data);
    setReply('');
  };

  const sendReply = async () => {
    if (!reply.trim()) return;
    await adminContentApi.supportTickets.reply(detail._id, reply);
    toast.success(t('admin:actionDone'));
    openDetail(detail._id);
    refetch();
  };

  const updateTicket = async (patch) => {
    await adminContentApi.supportTickets.update(detail._id, patch);
    toast.success(t('admin:saved'));
    openDetail(detail._id);
    refetch();
  };

  const columns = [
    { key: 'ticketNumber', label: '#' },
    { key: 'subject', label: t('admin:colSubject') },
    { key: 'priority', label: t('admin:colPriority') },
    { key: 'status', label: t('status'), type: 'status' },
    { key: 'updatedAt', label: t('admin:colUpdated'), type: 'date' },
    {
      key: 'actions', label: t('admin:actions'), render: (row) => (
        <button type="button" className="text-primary text-sm" onClick={() => openDetail(row._id)}>{t('admin:view')}</button>
      ),
    },
  ];

  return (
    <AdminRouteGuard permission={PERMISSIONS.USERS_READ}>
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">{t('admin:supportTickets')}</h1>
        <div className="flex flex-wrap gap-2">
          <AdminSelectBare value={filters.status || ''} onChange={(e) => setFilters({ status: e.target.value || undefined })} className="px-3 py-2 rounded-lg border text-sm">
            <option value="">{t('admin:allStatuses')}</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </AdminSelectBare>
          <AdminSelectBare value={filters.priority || ''} onChange={(e) => setFilters({ priority: e.target.value || undefined })} className="px-3 py-2 rounded-lg border text-sm">
            <option value="">{t('admin:allPriorities')}</option>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </AdminSelectBare>
        </div>
        <AdminDataTable columns={columns} data={data} loading={loading} error={error} pagination={pagination} onPageChange={setPage} />

        {detail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setDetail(null)}>
            <EscapeWhen active onEscape={() => setDetail(null)} />
            <div className="max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-gray-800 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="font-semibold">{detail.ticketNumber}: {detail.subject}</h3>
              <div className="flex flex-wrap gap-2 my-3">
                {STATUSES.map((s) => (
                  <button key={s} type="button" onClick={() => updateTicket({ status: s })} className={`px-2 py-1 text-xs rounded ${detail.status === s ? 'bg-primary text-white' : 'border'}`}>{s}</button>
                ))}
              </div>
              <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
                {(detail.messages || []).map((m) => (
                  <div key={m._id} className={`p-3 rounded-lg text-sm ${m.authorType === 'staff' ? 'bg-primary/10 ml-4' : 'bg-gray-100 dark:bg-gray-700 mr-4'}`}>
                    <p className="text-xs text-gray-500 mb-1">{m.authorName || m.authorType}</p>
                    <p>{m.body}</p>
                  </div>
                ))}
              </div>
              <textarea className="w-full px-3 py-2 rounded-lg border mb-2" rows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply..." />
              <button type="button" onClick={sendReply} className="px-4 py-2 rounded-lg bg-primary text-white text-sm">{t('admin:reply')}</button>
            </div>
          </div>
        )}
      </div>
    </AdminRouteGuard>
  );
}
