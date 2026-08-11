import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { studentInstitutionAdmissionApi } from '../../services/applicationsApi';
import { ROUTES } from '../../constants';

const inputClass = 'mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 px-3 py-2 min-h-[44px]';

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

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Internal Institution application</h1>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">You are sharing only the fields below. This does not grant the Institution Vault or full-profile access.</p>
      {error ? <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p> : null}
      {message ? <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p> : null}
      <form className="mt-6 space-y-3" onSubmit={submit}>
        <label className="block text-sm text-gray-900 dark:text-white">Full name<input required className={inputClass} value={form.displayName} onChange={set('displayName')} /></label>
        <label className="block text-sm text-gray-900 dark:text-white">Email<input required type="email" className={inputClass} value={form.email} onChange={set('email')} /></label>
        <label className="block text-sm text-gray-900 dark:text-white">Nationality<input className={inputClass} value={form.nationality} onChange={set('nationality')} /></label>
        <label className="block text-sm text-gray-900 dark:text-white">Country of residence<input maxLength={2} className={inputClass} value={form.countryOfResidence} onChange={set('countryOfResidence')} /></label>
        <label className="block text-sm text-gray-900 dark:text-white">Phone<input className={inputClass} value={form.phone} onChange={set('phone')} /></label>
        <label className="block text-sm text-gray-900 dark:text-white">Highest qualification<input className={inputClass} value={form.highestQualification} onChange={set('highestQualification')} /></label>
        <label className="block text-sm text-gray-900 dark:text-white">Intake label<input className={inputClass} value={form.intakeCycleLabel} onChange={set('intakeCycleLabel')} /></label>
        <label className="block text-sm text-gray-900 dark:text-white">Note<textarea className={inputClass} value={form.intendedProgramNote} onChange={set('intendedProgramNote')} /></label>
        <label className="flex items-start gap-2 text-sm text-gray-900 dark:text-white">
          <input type="checkbox" checked={form.consentAccepted} onChange={set('consentAccepted')} className="mt-1" />
          I consent to share this application snapshot with the Institution for admissions review.
        </label>
        <button disabled={busy} className="min-h-[44px] rounded-lg bg-primary px-4 py-2 text-white disabled:opacity-60">{busy ? 'Submitting…' : 'Submit application'}</button>
      </form>
      <p className="mt-4 text-sm"><Link className="text-primary underline" to={ROUTES.STUDENT_INSTITUTION_ADMISSIONS}>My Institution applications</Link></p>
    </div>
  );
}
