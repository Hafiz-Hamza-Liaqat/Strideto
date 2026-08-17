import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AdminConfirmDialog } from '../../../components/admin/AdminConfirmDialog';
import { ui } from '../../../design-system/surfaceClasses';
import { ROUTES } from '../../../constants';
import { formatMoney } from '@shared/international/dateDisplay.js';
import { fromDecimal, toDecimalString } from '@shared/international/money.js';
import { gbsProviderApi } from '../../../services/gbsProviderApi';
import { GbsContextMessages } from '../../../components/gbs/GbsContextMessages';
import { useGbsProvider } from './GbsProviderContext';
import { StatusBadge, card, errorBox, GbsRouteState, input, label, muted, wrap } from './gbsUi';
import { formatTimestamp, quoteStatusLabel } from '../../BusinessClient/businessClientFormat';

function linesFromQuote(item) {
  const rows = item.professionalFeeLines || [];
  if (!rows.length) {
    const snap = item.listingProfessionalFee;
    const currency = snap?.currency || item.currency || 'USD';
    const amount = snap?.amountMinor != null ? toDecimalString({ amountMinor: snap.amountMinor, currency }) : '';
    return [{ label: 'Professional service fee', amountMajor: amount, currency }];
  }
  return rows.map((line) => ({
    label: line.label,
    amountMajor: toDecimalString({ amountMinor: line.amountMinor, currency: line.currency }),
    currency: line.currency,
  }));
}

