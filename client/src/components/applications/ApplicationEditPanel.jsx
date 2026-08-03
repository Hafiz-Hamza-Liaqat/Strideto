import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

/** Edits only the fields the PATCH /applications/:id contract actually persists. */
export function ApplicationEditPanel({ application, onSave }) {
  const { t } = useTranslation(['applications', 'common']);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(application.title || '');
  const [companyName, setCompanyName] = useState(application.companyName || '');
  const [externalUrl, setExternalUrl] = useState(application.externalUrl || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (editing) return;
    setTitle(application.title || '');
    setCompanyName(application.companyName || '');
    setExternalUrl(application.externalUrl || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [application]);

  function startEdit() {
    setTitle(application.title || '');
    setCompanyName(application.companyName || '');
    setExternalUrl(application.externalUrl || '');
    setError('');
    setEditing(true);
  }

  function cancelEdit() {
    setTitle(application.title || '');
    setCompanyName(application.companyName || '');
    setExternalUrl(application.externalUrl || '');
    setError('');
    setEditing(false);
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onSave({
        title: title.trim(),
        companyName: companyName.trim(),
        externalUrl: externalUrl.trim(),
      });
      setEditing(false);
    } catch (err) {
      setError(err.response?.data?.error || t('applications:tracker.editError', { defaultValue: 'Could not save changes' }));
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={startEdit}
        className="text-sm text-primary dark:text-mint hover:underline min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
      >
        {t('applications:tracker.edit', { defaultValue: 'Edit' })}
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="mt-4 grid sm:grid-cols-2 gap-3"
      aria-label={t('applications:tracker.editTitle', { defaultValue: 'Edit application' })}
    >
      <div className="sm:col-span-2">
        <label htmlFor="app-edit-title" className="block text-sm font-medium mb-1">
          {t('applications:tracker.titleLabel', { defaultValue: 'Title' })}
        </label>
        <input
          id="app-edit-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={busy}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm min-h-[44px]"
        />
      </div>
      <div>
        <label htmlFor="app-edit-company" className="block text-sm font-medium mb-1">
          {t('applications:tracker.companyLabel', { defaultValue: 'Organization' })}
        </label>
        <input
          id="app-edit-company"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          disabled={busy}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm min-h-[44px]"
        />
      </div>
      <div>
        <label htmlFor="app-edit-url" className="block text-sm font-medium mb-1">
          {t('applications:detail.externalUrl')}
        </label>
        <input
          id="app-edit-url"
          type="url"
          value={externalUrl}
          onChange={(e) => setExternalUrl(e.target.value)}
          disabled={busy}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm min-h-[44px]"
        />
      </div>
      {error ? (
        <p className="sm:col-span-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      <div className="sm:col-span-2 flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="px-3 py-2 rounded-lg bg-primary text-white text-sm font-medium min-h-[44px] disabled:opacity-50"
        >
          {busy ? t('common:saving') : t('applications:tracker.saveEdit', { defaultValue: 'Save' })}
        </button>
        <button
          type="button"
          onClick={cancelEdit}
          disabled={busy}
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm min-h-[44px]"
        >
          {t('common:cancel')}
        </button>
      </div>
    </form>
  );
}

export default ApplicationEditPanel;
