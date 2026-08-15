import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AdminConfirmDialog } from '../../components/admin/AdminConfirmDialog';
import { ROUTES } from '../../constants';
import { ui } from '../../design-system/surfaceClasses';
import { formatMoney } from '@shared/international/dateDisplay.js';
import { gbsBuyerApi } from '../../services/gbsBuyerApi';
import { formatTimestamp, providerKindLabel, quoteStatusLabel } from './businessClientFormat';

function officialCopy(line) {
  if (line.listed && line.amountMinor != null && line.currency) {
    return formatMoney({ amountMinor: line.amountMinor, currency: line.currency });
  }
  if (line.amountModel === 'range') return 'Official fee range';
  if (line.amountModel === 'variable') return 'Official fee varies';
  return 'Official fee not listed here';
}

export default function BusinessClientQuoteDetail() {
  const { quoteRef } = useParams();
  const [item, setItem] = useState(null);
  const [error, setError] = useState('');
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [reasonCode, setReasonCode] = useState('other');
  const [declineNote, setDeclineNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    gbsBuyerApi
      .getQuote(quoteRef)
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
          else if (err.response?.status !== 404) setError('Unable to load this quote.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [quoteRef]);

  const run = async (fn) => {
    if (!item) return;
    setBusy(true);
    setError('');
    try {
      const { data } = await fn();
      setItem(data.item);
      setAcceptOpen(false);
      setDeclineOpen(false);
    } catch (err) {
      const code = err.response?.data?.error;
      if (err.response?.status === 404) {
        setMissing(true);
        setItem(null);
      } else if (code === 'quote_expired') setError('This quote has expired.');
      else if (code === 'business_client_required') setError('Your Business Services access is not active.');
      else if (err.response?.status === 409) setError('This quote changed or is no longer available to decide.');
      else setError('Unable to update this quote.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className={`${ui.card} p-6 ${ui.muted}`} aria-busy="true">Loading quote…</div>;
  if (missing) {
    return (
      <div className={ui.empty}>
        Quote not found.{' '}
        <Link to={`${ROUTES.BUSINESS}/quotes`} className={ui.link}>Back to quotes</Link>
      </div>
    );
  }
  if (!item) return error ? <div className={ui.error} role="alert">{error}</div> : null;

  const effective = item.effectiveStatus || item.status;
  const canDecide = item.status === 'sent' && effective !== 'expired';
  const listingSnap = item.listingProfessionalFee;

  return (
    <article className={`${ui.card} p-6 space-y-5 min-w-0`}>
      <p className="text-xs uppercase tracking-wide text-primary">Quote</p>
      <h2 className="text-xl font-semibold break-words-safe">{item.title}</h2>
      <p className={`${ui.muted} break-all`}>Reference {item.publicQuoteRef}</p>
      <p><span className="font-medium">Status:</span> {quoteStatusLabel(effective)}</p>
      <section>
        <h3 className="font-medium">Service / Provider</h3>
        <p className="mt-1 break-words-safe">
          {item.providerDisplayName} ({providerKindLabel(item.providerKind)})
        </p>
        <p className="break-words-safe">{item.capabilityPublicName} · {item.jurisdictionName}</p>
        {item.verificationBadge?.label ? <p className={ui.muted}>{item.verificationBadge.label}</p> : null}
        {item.requestPublicRef ? (
          <p>
            <Link to={`${ROUTES.BUSINESS}/requests/${item.requestPublicRef}`} className={ui.link}>View service request</Link>
          </p>
        ) : null}
      </section>
      {listingSnap && listingSnap.kind && listingSnap.kind !== 'quote_required' ? (
        <p className={ui.muted} role="note">
          Listing advertised professional price: {listingSnap.label}
          {listingSnap.amountMinor != null && listingSnap.currency
            ? ` ${formatMoney({ amountMinor: listingSnap.amountMinor, currency: listingSnap.currency })}`
            : ''}
          {listingSnap.minAmountMinor != null && listingSnap.maxAmountMinor != null && listingSnap.currency
            ? ` ${formatMoney({ amountMinor: listingSnap.minAmountMinor, currency: listingSnap.currency })} – ${formatMoney({ amountMinor: listingSnap.maxAmountMinor, currency: listingSnap.currency })}`
            : ''}
        </p>
      ) : null}
      <section>
        <h3 className="font-medium">Professional Service Fees</h3>
        <ul className="mt-2 space-y-1">
          {(item.professionalFeeLines || []).map((line) => (
            <li key={`${line.label}-${line.amountMinor}`} className="break-words-safe">
              {line.label}: {formatMoney({ amountMinor: line.amountMinor, currency: line.currency })}
            </li>
          ))}
        </ul>
        {item.subtotalProfessionalMinor != null && item.currency ? (
          <p className="mt-2 font-medium">
            Professional subtotal: {formatMoney({ amountMinor: item.subtotalProfessionalMinor, currency: item.currency })}
          </p>
        ) : null}
      </section>
      <section>
        <h3 className="font-medium">Official / Government Fees</h3>
        {(item.officialFeeLines || []).length === 0 ? (
          <p className={`mt-2 ${ui.muted}`}>Official fee not listed here</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {(item.officialFeeLines || []).map((line) => (
              <li key={line.feeId} className="break-words-safe">
                {line.label}: {officialCopy(line)}
              </li>
            ))}
          </ul>
        )}
      </section>
      {item.totalCustomerAmountMinor != null && item.currency ? (
        <p className="font-semibold">
          Combined total ({item.currency}): {formatMoney({ amountMinor: item.totalCustomerAmountMinor, currency: item.currency })}
        </p>
      ) : (
        <p className={ui.muted}>Currencies are shown separately. Amounts in different currencies are not added together.</p>
      )}
      {(item.includedItems || []).length ? (
        <section>
          <h3 className="font-medium">Included</h3>
          <ul className="mt-1 list-disc pl-5">
            {item.includedItems.map((row) => <li key={row} className="break-words-safe">{row}</li>)}
          </ul>
        </section>
      ) : null}
      {(item.excludedItems || []).length ? (
        <section>
          <h3 className="font-medium">Excluded</h3>
          <ul className="mt-1 list-disc pl-5">
            {item.excludedItems.map((row) => <li key={row} className="break-words-safe">{row}</li>)}
          </ul>
        </section>
      ) : null}
      {item.providerTerms ? (
        <section>
          <h3 className="font-medium">Provider terms</h3>
          <p className="mt-1 whitespace-pre-wrap break-words-safe">{item.providerTerms}</p>
        </section>
      ) : null}
      {item.providerTurnaroundEstimate ? (
        <p className={ui.muted}>
          Estimated turnaround: {item.providerTurnaroundEstimate}
          {item.turnaroundIsProviderEstimate ? ' (Provider estimate, not a government SLA)' : ''}
        </p>
      ) : null}
      {item.recurringService ? (
        <p className={ui.muted}>This listing is recurring. Accepting does not start automated billing.</p>
      ) : null}
      <ul className={`${ui.muted} space-y-1`}>
        {item.sentAt ? <li>Sent: {formatTimestamp(item.sentAt)}</li> : null}
        {item.expiresAt ? <li>Expires: {formatTimestamp(item.expiresAt)}</li> : null}
      </ul>
      {error ? <p className={ui.error} role="alert">{error}</p> : null}
      {item.status === 'accepted' && item.publicCaseRef ? (
        <p>
          <Link to={`${ROUTES.BUSINESS}/cases/${item.publicCaseRef}`} className={ui.link}>View service Case</Link>
        </p>
      ) : null}
      {canDecide ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={ui.primaryBtn} onClick={() => setAcceptOpen(true)}>Accept quote</button>
          <button type="button" className={ui.secondaryBtn} onClick={() => setDeclineOpen(true)}>Decline quote</button>
        </div>
      ) : null}
      <AdminConfirmDialog
        open={acceptOpen}
        title="Accept this quote?"
        message="Accepting this quote starts a STRIDETO service Case for operational tracking. It does not take payment, submit anything to a government authority, or guarantee government approval."
        confirmLabel="Accept quote"
        loading={busy}
        onCancel={() => setAcceptOpen(false)}
        onConfirm={() => run(() => gbsBuyerApi.acceptQuote(item.publicQuoteRef, item.recordVersion))}
      />
      <AdminConfirmDialog
        open={declineOpen}
        title="Decline this quote?"
        message="The provider will see that you declined. No payment is involved."
        confirmLabel="Decline quote"
        danger
        loading={busy}
        onCancel={() => setDeclineOpen(false)}
        onConfirm={() =>
          run(() => gbsBuyerApi.declineQuote(item.publicQuoteRef, item.recordVersion, {
            declineReasonCode: reasonCode,
            declineNote,
          }))
        }
      >
        <label htmlFor="quote-decline-reason" className="block text-sm font-medium mb-1">Reason</label>
        <select id="quote-decline-reason" className={`${ui.input} mb-3`} value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}>
          <option value="price">Price</option>
          <option value="scope">Scope</option>
          <option value="timing">Timing</option>
          <option value="other">Other</option>
        </select>
        <label htmlFor="quote-decline-note" className="block text-sm font-medium mb-1">Note (optional)</label>
        <textarea
          id="quote-decline-note"
          className={`${ui.input} min-h-[96px] mb-4`}
          maxLength={500}
          value={declineNote}
          onChange={(e) => setDeclineNote(e.target.value)}
        />
      </AdminConfirmDialog>
    </article>
  );
}
