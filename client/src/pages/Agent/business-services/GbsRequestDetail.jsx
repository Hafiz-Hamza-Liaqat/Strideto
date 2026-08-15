import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AdminConfirmDialog } from '../../../components/admin/AdminConfirmDialog';
import { ui } from '../../../design-system/surfaceClasses';
import { ROUTES } from '../../../constants';
import { gbsProviderApi } from '../../../services/gbsProviderApi';
import { useGbsProvider } from './GbsProviderContext';
import { StatusBadge, card, emptyBox, errorBox, muted, wrap } from './gbsUi';
import { actingForLabel, formatTimestamp, serviceRequestStatusLabel } from '../../BusinessClient/businessClientFormat';
import { GBS_SERVICE_REQUEST_DECLINE_REASON_CODES } from '@shared/gbs/constants.js';

export default function GbsRequestDetail() {
  const { requestRef } = useParams();
  const { selected } = useGbsProvider();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [error, setError] = useState('');
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [reasonCode, setReasonCode] = useState(GBS_SERVICE_REQUEST_DECLINE_REASON_CODES.OUT_OF_SCOPE);
  const [declineNote, setDeclineNote] = useState('');

  useEffect(() => {
    if (!selected) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    gbsProviderApi
      .getRequest(selected, requestRef)
      .then(({ data }) => {
        if (cancelled) return;
        setItem(data.item);
        setMissing(false);
        setError('');
      })
      .catch((err) => {
        if (cancelled) return;
        setItem(null);
        if (err.response?.status === 404) setMissing(true);
        else if (err.response?.status === 403) setError('You do not have permission to view this request.');
        else setError('Unable to load this request.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected, requestRef]);

  const runAction = async (fn) => {
    if (!item || !selected) return;
    setBusy(true);
    setError('');
    try {
      const { data } = await fn();
      setItem(data.item);
      setDeclineOpen(false);
    } catch (err) {
      if (err.response?.status === 409) setError('This request changed. Refresh and try again.');
      else if (err.response?.status === 403) setError('This action is not available.');
      else setError('Unable to update this request.');
    } finally {
      setBusy(false);
    }
  };

  if (!selected) return <div className={emptyBox}>Select an authorized provider subject first.</div>;
  if (loading) return <div className={`${card} ${muted}`} aria-busy="true">Loading request…</div>;
  if (missing) {
    return (
      <div className={emptyBox}>
        Request not found.{' '}
        <Link to={ROUTES.AGENT_BUSINESS_SERVICES_REQUESTS} className={ui.link}>Back to inbox</Link>
      </div>
    );
  }
  if (error && !item) return <div className={errorBox} role="alert">{error}</div>;
  if (!item) return null;

  const actions = item.actions || {};

  const createQuote = async () => {
    if (!item || !selected) return;
    setCreateBusy(true);
    setError('');
    try {
      const commandId = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `quote-${Date.now()}`;
      const { data } = await gbsProviderApi.createQuote(selected, item.publicRequestRef, commandId);
      navigate(`${ROUTES.AGENT_BUSINESS_SERVICES_QUOTES}/${data.item.publicQuoteRef}`);
    } catch (err) {
      if (err.response?.status === 403) setError('Quote writes require the quotes.manage duty.');
      else if (err.response?.status === 409) setError('A quote already exists or this request cannot accept a new quote.');
      else setError('Unable to create a quote.');
    } finally {
      setCreateBusy(false);
    }
  };

  return (
    <article className={`${card} space-y-4`}>
      <p className="text-xs uppercase tracking-wide text-primary">Service Request</p>
      <h2 className={`text-xl font-semibold ${wrap}`}>{item.title}</h2>
      <p className={`${muted} break-all`}>Reference {item.publicRequestRef}</p>
      <StatusBadge status={item.status} label={serviceRequestStatusLabel(item.status)} />
      <p className={wrap}><span className="font-medium">Customer:</span> {item.customerDisplayName}</p>
      <p><span className="font-medium">Acting for:</span> {actingForLabel(item.actingFor)}</p>
      {item.existingBusinessName ? <p className={wrap}><span className="font-medium">Existing business:</span> {item.existingBusinessName}</p> : null}
      {item.preferredLanguage ? <p><span className="font-medium">Preferred language:</span> {item.preferredLanguage}</p> : null}
      <p className={wrap}><span className="font-medium">Capability:</span> {item.capabilityPublicName}</p>
      <p className={wrap}><span className="font-medium">Jurisdiction:</span> {item.jurisdictionName} ({item.countryCode})</p>
      <div>
        <h3 className="font-medium">Customer requirements</h3>
        <p className="mt-1 whitespace-pre-wrap break-words-safe">{item.customerSummary}</p>
      </div>
      <ul className={`${muted} space-y-1`}>
        <li>Submitted: {formatTimestamp(item.createdAt)}</li>
        {item.providerReviewingAt ? <li>Reviewing: {formatTimestamp(item.providerReviewingAt)}</li> : null}
        {item.providerDecisionAt ? <li>Decision: {formatTimestamp(item.providerDecisionAt)}</li> : null}
        {item.requesterCancelledAt ? <li>Customer cancelled: {formatTimestamp(item.requesterCancelledAt)}</li> : null}
      </ul>
      {error ? <p className={errorBox} role="alert">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        {actions.review ? (
          <button
            type="button"
            className={ui.secondaryBtn}
            disabled={busy}
            onClick={() => runAction(() => gbsProviderApi.reviewRequest(selected, item.publicRequestRef, item.recordVersion))}
          >
            Mark Reviewing
          </button>
        ) : null}
        {actions.readyForQuote ? (
          <button
            type="button"
            className={ui.primaryBtn}
            disabled={busy}
            onClick={() => runAction(() => gbsProviderApi.readyForQuote(selected, item.publicRequestRef, item.recordVersion))}
          >
            Ready for Quote
          </button>
        ) : null}
        {item.status === 'ready_for_quote' ? (
          <button type="button" className={ui.primaryBtn} disabled={createBusy} onClick={createQuote}>
            Create Quote
          </button>
        ) : null}
        {actions.decline ? (
          <button type="button" className={ui.secondaryBtn} disabled={busy} onClick={() => setDeclineOpen(true)}>
            Decline
          </button>
        ) : null}
      </div>
      <AdminConfirmDialog
        open={declineOpen}
        title="Decline this request?"
        message="The customer will see the reason and optional note. No quote is created."
        confirmLabel="Decline request"
        danger
        loading={busy}
        onCancel={() => setDeclineOpen(false)}
        onConfirm={() =>
          runAction(() =>
            gbsProviderApi.declineRequest(selected, item.publicRequestRef, item.recordVersion, {
              declineReasonCode: reasonCode,
              declineNote,
            })
          )
        }
      >
        <label htmlFor="decline-reason" className="block text-sm font-medium mb-1">Reason</label>
        <select
          id="decline-reason"
          className={`${ui.input} mb-3`}
          value={reasonCode}
          onChange={(e) => setReasonCode(e.target.value)}
        >
          <option value="capacity">Capacity</option>
          <option value="out_of_scope">Out of scope</option>
          <option value="jurisdiction_mismatch">Jurisdiction mismatch</option>
          <option value="unable_to_serve">Unable to serve</option>
          <option value="other">Other</option>
        </select>
        <label htmlFor="decline-note" className="block text-sm font-medium mb-1">Note (optional)</label>
        <textarea
          id="decline-note"
          className={`${ui.input} min-h-[96px] mb-4`}
          maxLength={500}
          value={declineNote}
          onChange={(e) => setDeclineNote(e.target.value)}
        />
      </AdminConfirmDialog>
    </article>
  );
}
