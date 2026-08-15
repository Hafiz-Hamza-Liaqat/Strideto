import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AdminConfirmDialog } from '../../components/admin/AdminConfirmDialog';
import { ROUTES } from '../../constants';
import { ui } from '../../design-system/surfaceClasses';
import { gbsBuyerApi } from '../../services/gbsBuyerApi';
import {
  actingForLabel,
  caseMilestoneLabel,
  caseStatusLabel,
  caseTemplateLabel,
  formatTimestamp,
  providerKindLabel,
  timelineEventLabel,
} from './businessClientFormat';

function TaskForm({ task, busy, onComplete }) {
  const [value, setValue] = useState('');
  const [choice, setChoice] = useState(task.choices?.[0] || '');
  const [confirmed, setConfirmed] = useState(false);
  if (task.status === 'completed') {
    return (
      <p className={ui.muted}>
        Completed{task.customerValue ? `: ${task.customerValue}` : ''}
      </p>
    );
  }
  if (task.type !== 'customer_action') return null;
  return (
    <form
      className="mt-2 space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        const payload = {};
        if (task.customerInputType === 'short_text') payload.value = value;
        if (task.customerInputType === 'choice') payload.choice = choice;
        if (task.customerInputType === 'confirmation') payload.confirmed = confirmed;
        onComplete(task, payload);
      }}
    >
      {task.customerInputType === 'short_text' ? (
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor={`task-${task.publicTaskRef}`}>
            {task.title}
          </label>
          <input
            id={`task-${task.publicTaskRef}`}
            className={ui.input}
            maxLength={160}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
      ) : null}
      {task.customerInputType === 'choice' ? (
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor={`task-choice-${task.publicTaskRef}`}>
            {task.title}
          </label>
          <select
            id={`task-choice-${task.publicTaskRef}`}
            className={ui.input}
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
          >
            {(task.choices || []).map((option) => (
              <option key={option} value={option}>{option.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
      ) : null}
      {task.customerInputType === 'confirmation' ? (
        <label className="flex items-start gap-2" htmlFor={`task-confirm-${task.publicTaskRef}`}>
          <input
            id={`task-confirm-${task.publicTaskRef}`}
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          <span>I confirm this requested action.</span>
        </label>
      ) : null}
      <button type="submit" className={ui.primaryBtn} disabled={busy}>Complete action</button>
    </form>
  );
}

export default function BusinessClientCaseDetail() {
  const { caseRef } = useParams();
  const [item, setItem] = useState(null);
  const [error, setError] = useState('');
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reasonCode, setReasonCode] = useState('other');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    gbsBuyerApi
      .getCase(caseRef)
      .then(({ data }) => {
        if (!cancelled) {
          setItem(data.item);
          setMissing(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setItem(null);
          setMissing(err.response?.status === 404);
          if (err.response?.status === 403) setError('Your Business Services access is not active.');
          else if (err.response?.status !== 404) setError('Unable to load this Case.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [caseRef]);

  const run = async (fn) => {
    if (!item) return;
    setBusy(true);
    setError('');
    try {
      const { data } = await fn();
      setItem(data.item);
      setCancelOpen(false);
    } catch (err) {
      const code = err.response?.data?.error;
      if (err.response?.status === 404) {
        setMissing(true);
        setItem(null);
      } else if (code === 'business_client_required') setError('Your Business Services access is not active. You can still read this Case history.');
      else if (err.response?.status === 409) setError('This Case changed or is no longer available to update.');
      else setError('Unable to update this Case.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className={`${ui.card} p-6 ${ui.muted}`} aria-busy="true">Loading case…</div>;
  if (missing) {
    return (
      <div className={ui.empty}>
        Case not found.{' '}
        <Link to={`${ROUTES.BUSINESS}/cases`} className={ui.link}>Back to cases</Link>
      </div>
    );
  }
  if (!item) return error ? <div className={ui.error} role="alert">{error}</div> : null;

  const canCancel = ['open', 'in_progress', 'awaiting_client', 'ready_for_submission'].includes(item.status);
  const openTasks = (item.customerTasks || []).filter((task) => task.type === 'customer_action' && task.status !== 'completed');

  return (
    <article className={`${ui.card} p-6 space-y-5 min-w-0`}>
      <p className="text-xs uppercase tracking-wide text-primary">Service Case</p>
      <h2 className="text-xl font-semibold break-words-safe">{item.title}</h2>
      <p className={`${ui.muted} break-all`}>Reference {item.publicCaseRef}</p>
      <p><span className="font-medium">Status:</span> {caseStatusLabel(item.status)}</p>
      <p><span className="font-medium">Stage:</span> {caseMilestoneLabel(item.currentMilestoneKey)}</p>
      {item.status === 'in_progress' ? (
        <p className={ui.muted}>The provider is preparing your Case. This is not government processing.</p>
      ) : null}
      {item.status === 'ready_for_submission' ? (
        <p className={ui.muted}>{item.readyForSubmissionCopy}</p>
      ) : null}
      <section>
        <h3 className="font-medium">Service / Provider</h3>
        <p className="mt-1 break-words-safe">
          {item.providerDisplayName} ({providerKindLabel(item.providerKind)})
        </p>
        <p className="break-words-safe">{item.capabilityPublicName} · {item.jurisdictionName}</p>
        <p>{caseTemplateLabel(item.workflowTemplateKey)}</p>
        {item.entityTypeId ? <p className={ui.muted}>Entity type: {item.entityTypeId}</p> : null}
        {item.actingFor ? <p className={ui.muted}>Acting for: {actingForLabel(item.actingFor)}</p> : null}
        {item.existingBusinessName ? <p className="break-words-safe">Existing business name: {item.existingBusinessName}</p> : null}
        {item.proposedBusinessName ? <p className="break-words-safe">Proposed business name: {item.proposedBusinessName}</p> : null}
        {item.publicQuoteRef ? (
          <p>
            <Link to={`${ROUTES.BUSINESS}/quotes/${item.publicQuoteRef}`} className={ui.link}>View accepted quote</Link>
          </p>
        ) : null}
      </section>
      <section>
        <h3 className="font-medium">Customer actions</h3>
        {(item.customerTasks || []).length === 0 ? (
          <p className={`mt-2 ${ui.muted}`}>No customer actions requested yet.</p>
        ) : (
          <ul className="mt-2 space-y-3">
            {(item.customerTasks || []).map((task) => (
              <li key={task.publicTaskRef} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                <p className="font-medium break-words-safe">{task.title}</p>
                <p className={`${ui.muted} whitespace-pre-wrap break-words-safe`}>{task.description}</p>
                <p className={ui.muted}>{task.status === 'completed' ? 'Completed' : 'Open'}</p>
                <TaskForm
                  task={task}
                  busy={busy}
                  onComplete={(row, payload) => run(() => gbsBuyerApi.completeCaseTask(item.publicCaseRef, row.publicTaskRef, item.recordVersion, payload))}
                />
              </li>
            ))}
          </ul>
        )}
        {item.status === 'awaiting_client' && openTasks.length === 0 ? (
          <p className={`mt-2 ${ui.muted}`}>The provider requested an action. Complete any open items above.</p>
        ) : null}
      </section>
      <section>
        <h3 className="font-medium">Timeline</h3>
        <ol className="mt-2 space-y-2">
          {(item.timelineEvents || []).map((event, index) => (
            <li key={`${event.eventType}-${event.at}-${index}`}>
              <p>{timelineEventLabel(event.eventType)}</p>
              <p className={ui.muted}>{formatTimestamp(event.at)} · {event.actorType}</p>
            </li>
          ))}
        </ol>
      </section>
      <ul className={`${ui.muted} space-y-1`}>
        <li>Opened: {formatTimestamp(item.openedAt)}</li>
        <li>Updated: {formatTimestamp(item.updatedAt)}</li>
      </ul>
      {error ? <p className={ui.error} role="alert">{error}</p> : null}
      {canCancel ? (
        <button type="button" className={ui.secondaryBtn} onClick={() => setCancelOpen(true)}>Cancel Case</button>
      ) : null}
      <AdminConfirmDialog
        open={cancelOpen}
        title="Cancel this Case?"
        message="Cancelling stops pre-submission tracking. The accepted quote remains a historical record. No refund is processed because payment is not configured. Nothing was submitted to a government authority."
        confirmLabel="Cancel Case"
        danger
        loading={busy}
        onCancel={() => setCancelOpen(false)}
        onConfirm={() => run(() => gbsBuyerApi.cancelCase(item.publicCaseRef, item.recordVersion, { reasonCode, note }))}
      >
        <label htmlFor="case-cancel-reason" className="block text-sm font-medium mb-1">Reason</label>
        <select id="case-cancel-reason" className={`${ui.input} mb-3`} value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}>
          <option value="changed_mind">Changed mind</option>
          <option value="no_longer_needed">No longer needed</option>
          <option value="other">Other</option>
        </select>
        <label htmlFor="case-cancel-note" className="block text-sm font-medium mb-1">Note (optional)</label>
        <textarea
          id="case-cancel-note"
          className={`${ui.input} min-h-[96px] mb-4`}
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </AdminConfirmDialog>
    </article>
  );
}
