import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { breadcrumbSchema, combineSchemas, contactPageSchema } from '../../seo/schemas';
import { ROUTES } from '../../constants';
import { contactApi } from '../../services/listingsService';
import { Alert } from '../../components/ui/Alerts';
import { OFFICIAL_LINKEDIN_COMPANY_URL } from '@shared/social/officialSocialLinks.js';

export default function Contact() {
  const { t } = useTranslation(['static', 'seo', 'common']);
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '', website: '' });
  const [status, setStatus] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setStatus(null);
    setErrors({});
    try {
      await contactApi.submit(form);
      setStatus('success');
      setForm({ name: '', email: '', subject: '', message: '', website: '' });
    } catch (err) {
      const details = err.response?.data?.details;
      if (details) setErrors(details);
      setStatus('error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <SeoHead
        title={t('seo:contactTitle')}
        description={t('seo:contactDescription')}
        canonical={ROUTES.CONTACT}
        jsonLd={combineSchemas(
          breadcrumbSchema([
            { name: t('seo:breadcrumbHome'), url: ROUTES.HOME },
            { name: t('static:breadcrumbContact'), url: ROUTES.CONTACT },
          ]),
          contactPageSchema({ name: t('static:contactHeading'), description: t('seo:contactDescription'), url: ROUTES.CONTACT })
        )}
      />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">{t('static:contactHeading')}</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-4 sm:mb-6 text-sm sm:text-base">{t('static:contactIntro')}</p>
        <p className="mb-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
          Support is handled through this form and help articles. We do not publish a phone hotline or guaranteed response-time SLA.
        </p>

        {status === 'success' && (
          <Alert variant="success" className="mb-6">{t('static:contactSuccess')}</Alert>
        )}
        {status === 'error' && !Object.keys(errors).length && (
          <Alert variant="error" className="mb-6">{t('static:contactError')}</Alert>
        )}

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 space-y-4">
          <input type="text" name="website" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" />
          <div>
            <label htmlFor="contact-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('static:contactFormName')}</label>
            <input id="contact-name" required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white" />
            {errors.name && <p className="text-red-600 text-xs mt-1">{errors.name}</p>}
          </div>
          <div>
            <label htmlFor="contact-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('static:contactFormEmail')}</label>
            <input id="contact-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white" />
            {errors.email && <p className="text-red-600 text-xs mt-1">{errors.email}</p>}
          </div>
          <div>
            <label htmlFor="contact-subject" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('static:contactFormSubject')}</label>
            <input id="contact-subject" required minLength={3} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white" />
            {errors.subject && <p className="text-red-600 text-xs mt-1">{errors.subject}</p>}
          </div>
          <div>
            <label htmlFor="contact-message" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('static:contactFormMessage')}</label>
            <textarea id="contact-message" required minLength={10} rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white" />
            {errors.message && <p className="text-red-600 text-xs mt-1">{errors.message}</p>}
          </div>
          <button type="submit" disabled={submitting} className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-primary text-white font-medium hover:bg-primary-hover disabled:opacity-50">
            {submitting ? t('common:loading') : t('static:contactFormSubmit')}
          </button>
        </form>

        <div className="mt-8 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <p>{t('static:contactFormOnlyNote')}</p>
          <p>
            {t('static:contactSocialPrefix')}{' '}
            <a
              href={OFFICIAL_LINKEDIN_COMPANY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary dark:text-mint hover:underline inline-flex min-h-[44px] items-center"
            >
              {t('footer:linkedinAria', { ns: 'footer', defaultValue: 'Strideto on LinkedIn' })}
            </a>
          </p>
        </div>
        <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
          <Link to={ROUTES.FAQ} className="text-primary dark:text-mint hover:underline">{t('static:checkFaq')}</Link>
          {' · '}
          <Link to={ROUTES.SUPPORT} className="text-primary dark:text-mint hover:underline">{t('static:contactSupportLink')}</Link>
        </p>
      </div>
    </>
  );
}
