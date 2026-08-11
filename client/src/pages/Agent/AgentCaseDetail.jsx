import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { agentApi } from '../../services/agentService';
import MessageThread from '../../components/consultations/MessageThread';

export default function AgentCaseDetail() {
  const { caseId } = useParams();
  const [data, setData] = useState(null);
  const [grants, setGrants] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([agentApi.getCase(caseId), agentApi.getVaultGrants().catch(() => ({ data: { grants: [] } }))])
      .then(([r, g]) => {
        setData(r.data);
        setGrants((g.data.grants || []).filter((row) => String(row.caseRef || '') === String(caseId) || !row.caseRef));
      })
      .catch((e) => setError(e.response?.data?.error || 'Unable to load case.'));
  }, [caseId]);

  if (!data) return <p className="text-sm text-slate-500">{error || 'Loading case…'}</p>;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{data.case.title}</h1>
        <p className="text-sm text-slate-500">{data.case.lifecycle.replaceAll('_', ' ')} · {data.case.currentStage.replaceAll('_', ' ')}</p>
      </header>
      {error && <p className="rounded bg-red-50 p-3 text-red-700" role="alert">{error}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white">Workflow and tasks</h2>
          <p className="mt-2 text-sm">Workflow v{data.case.workflowVersion}: {data.workflow.stages.map((s) => s.replaceAll('_', ' ')).join(' → ')}</p>
          <p className="mt-3 text-sm">{data.tasks.length} task(s), {data.documentRequests.length} document request(s)</p>
        </section>
        <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white">Approvals, notes, Vault</h2>
          <p className="mt-2 text-sm">{data.approvals.filter((a) => a.status === 'pending').length} awaiting Student. You cannot self-approve Student decisions.</p>
          <p className="mt-2 text-sm">Private notes: {(data.notes || []).filter((n) => n.visibility === 'agent_private').length}. Shared notes: {(data.notes || []).filter((n) => n.visibility === 'shared').length}.</p>
          <p className="mt-2 text-xs">Exact Vault grants shown below. Case transfer does not transfer grants. No storage keys.</p>
          {(grants || []).map((g) => (
            <p key={g.grantId} className="mt-1 text-xs">Grant {g.status} · expires {g.expiresAt ? new Date(g.expiresAt).toLocaleDateString() : 'none'} · revoked {String(g.revoked)}</p>
          ))}
        </section>
      </div>
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <h2 className="font-semibold text-gray-900 dark:text-white">Timeline</h2>
        {data.timeline.map((e) => <p key={e._id} className="mt-2 border-l-2 pl-3 text-sm">{e.eventType.replaceAll('_', ' ')} · {new Date(e.createdAt).toLocaleString()}</p>)}
      </section>
      {data.threadId ? (
        <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Contextual messages</h2>
          <MessageThread
            threadId={caseId}
            loadMessages={(id) => agentApi.getCaseMessages(id)}
            sendMessage={(id, payload) => agentApi.sendCaseMessage(id, { text: payload.text })}
          />
        </section>
      ) : null}
    </div>
  );
}
