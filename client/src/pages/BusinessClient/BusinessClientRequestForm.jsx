import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ROUTES } from '../../constants';
import { ui } from '../../design-system/surfaceClasses';
import { gbsBuyerApi } from '../../services/gbsBuyerApi';
import { GBS_SERVICE_REQUEST_ACTING_FOR, GBS_SERVICE_REQUEST_BOUNDS } from '@shared/gbs/constants.js';

function newCommandId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function BusinessClientRequestForm() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const listingSlug = params.get('listingSlug') || '';
  const privateBeta = params.get('channel') === 'private-beta';
  const [service, setService] = useState(null);
  const [actingFor, setActingFor] = useState(GBS_SERVICE_REQUEST_ACTING_FOR.SELF);
  const [existingBusinessName, setExistingBusinessName] = useState('');
  const [customerSummary, setCustomerSummary] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState('en');
  const [entityTypeId, setEntityTypeId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const commandId = useMemo(() => newCommandId(), []);

  useEffect(() => {
    if (!privateBeta || !listingSlug) return;
    let cancelled = false;
    gbsBuyerApi.getPrivateBetaService(listingSlug)
      .then(({ data }) => {
        if (!cancelled) {
          setService(data.item);
          if (data.item.entityTypeIds?.length === 1) setEntityTypeId(data.item.entityTypeIds[0]);
        }
      })
      .catch(() => { if (!cancelled) setError('This private-beta service is not available to request.'); });
    return () => { cancelled = true; };
  }, [privateBeta, listingSlug]);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!listingSlug) {
      setError('A listing is required. Open Request Service from an approved listing.');
      return;
    }
    if (!customerSummary.trim()) {
      setError('Please describe what you need.');
      return;
    }
    if (actingFor === GBS_SERVICE_REQUEST_ACTING_FOR.EXISTING_BUSINESS && !existingBusinessName.trim()) {
      setError('Enter the existing business name.');
      return;
    }
    setBusy(true);
    try {
      const create = privateBeta ? gbsBuyerApi.createPrivateBetaRequest : gbsBuyerApi.create;
      const { data } = await create({
        listingSlug,
        creationCommandId: commandId,
        actingFor,
        existingBusinessName: actingFor === GBS_SERVICE_REQUEST_ACTING_FOR.EXISTING_BUSINESS ? existingBusinessName : undefined,
        customerSummary,
        preferredLanguage,
        entityTypeId: entityTypeId || undefined,
      });
      navigate(`${ROUTES.BUSINESS}/requests/${data.item.publicRequestRef}`, { replace: true });
    } catch (err) {
      const code = err.response?.data?.error;
      if (err.response?.status === 404) setError('This listing is not available.');
      else if (code === 'idempotency_conflict') setError('This request was already submitted with different details.');
      else setError('Unable to submit this request.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className={`${ui.card} p-6 space-y-5 min-w-0`} onSubmit={submit} noValidate>
      <h2 className="text-lg font-semibold">Request Service</h2>
      {!listingSlug ? (
        <p className={ui.warning} role="alert">
          A Provider-issued private service link is required while the Business marketplace is unavailable.
        </p>
      ) : (
        <div className={`${ui.muted} break-words-safe`}>
          <p>Private-beta service: {service?.title || listingSlug}</p>
          {service ? <p>Provider: {service.providerDisplayName} · {service.jurisdictionName}</p> : null}
        </div>
      )}
      {error ? <p className={ui.error} role="alert">{error}</p> : null}

      {privateBeta && service?.entityTypeIds?.length ? (
        <div>
          <label htmlFor="business-entity-type" className="block text-sm font-medium mb-1">Entity type</label>
          <select id="business-entity-type" className={ui.input} value={entityTypeId} onChange={(event) => setEntityTypeId(event.target.value)} required>
            <option value="">Select entity type</option>
            {service.entityTypeIds.map((id) => <option key={id} value={id}>{id}</option>)}
          </select>
        </div>
      ) : null}

      <fieldset>
        <legend className="text-sm font-medium">Who is this request for?</legend>
        <div className="mt-2 space-y-2">
          {[
            [GBS_SERVICE_REQUEST_ACTING_FOR.SELF, 'Myself'],
            [GBS_SERVICE_REQUEST_ACTING_FOR.EXISTING_BUSINESS, 'An existing business'],
            [GBS_SERVICE_REQUEST_ACTING_FOR.FORMATION_INTENT, 'A business I intend to form'],
          ].map(([value, label]) => (
            <label key={value} className="flex min-h-[44px] items-center gap-2">
              <input
                type="radio"
                name="actingFor"
                value={value}
                checked={actingFor === value}
                onChange={() => setActingFor(value)}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {actingFor === GBS_SERVICE_REQUEST_ACTING_FOR.EXISTING_BUSINESS ? (
        <div>
          <label htmlFor="existing-business-name" className="block text-sm font-medium mb-1">Existing business name</label>
          <input
            id="existing-business-name"
            className={ui.input}
            value={existingBusinessName}
            maxLength={GBS_SERVICE_REQUEST_BOUNDS.EXISTING_BUSINESS_NAME_MAX}
            onChange={(e) => setExistingBusinessName(e.target.value)}
            required
          />
        </div>
      ) : null}

      <div>
        <label htmlFor="customer-summary" className="block text-sm font-medium mb-1">What do you need?</label>
        <textarea
          id="customer-summary"
          className={`${ui.input} min-h-[140px]`}
          value={customerSummary}
          maxLength={GBS_SERVICE_REQUEST_BOUNDS.CUSTOMER_SUMMARY_MAX}
          onChange={(e) => setCustomerSummary(e.target.value)}
          required
        />
      </div>

      <div>
        <label htmlFor="preferred-language" className="block text-sm font-medium mb-1">Preferred language</label>
        <select
          id="preferred-language"
          className={ui.input}
          value={preferredLanguage}
          onChange={(e) => setPreferredLanguage(e.target.value)}
        >
          <option value="en">English</option>
          <option value="ur">Urdu</option>
          <option value="ar">Arabic</option>
        </select>
      </div>

      <button type="submit" className={ui.primaryBtn} disabled={busy || !listingSlug || (privateBeta && (!service || (service.entityTypeIds?.length && !entityTypeId)))} aria-busy={busy}>
        {busy ? 'Submitting…' : 'Submit request'}
      </button>
    </form>
  );
}
