import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PhoneInput } from '../forms/PhoneInput';
import { storedPhoneFromInput } from '@shared/international/phone.js';

const ROLES = ['recruiter', 'hiring_manager', 'hr', 'referrer', 'other'];

export function ContactsPanel({ contacts = [], onAdd, onRemove, disabled }) {
  const { t } = useTranslation(['applications']);
  const [name, setName] = useState('');
  const [role, setRole] = useState('recruiter');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    const stored = storedPhoneFromInput(phone);
    if (stored.incomplete) {
      setError(t('applications:tracker.contactPhoneInvalid', {
        defaultValue: 'Enter a valid phone number. Letters are not accepted.',
      }));
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onAdd({ name: name.trim(), role, email, phone: stored.e164 });
      setName('');
      setEmail('');
      setPhone('');
      setRole('recruiter');
    } catch (err) {
      setError(err.response?.data?.error || t('applications:tracker.contactError'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {contacts.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('applications:tracker.noContacts')}</p>
      ) : (
        <ul className="space-y-2" role="list">
          {contacts.map((c) => (
            <li key={c._id} className="text-sm border-b border-gray-100 dark:border-gray-700 pb-2">
              <div className="flex justify-between gap-2">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{c.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t(`applications:contactRoles.${c.role}`, { defaultValue: c.role })}
                    {c.email ? ` · ${c.email}` : ''}
                    {c.phone ? ` · ${c.phone}` : ''}
                  </p>
                </div>
                {onRemove ? (
                  <button type="button" onClick={() => onRemove(c._id)} className="text-xs text-red-600 hover:underline">
                    {t('applications:tracker.remove')}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} className="grid sm:grid-cols-2 gap-3 border-t border-gray-100 dark:border-gray-700 pt-4">
        <div>
          <label htmlFor="contact-name" className="block text-sm font-medium mb-1">{t('applications:tracker.contactName')}</label>
          <input id="contact-name" value={name} onChange={(e) => setName(e.target.value)} disabled={disabled || busy}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm min-h-[44px]" required />
        </div>
        <div>
          <label htmlFor="contact-role" className="block text-sm font-medium mb-1">{t('applications:tracker.contactRole')}</label>
          <select id="contact-role" value={role} onChange={(e) => setRole(e.target.value)} disabled={disabled || busy}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm min-h-[44px]">
            {ROLES.map((r) => <option key={r} value={r}>{t(`applications:contactRoles.${r}`)}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="contact-email" className="block text-sm font-medium mb-1">{t('applications:tracker.contactEmail')}</label>
          <input id="contact-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={disabled || busy}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm min-h-[44px]" />
        </div>
        <div>
          <label htmlFor="contact-phone-national" className="block text-sm font-medium mb-1">{t('applications:tracker.contactPhone')}</label>
          <PhoneInput
            id="contact-phone"
            nationalId="contact-phone-national"
            value={phone}
            disabled={disabled || busy}
            onChange={setPhone}
          />
        </div>
        {error ? <p className="sm:col-span-2 text-sm text-red-600" role="alert">{error}</p> : null}
        <div className="sm:col-span-2">
          <button type="submit" disabled={disabled || busy} className="px-3 py-2 rounded-lg border border-primary text-primary dark:text-mint text-sm font-medium min-h-[44px] disabled:opacity-50">
            {t('applications:tracker.addContact')}
          </button>
        </div>
      </form>
    </div>
  );
}