export default function GbsQuoteDetail() {
  const { quoteRef } = useParams();
  const { selected } = useGbsProvider();
  const [item, setItem] = useState(null);
  const [error, setError] = useState('');
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [lines, setLines] = useState([]);
  const [officialIds, setOfficialIds] = useState([]);
  const [terms, setTerms] = useState('');
  const [validForDays, setValidForDays] = useState(7);

  useEffect(() => {
    if (!selected) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    gbsProviderApi
      .getQuote(selected, quoteRef)
      .then(({ data }) => {
        if (cancelled) return;
        const next = data.item;
        setItem(next);
        setMissing(false);
        setError('');
        setLines(linesFromQuote(next));
        setOfficialIds((next.officialFeeLines || []).map((l) => l.feeId));
        setTerms(next.providerTerms || '');
        setValidForDays(next.validForDays || 7);
      })
      .catch((err) => {
        if (cancelled) return;
        setItem(null);
        if (err.response?.status === 404) setMissing(true);
        else if (err.response?.status === 403) setError('You do not have permission to view this quote.');
        else setError('Unable to load this quote.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected, quoteRef]);

  const advertised = item?.listingProfessionalFee;
  const advertisedHint = useMemo(() => {
    if (!advertised?.kind || advertised.kind === 'quote_required') return 'Quote required — set a professional amount.';
    if (advertised.kind === 'fixed' && advertised.amountMinor != null) {
      return `Fixed listing price must match ${formatMoney({ amountMinor: advertised.amountMinor, currency: advertised.currency })}.`;
    }
    if (advertised.kind === 'starting_at' && advertised.amountMinor != null) {
      return `Starting-at listing: quote must be at least ${formatMoney({ amountMinor: advertised.amountMinor, currency: advertised.currency })}.`;
    }
    if (advertised.kind === 'range' && advertised.minAmountMinor != null) {
      return `Range listing: quote must stay between ${formatMoney({ amountMinor: advertised.minAmountMinor, currency: advertised.currency })} and ${formatMoney({ amountMinor: advertised.maxAmountMinor, currency: advertised.currency })}.`;
    }
    return '';
  }, [advertised]);

  const toPayloadLines = () => {
    return lines.map((line) => {
      const money = fromDecimal(line.amountMajor || '0', line.currency || item?.currency || 'USD');
      return { label: line.label, amountMinor: money.amountMinor, currency: money.currency, ownership: 'provider' };
    });
  };

  const run = async (fn) => {
    if (!item || !selected) return;
    setBusy(true);
    setError('');
    try {
      const { data } = await fn();
      setItem(data.item);
      setWithdrawOpen(false);
    } catch (err) {
      const code = err.response?.data?.error;
      if (err.response?.status === 403) setError('Quote writes require the quotes.manage duty.');
      else if (code === 'fixed_price_mismatch') setError('Professional total must match the advertised fixed listing price.');
      else if (code === 'starting_at_undercut') setError('Professional total cannot be below the advertised starting price.');
      else if (code === 'range_price_outside') setError('Professional total must stay within the advertised range.');
      else if (err.response?.status === 409) setError('This quote changed. Refresh and try again.');
      else setError('Unable to update this quote.');
    } finally {
      setBusy(false);
    }
  };

  if (!selected) return <GbsRouteState title="Quote Details">Select an authorized provider subject first.</GbsRouteState>;
  if (loading) return <GbsRouteState title="Quote Details" busy>Loading quote…</GbsRouteState>;
  if (missing) {
    return (
      <GbsRouteState title="Quote Details">
        Quote not found.{' '}
        <Link to={ROUTES.AGENT_BUSINESS_SERVICES_QUOTES} className={ui.link}>Back to quotes</Link>
      </GbsRouteState>
    );
  }
  if (error && !item) return <GbsRouteState title="Quote Details" error>{error}</GbsRouteState>;
  if (!item) return <GbsRouteState title="Quote Details" error>Quote unavailable.</GbsRouteState>;

  const draft = item.status === 'draft';

  return (
    <article className={`${card} space-y-4`}>
      <p className="text-xs uppercase tracking-wide text-primary">Quote</p>
      <h1 className={`text-xl font-semibold ${wrap}`}>{item.title}</h1>
      <p className={`${muted} break-all`}>Reference {item.publicQuoteRef}</p>
      <StatusBadge status={item.effectiveStatus || item.status} label={quoteStatusLabel(item.effectiveStatus || item.status)} />
      <p className={wrap}><span className="font-medium">Customer:</span> {item.customerDisplayName}</p>
      <p className={wrap}><span className="font-medium">Request:</span>{' '}
        <Link to={`${ROUTES.AGENT_BUSINESS_SERVICES_REQUESTS}/${item.requestPublicRef}`} className={ui.link}>
          {item.requestPublicRef}
        </Link>
      </p>
      <p className={wrap}><span className="font-medium">Jurisdiction:</span> {item.jurisdictionName}</p>
      <p className={muted}>{advertisedHint}</p>

      {draft ? (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => gbsProviderApi.updateQuote(selected, item.publicQuoteRef, {
              expectedVersion: item.recordVersion,
              professionalFeeLines: toPayloadLines(),
              officialFeeIds: officialIds,
              providerTerms: terms,
              validForDays: Number(validForDays),
            }));
          }}
        >
          <fieldset>
            <legend className="font-medium">Professional Service Fees</legend>
            {lines.map((line, index) => (
              <div key={index} className="mt-2 grid gap-2 sm:grid-cols-3">
                <div>
                  <label className={label} htmlFor={`fee-label-${index}`}>Label</label>
                  <input
                    id={`fee-label-${index}`}
                    className={input}
                    value={line.label}
                    onChange={(e) => setLines((cur) => cur.map((row, i) => (i === index ? { ...row, label: e.target.value } : row)))}
                  />
                </div>
                <div>
                  <label className={label} htmlFor={`fee-amount-${index}`}>Amount</label>
                  <input
                    id={`fee-amount-${index}`}
                    className={input}
                    inputMode="decimal"
                    value={line.amountMajor}
                    onChange={(e) => setLines((cur) => cur.map((row, i) => (i === index ? { ...row, amountMajor: e.target.value } : row)))}
                  />
                </div>
                <div>
                  <label className={label} htmlFor={`fee-currency-${index}`}>Currency</label>
                  <input
                    id={`fee-currency-${index}`}
                    className={input}
                    maxLength={3}
                    value={line.currency}
                    onChange={(e) => setLines((cur) => cur.map((row, i) => (i === index ? { ...row, currency: e.target.value.toUpperCase() } : row)))}
                  />
                </div>
              </div>
            ))}
            <button
              type="button"
              className={`${ui.secondaryBtn} mt-2`}
              onClick={() => setLines((cur) => [...cur, { label: '', amountMajor: '', currency: cur[0]?.currency || 'USD' }])}
            >
              Add professional fee line
            </button>
          </fieldset>
          <fieldset>
            <legend className="font-medium">Official / Government Fees</legend>
            {(item.availableOfficialFees || []).length === 0 ? (
              <p className={muted}>No catalogued official fees for this listing.</p>
            ) : (
              (item.availableOfficialFees || []).map((fee) => (
                <label key={fee.feeId} className="mt-2 flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={officialIds.includes(fee.feeId)}
                    onChange={(e) => setOfficialIds((cur) => (
                      e.target.checked ? [...cur, fee.feeId] : cur.filter((id) => id !== fee.feeId)
                    ))}
                  />
                  <span className="break-words-safe">
                    {fee.label}
                    {fee.amount != null ? ` (${fee.currency} ${fee.amount})` : ` (${fee.amountModel})`}
                  </span>
                </label>
              ))
            )}
          </fieldset>
          <div>
            <label className={label} htmlFor="quote-terms">Provider terms</label>
            <textarea id="quote-terms" className={`${input} min-h-[96px]`} maxLength={4000} value={terms} onChange={(e) => setTerms(e.target.value)} />
          </div>
          <div>
            <label className={label} htmlFor="quote-days">Valid for (days)</label>
            <input id="quote-days" className={input} type="number" min={1} max={30} value={validForDays} onChange={(e) => setValidForDays(e.target.value)} />
          </div>
          {error ? <p className={errorBox} role="alert">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button type="submit" className={ui.secondaryBtn} disabled={busy}>Save draft</button>
            <button
              type="button"
              className={ui.primaryBtn}
              disabled={busy}
              onClick={() => run(async () => {
                const saved = await gbsProviderApi.updateQuote(selected, item.publicQuoteRef, {
                  expectedVersion: item.recordVersion,
                  professionalFeeLines: toPayloadLines(),
                  officialFeeIds: officialIds,
                  providerTerms: terms,
                  validForDays: Number(validForDays),
                });
                return gbsProviderApi.sendQuote(selected, item.publicQuoteRef, saved.data.item.recordVersion, {
                  validForDays: Number(validForDays),
                });
              })}
            >
              Send quote
            </button>
            <button type="button" className={ui.secondaryBtn} disabled={busy} onClick={() => setWithdrawOpen(true)}>
              Withdraw draft
            </button>
          </div>
        </form>
      ) : (
        <>
          <section>
            <h3 className="font-medium">Professional Service Fees</h3>
            <ul className="mt-2 space-y-1">
              {(item.professionalFeeLines || []).map((line) => (
                <li key={`${line.label}-${line.amountMinor}`} className="break-words-safe">
                  {line.label}: {formatMoney({ amountMinor: line.amountMinor, currency: line.currency })}
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h3 className="font-medium">Official / Government Fees</h3>
            {(item.officialFeeLines || []).length === 0 ? (
              <p className={muted}>Official fee not listed here</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {(item.officialFeeLines || []).map((line) => (
                  <li key={line.feeId} className="break-words-safe">
                    {line.label}
                    {line.listed && line.amountMinor != null && line.currency
                      ? `: ${formatMoney({ amountMinor: line.amountMinor, currency: line.currency })}`
                      : ''}
                  </li>
                ))}
              </ul>
            )}
          </section>
          {item.providerTerms ? <p className="whitespace-pre-wrap break-words-safe">{item.providerTerms}</p> : null}
          <ul className={`${muted} space-y-1`}>
            {item.sentAt ? <li>Sent: {formatTimestamp(item.sentAt)}</li> : null}
            {item.expiresAt ? <li>Expires: {formatTimestamp(item.expiresAt)}</li> : null}
          </ul>
          {error ? <p className={errorBox} role="alert">{error}</p> : null}
          {item.status === 'sent' ? (
            <button type="button" className={ui.secondaryBtn} disabled={busy} onClick={() => setWithdrawOpen(true)}>
              Withdraw quote
            </button>
          ) : null}
          {item.status === 'accepted' && item.publicCaseRef ? (
            <p>
              <Link to={`${ROUTES.AGENT_BUSINESS_SERVICES_CASES}/${item.publicCaseRef}`} className={ui.link}>
                View service Case
              </Link>
            </p>
          ) : null}
        </>
      )}
      <GbsContextMessages
        contextType="quote"
        contextRef={item.publicQuoteRef}
        loadMessages={(page, limit) => gbsProviderApi.listMessages(selected, 'quote', item.publicQuoteRef, page, limit)}
        sendMessage={(text) => gbsProviderApi.sendMessage(selected, 'quote', item.publicQuoteRef, text)}
      />
      <AdminConfirmDialog
        open={withdrawOpen}
        title="Withdraw this quote?"
        message="The customer will see withdrawn if this quote was already sent. History is kept."
        confirmLabel="Withdraw"
        danger
        loading={busy}
        onCancel={() => setWithdrawOpen(false)}
        onConfirm={() => run(() => gbsProviderApi.withdrawQuote(selected, item.publicQuoteRef, item.recordVersion))}
      />
    </article>
  );
}
