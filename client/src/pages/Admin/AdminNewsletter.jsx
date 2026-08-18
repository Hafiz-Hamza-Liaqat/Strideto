import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../context/ToastContext';
import { AdminRouteGuard } from '../../components/admin/AdminRouteGuard';
import { AdminDataTable } from '../../components/admin/AdminDataTable';
import { PERMISSIONS } from '../../config/rbac';
import { useAdminList } from '../../hooks/useAdminList';
import { adminContentApi } from '../../services/adminContentApi';

export default function AdminNewsletter() {
  const { t } = useTranslation(['admin', 'common']);
  const { toast } = useToast();
  const { data, pagination, loading, error, setPage, refetch } = useAdminList('/admin/newsletter/subscribers');
  const [sendForm, setSendForm] = useState({ subject: '', html: '', scheduledAt: '' });
  const [sending, setSending] = useState(false);

  const exportCsv = async () => {
    try {
      const res = await adminContentApi.newsletter.exportCsv();
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'newsletter-subscribers.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t('admin:exportFailed'));
    }
  };

  const send = async () => {
    setSending(true);
    try {
      const res = await adminContentApi.newsletter.send(sendForm);
      toast.success(res.data?.message || t('admin:actionDone'));
      setSendForm({ subject: '', html: '', scheduledAt: '' });
    } catch (err) {
      toast.error(err.response?.data?.error || t('admin:actionFailed'));
    } finally {
      setSending(false);
    }
  };

  const columns = [
    { key: 'email', label: t('admin:colEmail') },
    { key: 'frequency', label: 'Frequency' },
    { key: 'subscribed', label: 'Subscribed', render: (r) => (r.subscribed ? 'Yes' : 'No') },
    {
      key: 'actions', label: t('admin:actions'), render: (row) => (
        <button type="button" className="text-red-600 text-sm" onClick={async () => {
          await adminContentApi.newsletter.deleteSubscriber(row._id);
          toast.success(t('admin:actionDone'));
          refetch();
        }}>{t('common:delete')}</button>
      ),
    },
  ];

  return (
    <AdminRouteGuard permission={PERMISSIONS.NOTIFICATIONS_SEND}>
      <div className="space-y-8">
        <div>
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-xl font-semibold">{t('admin:newsletterSubscribers')}</h1>
            <button type="button" onClick={exportCsv} className="px-3 py-1.5 text-sm rounded-lg border">{t('admin:exportCsv')}</button>
          </div>
          <AdminDataTable columns={columns} data={data} loading={loading} error={error} pagination={pagination} onPageChange={setPage} />
        </div>

        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3">
          <h3 className="font-semibold">{t('admin:sendNewsletter')}</h3>
          <input className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800" placeholder="Subject" value={sendForm.subject} onChange={(e) => setSendForm({ ...sendForm, subject: e.target.value })} />
          <textarea className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800" rows={6} placeholder="HTML body" value={sendForm.html} onChange={(e) => setSendForm({ ...sendForm, html: e.target.value })} />
          <input type="datetime-local" className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800" value={sendForm.scheduledAt} onChange={(e) => setSendForm({ ...sendForm, scheduledAt: e.target.value })} />
          <button type="button" onClick={send} disabled={sending} className="px-4 py-2 rounded-lg bg-primary text-white">{sending ? t('common:loading') : t('admin:send')}</button>
        </div>
      </div>
    </AdminRouteGuard>
  );
}
