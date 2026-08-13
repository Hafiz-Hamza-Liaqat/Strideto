import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { studentInstitutionAdmissionApi } from '../../services/applicationsApi';
import { ROUTES } from '../../constants';
import { CountrySelect } from '../../components/forms/CountrySelect.jsx';
import { PhoneInput } from '../../components/forms/PhoneInput.jsx';

const inputClass = 'mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 px-3 py-2 min-h-[44px]';

function SidebarCard({ title, children }) {
  return (
    <aside className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{title}</h2>
      <div className="mt-3 text-sm text-gray-700 dark:text-gray-300 space-y-2">{children}</div>
    </aside>
  );
}

export default function StudentInstitutionApply() {
  const { programId } = useParams();
  const [form, setForm] = useState({
    displayName: '', email: '', nationality: '', countryOfResidence: '', phone: '',
    highestQualification: '', intendedProgramNote: '', intakeCycleLabel: '', consentAccepted: false,
  });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm((c) => ({ ...c, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const submit = async (event) => {
    event.preventDefault(); setError(''); setMessage('');
    if (!form.consentAccepted) { setError('You must consent to share this application snapshot.'); return; }
    if (form.phone && !/^\+[1-9][0-9]{6,14}$/.test(form.phone)) {
      setError('Enter a valid phone number. Letters are not accepted.');
      return;
    }
    setBusy(true);
    try {
      await studentInstitutionAdmissionApi.submit({
        programId,
        intakeCycleLabel: form.intakeCycleLabel,
        consentAccepted: true,
        snapshot: {
          displayName: form.displayName,
          email: form.email,
          nationality: form.nationality,
          countryOfResidence: form.countryOfResidence,
          phone: form.phone,
          highestQualification: form.highestQualification,
          intendedProgramNote: form.intendedProgramNote,
        },
      });
      setMessage('Application submitted. The Institution receives only this consented snapshot — not your Vault, Budget, or Copilot data.');
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to submit application.');
    } finally { setBusy(false); }
  };

  const sidebar = (
    <div className="space-y-4">
      <SidebarCard title="Application summary">
        <p>Institution and program are taken from this official listing.</p>
        <p>Intake: {form.intakeCycleLabel || 'Not specified yet'}</p>
        <p>Application mode: Internal Institution application on Strideto</p>
      </SidebarCard>
      <SidebarCard title="What you share">
        <p>Only the consented snapshot fields on this form.</p>
        <p>This does not grant the Institution full profile or Vault access.</p>
        <p><Link className="text-primary underline" to={ROUTES.PRIVACY_POLICY}>Privacy Policy</Link></p>
      </SidebarCard>
      <SidebarCard title="What happens next">
        <ol className="list-decimal ps-4 space-y-1">
          <li>You submit this snapshot.</li>
          <li>The Institution reviews it.</li>
          <li>The Institution updates status.</li>
          <li>You receive a notification.</li>
        </ol>
      </SidebarCard>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Internal Institution application</h1>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">You are sharing only the fields below. This does not grant the Institution Vault or full-profile access.</p>
      {error ? <p className="mt-3 rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-800 dark:text-red-200" role="alert">{error}</p> : null}
      {message ? <p className="mt-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 p-3 text-sm text-emerald-800">{message}</p> : null}
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <form className="space-y-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 sm:p-6" onSubmit={submit}>
          <label className="block text-sm text-gray-900 dark:text-white">Full name<input required className={inputClass} value={form.displayName} onChange={set('displayName')} /></label>
          <label className="block text-sm text-gray-900 dark:text-white">Email<input required type="email" className={inputClass} value={form.email} onChange={set('email')} /></label>
          <label className="block text-sm text-gray-900 dark:text-white">Nationality<input className={inputClass} value={form.nationality} onChange={set('nationality')} /></label>
          <div className="text-sm text-gray-900 dark:text-white">
            Country of residence
            <div className="mt-1">
              <CountrySelect
                allowAll={false}
                value={form.countryOfResidence}
                onChange={(code) => setForm((c) => ({ ...c, countryOfResidence: code || '' }))}
              />
            </div>
          </div>
          <div className="text-sm text-gray-900 dark:text-white">
            Phone
            <div className="mt-1">
              <PhoneInput
                value={form.phone}
                defaultCountry={form.countryOfResidence || ''}
                onChange={(next) => setForm((c) => ({ ...c, phone: next?.e164 || '' }))}
              />
            </div>
          </div>
          <label className="block text-sm text-gray-900 dark:text-white">Highest qualification<input className={inputClass} value={form.highestQualification} onChange={set('highestQualification')} /></label>
          <label className="block text-sm text-gray-900 dark:text-white">Intake label<input className={inputClass} value={form.intakeCycleLabel} onChange={set('intakeCycleLabel')} /></label>
          <label className="block text-sm text-gray-900 dark:text-white">Note<textarea className={inputClass} value={form.intendedProgramNote} onChange={set('intendedProgramNote')} /></label>
          <label className="flex items-start gap-2 text-sm text-gray-900 dark:text-white">
            <input type="checkbox" checked={form.consentAccepted} onChange={set('consentAccepted')} className="mt-1" />
            I consent to share this application snapshot with the Institution for admissions review.
          </label>
          <button disabled={busy} className="min-h-[44px] rounded-lg bg-primary px-4 py-2 text-white disabled:opacity-60">{busy ? 'Submitting…' : 'Submit application'}</button>
        </form>
        <div className="lg:sticky lg:top-24 h-fit">{sidebar}</div>
      </div>
      <p className="mt-4 text-sm"><Link className="text-primary underline" to={ROUTES.STUDENT_INSTITUTION_ADMISSIONS}>My Institution applications</Link></p>
    </div>
  );
}
