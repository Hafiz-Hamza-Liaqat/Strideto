import { useEffect, useState } from 'react';
import { studentInstitutionAdmissionApi } from '../../services/applicationsApi';

export default function StudentInstitutionAdmissions() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [response, setResponse] = useState('');

  const load = () => studentInstitutionAdmissionApi.list()
    .then(({ data }) => setItems(data.applications || []))
    .catch((err) => setError(err.response?.data?.error || 'Unable to load applications.'));

  useEffect(() => { load(); }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-4">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Institution applications</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400">Authoritative status is set by the Institution. You cannot self-admit.</p>
      {error ? <p className="text-sm text-red-700" role="alert">{error}</p> : null}
      {!items.length ? <p className="text-sm text-gray-600">No internal Institution applications.</p> : items.map((app) => (
        <section key={app._id} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <p className="font-semibold text-gray-900 dark:text-white">Status: {app.status}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">{app.intakeCycleLabel || 'Intake not specified'}</p>
          {app.status === 'needs_information' ? (
            <form className="mt-3" onSubmit={(e) => { e.preventDefault(); studentInstitutionAdmissionApi.respond(app._id, response).then(load); }}>
              <textarea className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 p-2" value={response} onChange={(e) => setResponse(e.target.value)} required />
              <button className="mt-2 min-h-[44px] rounded-lg bg-primary px-3 text-white">Send response</button>
            </form>
          ) : null}
          {['received', 'under_review', 'needs_information', 'shortlisted', 'interview', 'offer'].includes(app.status) ? (
            <button className="mt-2 text-sm text-red-700 underline" type="button" onClick={() => studentInstitutionAdmissionApi.withdraw(app._id).then(load)}>Withdraw</button>
          ) : null}
        </section>
      ))}
    </div>
  );
}
