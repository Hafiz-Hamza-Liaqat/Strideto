import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AdminConfirmDialog } from '../../../components/admin/AdminConfirmDialog';
import { ui } from '../../../design-system/surfaceClasses';
import { ROUTES } from '../../../constants';
import { CASE_TASK_CATALOG, CASE_TASK_KEYS } from '@shared/gbs/caseContract.js';
import { gbsProviderApi } from '../../../services/gbsProviderApi';
import { useGbsProvider } from './GbsProviderContext';
import { StatusBadge, card, emptyBox, errorBox, input, label, muted, wrap } from './gbsUi';
import { ProviderRequirementPackPanel } from '../../../components/gbs/ProviderRequirementPackPanel';
import { ProviderFilingAuthorizationPanel } from '../../../components/gbs/ProviderFilingAuthorizationPanel';
import { GbsContextMessages } from '../../../components/gbs/GbsContextMessages';
import {
  caseMilestoneLabel,
  caseStatusLabel,
  caseTemplateLabel,
  formatTimestamp,
  timelineEventLabel,
} from '../../BusinessClient/businessClientFormat';

const TASK_OPTIONS = Object.values(CASE_TASK_KEYS);

export default function GbsCaseDetail() {
  const { caseRef } = useParams();
  const { selected } = useGbsProvider();
  const [item, setItem] = useState(null);
  const [docs, setDocs] = useState(null);
  const [filingAuth, setFilingAuth] = useState(null);
  const [error, setError] = useState('');
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [readyOpen, setReadyOpen] = useState(false);
  const [unableOpen, setUnableOpen] = useState(false);
  const [taskKey, setTaskKey] = useState(TASK_OPTIONS[0]);
  const [taskNote, setTaskNote] = useState('');
  const [unableReason, setUnableReason] = useState('other');
  const [unableNote, setUnableNote] = useState('');

  useEffect(() => {
    if (!selected) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      gbsProviderApi.getCase(selected, caseRef),
      gbsProviderApi.listCaseDocumentRequirements(selected, caseRef).catch(() => ({ data: null })),
      gbsProviderApi.getFilingAuthorization(selected, caseRef).catch(() => ({ data: { item: null } })),
    ])
      .then(([caseRes, docsRes, filingRes]) => {
        if (cancelled) return;
        setItem(caseRes.data.item);
        setDocs(docsRes.data);
        setFilingAuth(filingRes.data?.item || null);
        setMissing(false);
        setError('');
      })
      .catch((err) => {
        if (cancelled) return;
        setItem(null);
        if (err.response?.status === 404) setMissing(true);
        else if (err.response?.status === 403) setError('You do not have permission to view this Case.');
        else setError('Unable to load this Case.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected, caseRef]);

  const run = async (fn) => {
    if (!item || !selected) return;
    setBusy(true);
    setError('');
    try {
      const { data } = await fn();
      setItem(data.item);
      setReadyOpen(false);
      setUnableOpen(false);
    } catch (err) {
      const code = err.response?.data?.error;
      if (err.response?.status === 403) setError('Case writes require the cases.manage duty.');
      else if (code === 'required_tasks_incomplete') setError('Required customer actions must be completed first.');
      else if (code === 'invalid_status_transition') setError('This Case is not in a stage that allows that action.');
      else if (err.response?.status === 409) setError('This Case changed or professional authority is no longer current.');
      else setError('Unable to update this Case.');
    } finally {
      setBusy(false);
    }
  };

  const runFiling = async (fn) => {
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      const { data } = await fn();
      setFilingAuth(data.item);
    } catch (err) {
      const code = err.response?.data?.error;
      if (err.response?.status === 403) setError('Recording an external filing requires the cases.manage duty.');
      else if (code === 'provider_authority_lost') setError('Provider authority is no longer current.');
      else if (err.response?.status === 409) setError('External filing could not be recorded.');
      else setError('Unable to record external filing.');
    } finally {
      setBusy(false);
    }
  };

  if (!selected) return <div className={emptyBox}>Select an authorized provider subject first.</div>;
  if (loading) return <div className={`${card} ${muted}`} aria-busy="true">Loading case…</div>;
  if (missing) {
    return (
      <div className={emptyBox}>
        Case not found.{' '}
        <Link to={ROUTES.AGENT_BUSINESS_SERVICES_CASES} className={ui.link}>Back to cases</Link>
      </div>
    );
  }
  if (error && !item) return <div className={errorBox} role="alert">{error}</div>;
  if (!item) return null;

  const canStart = item.status === 'open';
  const canRequest = item.status === 'in_progress' || item.status === 'awaiting_client';
  const canReady = item.status === 'in_progress' || item.status === 'awaiting_client';
  const canUnable = ['open', 'in_progress', 'awaiting_client', 'ready_for_submission'].includes(item.status);
  const canCompleteGeneric = item.workflowTemplateKey === 'generic_professional_service'
    && ['in_progress', 'awaiting_client', 'ready_for_submission'].includes(item.status);

  return (
    <article className={`${card} space-y-4`}>
      <p className="text-xs uppercase tracking-wide text-primary">Service Case</p>
      <h1 className={`text-xl font-semibold ${wrap}`}>{item.title}</h1>
      <p className={`${muted} break-all`}>Reference {item.publicCaseRef}</p>
      <StatusBadge status={item.status} label={caseStatusLabel(item.status)} />
      <p><span className="font-medium">Stage:</span> {caseMilestoneLabel(item.currentMilestoneKey)}</p>
      <p className={wrap}><span className="font-medium">Customer:</span> {item.customerDisplayName}</p>
      <p className={wrap}><span className="font-medium">Acting for:</span> {item.actingFor || '—'}</p>
      {item.existingBusinessName ? <p className={wrap}>Existing business name: {item.existingBusinessName}</p> : null}
      {item.proposedBusinessName ? <p className={wrap}>Proposed business name: {item.proposedBusinessName}</p> : null}
      <p className={wrap}>{item.capabilityPublicName} · {item.jurisdictionName}</p>
      <p>{caseTemplateLabel(item.workflowTemplateKey)}</p>
      {item.requestPublicRef ? (
        <p>
          <Link to={`${ROUTES.AGENT_BUSINESS_SERVICES_REQUESTS}/${item.requestPublicRef}`} className={ui.link}>
            View service request
          </Link>
        </p>
      ) : null}
      {item.publicQuoteRef ? (
        <p>
          <Link to={`${ROUTES.AGENT_BUSINESS_SERVICES_QUOTES}/${item.publicQuoteRef}`} className={ui.link}>
            View accepted quote
          </Link>
        </p>
      ) : null}
      {item.customerSummary ? (
        <section>
          <h3 className="font-medium">Customer summary</h3>
          <p className="mt-1 whitespace-pre-wrap break-words-safe">{item.customerSummary}</p>
        </section>
      ) : null}

      {item.requirementPack?.attached ? (
        <ProviderRequirementPackPanel
          pack={item.requirementPack}
          recordVersion={item.recordVersion}
          busy={busy}
          error={error}
          onSaveFact={({ factKey, value, expectedVersion }) => run(() => gbsProviderApi.updateRequirementFact(selected, item.publicCaseRef, expectedVersion, { factKey, value }))}
          onAttestCheck={({ checkKey, selectedMethod, expectedVersion }) => run(() => gbsProviderApi.updateRequirementCheck(selected, item.publicCaseRef, expectedVersion, { checkKey, attested: true, selectedMethod }))}
          onAttestRaConsent={({ expectedVersion }) => run(() => gbsProviderApi.attestRaConsent(selected, item.publicCaseRef, expectedVersion))}
        />
      ) : null}

      <div aria-busy={busy ? 'true' : undefined}>
        <ProviderFilingAuthorizationPanel
          auth={filingAuth}
          caseRecordVersion={item.recordVersion}
          busy={busy}
          error={error}
          onAttest={(payload) => runFiling(() => gbsProviderApi.attestExternalFiling(selected, item.publicCaseRef, payload.expectedVersion, payload))}
        />
      </div>

      <section>
        <h3 className="font-medium">Required documents</h3>
        {!docs?.security?.uploadEnabled ? (
          <p className={`mt-2 ${muted}`} role="status">Secure Business document exchange is not available in this private beta.</p>
        ) : <p className={`mt-2 ${muted}`}>{docs.security.providerMessage}</p>}
        {docs?.security?.uploadEnabled && !docs?.canManageDocuments ? (
          <p className={muted}>Case document review requires an explicit case documents duty. Owner or Admin role is not enough.</p>
        ) : null}
        {(docs?.items || []).length === 0 ? (
          <p className={`mt-2 ${muted}`}>No document requirements are attached to this Case.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {(docs.items || []).map((row) => (
              <li key={row.publicRequirementRef} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                <p className="font-medium break-words-safe">{row.label}</p>
                <p className={`${muted} whitespace-pre-wrap break-words-safe`}>{row.description}</p>
                <p>{row.statusLabel}</p>
                <p className={muted}>Scan: {row.scanState} · Review: {row.reviewState}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="font-medium">Customer tasks</h3>
        {(item.customerTasks || []).length === 0 ? (
          <p className={`mt-2 ${muted}`}>No customer actions requested.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {(item.customerTasks || []).map((task) => (
              <li key={task.publicTaskRef} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                <p className="font-medium break-words-safe">{task.title}</p>
                <p className={`${muted} whitespace-pre-wrap break-words-safe`}>{task.description}</p>
                <p>{task.status === 'completed' ? `Completed${task.customerValue ? `: ${task.customerValue}` : ''}` : 'Open'}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="font-medium">Timeline</h3>
        <ol className="mt-2 space-y-2">
          {(item.timelineEvents || []).map((event, index) => (
            <li key={`${event.eventType}-${event.at}-${index}`}>
              <p>{timelineEventLabel(event.eventType)}</p>
              <p className={muted}>{formatTimestamp(event.at)} · {event.actorType}</p>
            </li>
          ))}
        </ol>
      </section>

      {error ? <p className={errorBox} role="alert">{error}</p> : null}

      {canRequest ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => gbsProviderApi.requestCustomerAction(selected, item.publicCaseRef, item.recordVersion, {
              taskKey,
              note: taskNote,
            }));
          }}
        >
          <div>
            <label className={label} htmlFor="gbs-task-key">Request customer action</label>
            <select id="gbs-task-key" className={input} value={taskKey} onChange={(e) => setTaskKey(e.target.value)}>
              {TASK_OPTIONS.map((key) => (
                <option key={key} value={key}>{CASE_TASK_CATALOG[key]?.title || key}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="gbs-task-note">Note (optional)</label>
            <textarea
              id="gbs-task-note"
              className={`${input} min-h-[96px]`}
              maxLength={500}
              value={taskNote}
              onChange={(e) => setTaskNote(e.target.value)}
            />
          </div>
          <button type="submit" className={ui.secondaryBtn} disabled={busy}>Request customer action</button>
        </form>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {canStart ? (
          <button
            type="button"
            className={ui.primaryBtn}
            disabled={busy}
            onClick={() => run(() => gbsProviderApi.startPreparation(selected, item.publicCaseRef, item.recordVersion))}
          >
            Start preparation
          </button>
        ) : null}
        {canReady ? (
          <button type="button" className={ui.primaryBtn} disabled={busy} onClick={() => setReadyOpen(true)}>
            Mark ready for submission
          </button>
        ) : null}
        {canCompleteGeneric ? (
          <button
            type="button"
            className={ui.secondaryBtn}
            disabled={busy}
            onClick={() => run(() => gbsProviderApi.completeGenericService(selected, item.publicCaseRef, item.recordVersion))}
          >
            Mark professional service complete
          </button>
        ) : null}
        {canUnable ? (
          <button type="button" className={ui.secondaryBtn} disabled={busy} onClick={() => setUnableOpen(true)}>
            Unable to proceed
          </button>
        ) : null}
      </div>

      <GbsContextMessages
        contextType="case"
        contextRef={item.publicCaseRef}
        loadMessages={(page, limit) => gbsProviderApi.listMessages(selected, 'case', item.publicCaseRef, page, limit)}
        sendMessage={(text) => gbsProviderApi.sendMessage(selected, 'case', item.publicCaseRef, text)}
      />
      <AdminConfirmDialog
        open={readyOpen}
        title="Mark ready for the next submission step?"
        message="This records that you have finished internal preparation. It does not submit anything to a government authority and does not take payment."
        confirmLabel="Mark ready for submission"
        loading={busy}
        onCancel={() => setReadyOpen(false)}
        onConfirm={() => run(() => gbsProviderApi.markReadyForSubmission(selected, item.publicCaseRef, item.recordVersion))}
      />
      <AdminConfirmDialog
        open={unableOpen}
        title="Mark this Case unable to proceed?"
        message="The customer will see that you closed this Case. No government decision is recorded. No refund is processed because payment is not configured."
        confirmLabel="Unable to proceed"
        danger
        loading={busy}
        onCancel={() => setUnableOpen(false)}
        onConfirm={() => run(() => gbsProviderApi.markUnableToProceed(selected, item.publicCaseRef, item.recordVersion, {
          reasonCode: unableReason,
          note: unableNote,
        }))}
      >
        <label htmlFor="gbs-unable-reason" className="block text-sm font-medium mb-1">Reason</label>
        <select id="gbs-unable-reason" className={`${input} mb-3`} value={unableReason} onChange={(e) => setUnableReason(e.target.value)}>
          <option value="customer_information_unavailable">Customer information unavailable</option>
          <option value="scope_issue">Scope issue</option>
          <option value="authority_lost">Authority lost</option>
          <option value="service_unavailable">Service unavailable</option>
          <option value="other">Other</option>
        </select>
        <label htmlFor="gbs-unable-note" className="block text-sm font-medium mb-1">Note (optional)</label>
        <textarea
          id="gbs-unable-note"
          className={`${input} min-h-[96px] mb-4`}
          maxLength={500}
          value={unableNote}
          onChange={(e) => setUnableNote(e.target.value)}
        />
      </AdminConfirmDialog>
    </article>
  );
}
