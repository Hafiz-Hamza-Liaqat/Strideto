import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminSelectBare, adminFieldClass } from '../../components/admin/AdminFormFields';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { JOB_FAMILIES } from '../../constants/listings';
import { AdminRouteGuard } from '../../components/admin/AdminRouteGuard';
import { PERMISSIONS } from '../../config/rbac';
import { LocationCascadeFilter } from '../../components/forms/LocationCascadeFilter';
import { adminContentApi } from '../../services/adminContentApi';
import { ROUTES } from '../../constants';

const CHANNELS = [
  { id: 'in_app', label: 'In-app', status: 'available' },
  { id: 'email', label: 'Email', status: 'not_configured' },
  { id: 'telegram', label: 'Telegram', status: 'not_configured' },
  { id: 'whatsapp', label: 'WhatsApp Business', status: 'not_configured' },
  { id: 'linkedin', label: 'LinkedIn', status: 'future' },
];

const AUDIENCES = [
  { id: 'students', label: 'Student' },
  { id: 'employers', label: 'Employer' },
  { id: 'agents', label: 'Agent' },
  { id: 'institutions', label: 'Institution' },
  { id: 'editors', label: 'Staff' },
  { id: 'all', label: 'All' },
];

export default function AlertsAdmin() {
  const { t } = useTranslation(['admin', 'common']);
  const [audience, setAudience] = useState('students');
  const [geo, setGeo] = useState({ countryCode: '', region: '', city: '' });
  const [interest, setInterest] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [ctaLabel, setCtaLabel] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');
  const [channel, setChannel] = useState('in_app');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const selected = CHANNELS.find((c) => c.id === channel) || CHANNELS[0];
  const canSend = selected.status === 'available';

  const handleSaveDraft = async (e) => {
    e.preventDefault();
    if (!canSend) {
      setResult({ error: `${selected.label} is not configured. Alerts are not sent through unavailable channels.` });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const body = {
        title,
        message,
        audience,
        channel: 'in_app',
        status: 'draft',
        link: ctaUrl || undefined,
      };
      const res = await adminContentApi.createNotification(body);
      setResult({ ok: true, mode: 'draft', id: res.data?._id || res.data?.id, note: 'Draft saved as an in-app broadcast notification. Email, Telegram, WhatsApp, and LinkedIn remain not configured.' });
    } catch (err) {
      setResult({ error: err.response?.data?.error || err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!canSend) {
      setResult({ error: `${selected.label} is not configured.` });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const body = {
        title,
        message: ctaLabel ? `${message}\n\n${ctaLabel}` : message,
        audience,
        channel: 'in_app',
        status: 'published',
        link: ctaUrl || undefined,
      };
      const res = await adminContentApi.createNotification(body);
      setResult({ ok: true, mode: 'sent', id: res.data?._id || res.data?.id, note: 'Sent through available in-app channel only.' });
    } catch (err) {
      setResult({ error: err.response?.data?.error || err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminRouteGuard permission={PERMISSIONS.NOTIFICATIONS_SEND}>
      <SeoHead title={t('admin:alerts')} description={t('admin:alertsSeoDesc')} noindex />
      <div className="max-w-2xl">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t('admin:multiChannelAlerts')}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Alerts are multi-channel operational distribution. Announcements, broadcast notifications, and newsletter remain separate. Live email, Telegram, WhatsApp, and LinkedIn are not configured.
        </p>
        <p className="text-sm mb-6">
          <Link className="text-primary underline" to={`${ROUTES.ADMIN}/announcements`}>Announcements</Link>
          {' · '}
          <Link className="text-primary underline" to={`${ROUTES.ADMIN}/notifications`}>Broadcast notifications</Link>
          {' · '}
          <Link className="text-primary underline" to={`${ROUTES.ADMIN}/newsletter`}>Newsletter</Link>
        </p>
        <form className="space-y-4" onSubmit={handleSend}>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Audience</label>
            <AdminSelectBare value={audience} onChange={(e) => setAudience(e.target.value)} className={adminFieldClass}>
              {AUDIENCES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </AdminSelectBare>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Geography</label>
            <LocationCascadeFilter
              className="flex flex-col gap-2"
              countryCode={geo.countryCode}
              region={geo.region}
              city={geo.city}
              onChange={setGeo}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Interest / category</label>
            <AdminSelectBare value={interest} onChange={(e) => setInterest(e.target.value)} className={adminFieldClass}>
              <option value="">{t('common:all')}</option>
              {JOB_FAMILIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </AdminSelectBare>
          </div>
          <fieldset>
            <legend className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Channels</legend>
            <div className="space-y-2">
              {CHANNELS.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200 min-h-[44px]">
                  <input
                    type="radio"
                    name="alert-channel"
                    value={c.id}
                    checked={channel === c.id}
                    onChange={() => setChannel(c.id)}
                  />
                  <span>{c.label}</span>
                  <span className={`text-xs uppercase tracking-wide ${c.status === 'available' ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>
                    {c.status === 'available' ? 'Available' : c.status === 'future' ? 'Future / not configured' : 'Not configured'}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
            <input required value={title} onChange={(e) => setTitle(e.target.value)} className={adminFieldClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Message</label>
            <textarea required rows={5} value={message} onChange={(e) => setMessage(e.target.value)} className={adminFieldClass} />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">CTA label</label>
              <input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} className={adminFieldClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">CTA URL</label>
              <input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} className={adminFieldClass} />
            </div>
          </div>
          <p className="text-xs text-gray-500">Recipient preview is limited to in-app drafts. Geography is stored with the alert intent and is not a live Telegram/WhatsApp send.</p>
          {result?.error ? <p className="text-sm text-red-700 dark:text-red-300" role="alert">{result.error}</p> : null}
          {result?.ok ? <p className="text-sm text-emerald-700 dark:text-emerald-300">{result.note}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={handleSaveDraft} disabled={loading || !canSend} className="min-h-[44px] px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-100 disabled:opacity-50">Save draft</button>
            <button type="submit" disabled={loading || !canSend} className="min-h-[44px] px-4 py-2 rounded-lg bg-primary text-white disabled:opacity-50">
              {canSend ? 'Send through available channels' : `${selected.label} not configured`}
            </button>
          </div>
        </form>
      </div>
    </AdminRouteGuard>
  );
}
