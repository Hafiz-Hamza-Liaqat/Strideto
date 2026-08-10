import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { newsletterApi } from '../../services/listingsService';
import { useToast } from '../../context/ToastContext';

export function NewsletterSubscribe({ compact = false }) {
  const { t } = useTranslation('forms');
  const [email, setEmail] = useState('');
  const [frequency, setFrequency] = useState('weekly');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const fieldId = useId();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      toast.error(t('newsletter.enterEmail'));
      return;
    }
    setLoading(true);
    try {
      await newsletterApi.subscribe(trimmed, frequency);
      toast.success(t('newsletter.success'));
      setEmail('');
    } catch (err) {
      const msg = err.response?.data?.error || t('newsletter.failed');
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (compact) {
    return (
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 w-full min-w-0 max-w-md">
        <label htmlFor={`${fieldId}-email`} className="sr-only">{t('newsletter.placeholderCompact')}</label>
        <input
          id={`${fieldId}-email`}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('newsletter.placeholderCompact')}
          className="w-full min-h-[44px] min-w-0 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full min-h-[44px] shrink-0 rounded-lg bg-primary hover:bg-primary-hover text-white btn-theme px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {loading ? '…' : t('newsletter.subscribe')}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        {t('newsletter.description')}
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <label htmlFor={`${fieldId}-email`} className="sr-only">{t('newsletter.placeholderFull')}</label>
        <input
          id={`${fieldId}-email`}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('newsletter.placeholderFull')}
          className="flex-1 min-h-[44px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm"
          disabled={loading}
        />
        <label htmlFor={`${fieldId}-frequency`} className="sr-only">{t('newsletter.frequency')}</label>
        <select
          id={`${fieldId}-frequency`}
          value={frequency}
          onChange={(e) => setFrequency(e.target.value)}
          className="min-h-[44px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm w-full sm:w-32"
        >
          <option value="daily">{t('newsletter.daily')}</option>
          <option value="weekly">{t('newsletter.weekly')}</option>
        </select>
        <button
          type="submit"
          disabled={loading}
          className="min-h-[44px] rounded-lg bg-primary hover:bg-primary-hover text-white btn-theme px-4 py-2 text-sm font-medium disabled:opacity-50 shrink-0"
        >
          {loading ? t('newsletter.subscribing') : t('newsletter.subscribe')}
        </button>
      </div>
    </form>
  );
}
