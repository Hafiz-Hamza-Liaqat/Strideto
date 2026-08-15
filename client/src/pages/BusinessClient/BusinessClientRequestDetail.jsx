import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AdminConfirmDialog } from '../../components/admin/AdminConfirmDialog';
import { ROUTES } from '../../constants';
import { ui } from '../../design-system/surfaceClasses';
import { gbsBuyerApi } from '../../services/gbsBuyerApi';
import {
  actingForLabel,
  formatTimestamp,
  providerKindLabel,
  serviceRequestStatusLabel,
} from './businessClientFormat';

export default function BusinessClientRequestDetail() {
  const { requestRef } = useParams();
  const [item, setItem] = useState(null);
  const [error, setError] = useState('');
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    gbsBuyerApi
      .get(requestRef)
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
          if (err.response?.status !== 404) setError('Unable to load this request.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [requestRef]);

  const cancel = async () => {
    if (!item) return;
    setBusy(true);
    setError('');
    try {
      const { data } = await gbsBuyerApi.cancel(item.publicRequestRef, item.recordVersion);
      setItem(data.item);
      setConfirmOpen(false);
    } catch (err) {
      if (err.response?.data?.error === 'quote_decision_required') {
        setError('An active quote is waiting. Accept or decline the quote instead of cancelling the request.');
      } else if (err.response?.data?.error === 'quote_already_accepted') {
        setError('This request already has an accepted quote and cannot be cancelled.');
      } else if (err.response?.status === 409) setError('This request changed. Refresh and try again.');
      else setError('Unable to cancel this request.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className={`${ui.card} p-6 ${ui.muted}`} aria-busy="true">Loading request…</div>;
  if (missing) {
    return (
      <div className={ui.empty}>
        Request not found.{' '}
        <Link to={`${ROUTES.BUSINESS}/requests`} className={ui.link}>Back to requests</Link>
      </div>
    );
  }
  if (!item) return error ? <div className={ui.error} role="alert">{error}</div> : null;

  const canCancel = item.status === 'submitted' || item.status === 'provider_reviewing' || item.status === 'ready_for_quote';

  return (
    <article className={`${ui.card} p-6 space-y-4 min-w-0`}>
      <p className="text-xs uppercase tracking-wide text-primary">Service Request</p>
      <h2 className="text-xl font-semibold break-words-safe">{item.title}</h2>
      <p className={`${ui.muted} break-words-safe`}>Reference {item.publicRequestRef}</p>
      <p><span className="font-medium">Status:</span> {serviceRequestStatusLabel(item.status)}</p>
      <p className="break-words-safe"><span className="font-medium">Provider:</span> {item.providerDisplayName} ({providerKindLabel(item.providerKind)})</p>
      <p className="break-words-safe"><span className="font-medium">Capability:</span> {item.capabilityPublicName}</p>
      <p className="break-words-safe"><span className="font-medium">Jurisdiction:</span> {item.jurisdictionName}</p>
      <p><span className="font-medium">Acting for:</span> {actingForLabel(item.actingFor)}</p>
      {item.existingBusinessName ? (
        <p className="break-words-safe"><span className="font-medium">Existing business:</span> {item.existingBusinessName}</p>
      ) : null}
      <div>
        <h3 className="font-medium">Submitted summary</h3>
        <p className="mt-1 whitespace-pre-wrap break-words-safe">{item.customerSummary}</p>
      </div>
      {item.declineNote ? (
        <div>
          <h3 className="font-medium">Provider note</h3>
          <p className="mt-1 whitespace-pre-wrap break-words-safe">{item.declineNote}</p>
        </div>
      ) : null}
      {item.providerTransitionNote && item.status !== 'declined' ? (
        <div>
          <h3 className="font-medium">Provider note</h3>
          <p className="mt-1 whitespace-pre-wrap break-words-safe">{item.providerTransitionNote}</p>
        </div>
      ) : null}
      <ul className={`${ui.muted} space-y-1`}>
        <li>Submitted: {formatTimestamp(item.createdAt)}</li>
        {item.providerReviewingAt ? <li>Provider reviewing: {formatTimestamp(item.providerReviewingAt)}</li> : null}
        {item.providerDecisionAt ? <li>Decision / handoff: {formatTimestamp(item.providerDecisionAt)}</li> : null}
        {item.requesterCancelledAt ? <li>Cancelled: {formatTimestamp(item.requesterCancelledAt)}</li> : null}
      </ul>
      {error ? <p className={ui.error} role="alert">{error}</p> : null}
      <p>
        <Link to={`${ROUTES.BUSINESS}/quotes`} className={ui.link}>View quotes</Link>
      </p>
      {canCancel ? (
        <button type="button" className={ui.secondaryBtn} onClick={() => setConfirmOpen(true)}>
          Cancel request
        </button>
      ) : null}
      <AdminConfirmDialog
        open={confirmOpen}
        title="Cancel this request?"
        message="This cannot be undone. If a quote has already been sent, cancel the quote decision instead."
        confirmLabel="Cancel request"
        danger
        loading={busy}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={cancel}
      />
    </article>
  );
}
