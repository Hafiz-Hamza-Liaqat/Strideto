import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../../components/common/Button';
import { SearchableSelect } from '../../../components/forms/SearchableSelect';
import { ui } from '../../../design-system/surfaceClasses';
import { ROUTES } from '../../../constants';
import { gbsProviderApi } from '../../../services/gbsProviderApi';
import { useGbsProvider } from './GbsProviderContext';
import { StatusBadge, card, errorBox, h2, input, label, muted, wrap } from './gbsUi';

const EMPTY = {
  capabilityId: '',
  countryCode: '',
  jurisdictionId: '',
  entityTypeIds: [],
  title: '',
  shortDescription: '',
  description: '',
  includedItems: '',
  excludedItems: '',
  deliveryMode: 'remote',
  languages: 'en',
  pricingMode: 'quote_required',
  feeLabel: 'Provider service fee',
  feeAmountMajor: '',
  feeCurrency: 'USD',
  feeMaxMajor: '',
  providerTurnaroundEstimate: '',
  turnaroundUnit: 'days',
  consultationAvailable: false,
  recurringService: false,
};

function majorToMinor(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function commandId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `listing-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function GbsListingEditor() {
  const { listingId } = useParams();
  const navigate = useNavigate();
  const { selected, catalog } = useGbsProvider();
  const [form, setForm] = useState(EMPTY);
  const [record, setRecord] = useState(null);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(Boolean(listingId));
  const [busy, setBusy] = useState(false);

  const jurisdictions = catalog?.jurisdictions || [];
  const capabilities = catalog?.capabilities || [];
  const entityTypes = useMemo(
    () => (catalog?.entityTypes || []).filter((e) => e.jurisdictionId === form.jurisdictionId),
    [catalog, form.jurisdictionId]
  );
  const governmentFees = useMemo(() => {
    const fees = catalog?.fees || [];
    return fees.filter((f) => f.jurisdictionId === form.jurisdictionId || (form.capabilityId === 'ein_assistance' && f.feeId === 'fee:US-IRS-EIN'));
  }, [catalog, form.jurisdictionId, form.capabilityId]);

  const set = (key) => (event) => {
    const value = event?.target ? (event.target.type === 'checkbox' ? event.target.checked : event.target.value) : event;
    setForm((current) => ({ ...current, [key]: value }));
  };

  useEffect(() => {
    if (!listingId || !selected) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    gbsProviderApi
      .getListing(selected, listingId)
      .then(({ data }) => {
        if (cancelled) return;
        const item = data.item;
        setRecord(item);
        const line = item.providerFeeLines?.[0];
        const max = item.providerFeeLines?.[1];
        setForm({
          ...EMPTY,
          capabilityId: item.capabilityId || '',
          countryCode: item.countryCode || '',
          jurisdictionId: item.jurisdictionId || '',
          entityTypeIds: item.entityTypeIds || [],
          title: item.title || '',
          shortDescription: item.shortDescription || '',
          description: item.description || '',
          includedItems: (item.includedItems || []).join('\n'),
          excludedItems: (item.excludedItems || []).join('\n'),
          deliveryMode: item.deliveryMode || 'remote',
          languages: (item.languages || ['en']).join(','),
          pricingMode: item.pricingMode || 'quote_required',
          feeLabel: line?.label || 'Provider service fee',
          feeAmountMajor: line ? String(line.amountMinor / 100) : '',
          feeCurrency: line?.currency || 'USD',
          feeMaxMajor: max ? String(max.amountMinor / 100) : '',
          providerTurnaroundEstimate: item.providerTurnaroundEstimate || '',
          turnaroundUnit: item.turnaroundUnit || 'days',
          consultationAvailable: item.consultationAvailable === true,
          recurringService: item.recurringService === true,
        });
      })
      .catch(() => {
        if (!cancelled) setError('Listing was not found for this subject.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [listingId, selected]);

  const payload = () => {
    const lines = [];
    if (form.pricingMode !== 'quote_required' && form.feeAmountMajor !== '') {
      lines.push({
        label: form.feeLabel || 'Provider service fee',
        amountMinor: majorToMinor(form.feeAmountMajor),
        currency: form.feeCurrency,
        ownership: 'provider',
      });
    }
    if (form.pricingMode === 'range' && form.feeMaxMajor !== '') {
      lines.push({
        label: `${form.feeLabel || 'Provider service fee'} (max)`,
        amountMinor: majorToMinor(form.feeMaxMajor),
        currency: form.feeCurrency,
        ownership: 'provider',
      });
    }
    return {
      capabilityId: form.capabilityId,
      countryCode: form.countryCode,
      jurisdictionId: form.jurisdictionId,
      entityTypeIds: form.entityTypeIds,
      title: form.title,
      shortDescription: form.shortDescription,
      description: form.description,
      includedItems: form.includedItems.split('\n').map((s) => s.trim()).filter(Boolean),
      excludedItems: form.excludedItems.split('\n').map((s) => s.trim()).filter(Boolean),
      deliveryMode: form.deliveryMode,
      languages: form.languages.split(',').map((s) => s.trim()).filter(Boolean),
      pricingMode: form.pricingMode,
      providerFeeLines: lines,
      providerTurnaroundEstimate: form.providerTurnaroundEstimate || null,
      turnaroundUnit: form.turnaroundUnit || null,
      consultationAvailable: form.consultationAvailable,
      recurringService: form.recurringService,
    };
  };

  const save = async (submitAfter) => {
    setBusy(true);
    setError(null);
    setMessage('');
    try {
      let saved = record;
      if (listingId && record) {
        const { data } = await gbsProviderApi.updateListing(selected, listingId, {
          ...payload(),
          expectedVersion: record.recordVersion,
        });
        saved = data.item;
      } else {
        const { data } = await gbsProviderApi.createListing(selected, payload(), commandId());
        saved = data.item;
        navigate(`${ROUTES.AGENT_BUSINESS_SERVICES_LISTINGS}/${saved.id}/edit`, { replace: true });
      }
      setRecord(saved);
      if (submitAfter) {
        const { data } = await gbsProviderApi.submitListing(selected, saved.id, saved.recordVersion);
        setRecord(data.item);
        setMessage('Submitted for Admin review. The listing remains private.');
      } else {
        setMessage('Draft saved. It is private and not published.');
      }
    } catch (err) {
      const code = err.response?.data?.error || 'Save failed.';
      setError(code);
    } finally {
      setBusy(false);
    }
  };

  if (!selected) return <div className={errorBox}>Select an authorized provider subject first.</div>;
  if (loading) return <div className={`${card} ${muted}`} aria-busy="true">Loading listing…</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className={h2}>{listingId ? 'Edit listing' : 'New listing'}</h2>
        <Link to={ROUTES.AGENT_BUSINESS_SERVICES_LISTINGS} className={ui.link}>Back to listings</Link>
      </div>
      {record ? (
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={record.moderationStatus} />
          <StatusBadge status={record.publicationStatus} label={`publication: ${record.publicationStatus}`} />
        </div>
      ) : null}
      {error ? <div className={errorBox} role="alert">{error}</div> : null}
      {message ? <p className="text-sm text-emerald-800 dark:text-emerald-200" role="status">{message}</p> : null}

      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          save(false);
        }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <span className={label}>Capability</span>
            <SearchableSelect
              id="listing-cap"
              aria-label="Listing capability"
              value={form.capabilityId}
              onChange={set('capabilityId')}
              options={capabilities.map((c) => ({ value: c.capabilityId, label: c.publicName }))}
            />
          </div>
          <div>
            <span className={label}>Jurisdiction</span>
            <SearchableSelect
              id="listing-jurisdiction"
              aria-label="Listing jurisdiction"
              value={form.jurisdictionId}
              onChange={(id) => {
                const row = jurisdictions.find((j) => j.id === id);
                setForm((c) => ({ ...c, jurisdictionId: id, countryCode: row?.countryCode || '', entityTypeIds: [] }));
              }}
              options={jurisdictions.map((j) => ({
                value: j.id,
                label: `${j.name}${j.currentReviewed ? '' : ' — not current'}`,
              }))}
            />
          </div>
          <div className="md:col-span-2">
            <span className={label}>Entity types</span>
            <SearchableSelect
              id="listing-entity"
              aria-label="Listing entity type"
              value={form.entityTypeIds[0] || ''}
              onChange={(id) => setForm((c) => ({ ...c, entityTypeIds: id ? [id] : [] }))}
              options={entityTypes.map((e) => ({ value: e.entityTypeId, label: e.displayName || e.officialName || e.code }))}
            />
          </div>
          <div className="md:col-span-2">
            <label className={label} htmlFor="listing-title">Title</label>
            <input id="listing-title" required className={input} value={form.title} onChange={set('title')} />
          </div>
          <div className="md:col-span-2">
            <label className={label} htmlFor="listing-short">Short description</label>
            <input id="listing-short" className={input} value={form.shortDescription} onChange={set('shortDescription')} />
          </div>
          <div className="md:col-span-2">
            <label className={label} htmlFor="listing-desc">Description</label>
            <textarea id="listing-desc" className={`${input} min-h-[8rem]`} value={form.description} onChange={set('description')} />
          </div>
          <div>
            <label className={label} htmlFor="listing-included">Included items (one per line)</label>
            <textarea id="listing-included" className={`${input} min-h-[6rem]`} value={form.includedItems} onChange={set('includedItems')} />
          </div>
          <div>
            <label className={label} htmlFor="listing-excluded">Excluded items (one per line)</label>
            <textarea id="listing-excluded" className={`${input} min-h-[6rem]`} value={form.excludedItems} onChange={set('excludedItems')} />
          </div>
          <div>
            <span className={label}>Delivery</span>
            <SearchableSelect
              id="listing-delivery"
              aria-label="Delivery mode"
              value={form.deliveryMode}
              onChange={set('deliveryMode')}
              options={[
                { value: 'remote', label: 'Remote' },
                { value: 'in_person', label: 'In person' },
                { value: 'hybrid', label: 'Hybrid' },
              ]}
            />
          </div>
          <div>
            <label className={label} htmlFor="listing-lang">Languages (comma-separated)</label>
            <input id="listing-lang" className={input} value={form.languages} onChange={set('languages')} />
          </div>
        </div>

        <section className={card}>
          <h3 className={h2}>Provider pricing</h3>
          <p className={`${muted} mt-1`}>Currency is explicit. Provider fees stay separate from government catalog fees.</p>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className={label}>Pricing mode</span>
              <SearchableSelect
                id="listing-price-mode"
                aria-label="Pricing mode"
                value={form.pricingMode}
                onChange={set('pricingMode')}
                options={[
                  { value: 'fixed', label: 'Fixed' },
                  { value: 'starting_at', label: 'Starting at' },
                  { value: 'range', label: 'Range' },
                  { value: 'quote_required', label: 'Quote required' },
                ]}
              />
            </div>
            <div>
              <label className={label} htmlFor="listing-currency">Currency</label>
              <input id="listing-currency" className={input} value={form.feeCurrency} onChange={set('feeCurrency')} maxLength={3} />
            </div>
            {form.pricingMode !== 'quote_required' ? (
              <>
                <div>
                  <label className={label} htmlFor="listing-fee-label">Provider fee label</label>
                  <input id="listing-fee-label" className={input} value={form.feeLabel} onChange={set('feeLabel')} />
                </div>
                <div>
                  <label className={label} htmlFor="listing-fee">{form.pricingMode === 'range' ? 'Minimum amount' : 'Amount'}</label>
                  <input id="listing-fee" inputMode="decimal" className={input} value={form.feeAmountMajor} onChange={set('feeAmountMajor')} />
                </div>
                {form.pricingMode === 'range' ? (
                  <div>
                    <label className={label} htmlFor="listing-fee-max">Maximum amount</label>
                    <input id="listing-fee-max" inputMode="decimal" className={input} value={form.feeMaxMajor} onChange={set('feeMaxMajor')} />
                  </div>
                ) : null}
              </>
            ) : (
              <p className={`${muted} md:col-span-2`}>Quote required stores no fake mandatory fixed price.</p>
            )}
          </div>
        </section>

        <section className={card}>
          <h3 className={h2}>Government fees (read-only)</h3>
          <p className={`${muted} mt-1`}>Catalog-backed. Provider cannot override official amounts. not_catalogued is not shown as zero.</p>
          {governmentFees.length === 0 ? (
            <p className={`${muted} mt-2`}>No current government fee is catalogued for this selection.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {governmentFees.map((fee) => (
                <li key={`${fee.feeId}-${fee.sourceVersion}`} className="min-w-0">
                  <p className={`font-medium text-gray-900 dark:text-white ${wrap}`}>{fee.label}</p>
                  <p className={`${muted} ${wrap}`}>
                    {fee.eligibleCurrent && fee.amount != null
                      ? `${fee.currency} ${Number(fee.amount).toFixed(2)}`
                      : fee.amountModel === 'not_catalogued'
                        ? 'Not catalogued / currently unavailable'
                        : `${fee.eligibilityState} — not current`}
                  </p>
                  {fee.source?.title ? <p className={`${muted} ${wrap}`}>{fee.source.title}</p> : null}
                  {fee.source?.sourceUrl ? <p className={`text-xs ${ui.link} ${wrap}`}>{fee.source.sourceUrl}</p> : null}
                </li>
              ))}
            </ul>
          )}
          {form.capabilityId === 'ein_assistance' ? (
            <p className={`mt-3 text-sm text-gray-800 dark:text-gray-100 ${wrap}`}>
              IRS EIN government fee is catalog truth when current (USD 0). Provider assistance is a separate provider fee and is not an IRS fee. EIN issuance is not guaranteed.
            </p>
          ) : null}
        </section>

        <section className={card}>
          <h3 className={h2}>Turnaround</h3>
          <p className={`${muted} mt-1`}>Provider-defined estimate only. This is not government processing time.</p>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={label} htmlFor="listing-turnaround">Estimate</label>
              <input id="listing-turnaround" className={input} value={form.providerTurnaroundEstimate} onChange={set('providerTurnaroundEstimate')} />
            </div>
            <div>
              <span className={label}>Unit</span>
              <SearchableSelect
                id="listing-turnaround-unit"
                aria-label="Turnaround unit"
                value={form.turnaroundUnit}
                onChange={set('turnaroundUnit')}
                options={[
                  { value: 'hours', label: 'Hours' },
                  { value: 'days', label: 'Days' },
                  { value: 'weeks', label: 'Weeks' },
                  { value: 'business_days', label: 'Business days' },
                ]}
              />
            </div>
          </div>
        </section>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={busy}>Save draft</Button>
          <Button type="button" variant="secondary" loading={busy} onClick={() => save(true)}>
            Submit for review
          </Button>
        </div>
      </form>
    </div>
  );
}
