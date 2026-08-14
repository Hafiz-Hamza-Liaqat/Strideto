import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../../components/common/Button';
import { SearchableSelect } from '../../../components/forms/SearchableSelect';
import { DateInput } from '../../../components/forms/NativeTemporalInput';
import { gbsProviderApi } from '../../../services/gbsProviderApi';
import { useGbsProvider } from './GbsProviderContext';
import { StatusBadge, card, emptyBox, errorBox, h2, input, label, muted, wrap } from './gbsUi';

function protectedTitleCopy(cap) {
  if (cap.capabilityId === 'registered_agent') {
    return 'Registered Agent capability — not a licensed-title claim unless the jurisdiction policy supports that exact language.';
  }
  if (cap.capabilityId === 'registered_office') {
    return 'Registered Office Provider capability. Evidence-gated and jurisdiction-scoped.';
  }
  return cap.protectedTitleRequired
    ? 'Protected title applies. Organization Verified and formation capability do not grant this title.'
    : null;
}

export default function GbsCapabilities() {
  const { selected, catalog } = useGbsProvider();
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [claimId, setClaimId] = useState('');
  const [jurisdictionId, setJurisdictionId] = useState('');
  const [entityTypeId, setEntityTypeId] = useState('');
  const [busy, setBusy] = useState(false);
  const [evidenceFor, setEvidenceFor] = useState(null);
  const [evidence, setEvidence] = useState({
    evidenceType: 'regulatory_registration',
    referenceNumber: '',
    officialRegistryUrl: '',
    issuingAuthorityId: '',
    effectiveFrom: '',
    expiresAt: '',
    notes: '',
  });

  const taxonomy = catalog?.capabilities || [];
  const jurisdictions = catalog?.jurisdictions || [];
  const entityTypes = useMemo(
    () => (catalog?.entityTypes || []).filter((e) => e.jurisdictionId === jurisdictionId),
    [catalog, jurisdictionId]
  );

  const load = async () => {
    if (!selected) return;
    const { data } = await gbsProviderApi.listCapabilities(selected);
    setItems(data.items || []);
  };

  useEffect(() => {
    if (!selected) {
      setLoading(false);
      setItems([]);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    gbsProviderApi.listCapabilities(selected)
      .then(({ data }) => {
        if (!cancelled) setItems(data.items || []);
      })
      .catch(() => {
        if (!cancelled) setError('Unable to load capabilities.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  if (!selected) return <div className={emptyBox}>Select an authorized provider subject first.</div>;
  if (loading) return <div className={`${card} ${muted}`} aria-busy="true">Loading capabilities…</div>;
  if (error) return <div className={errorBox} role="alert">{error}</div>;

  const claimedIds = new Set(items.map((i) => i.capabilityId));

  const submitClaim = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await gbsProviderApi.claimCapability(selected, {
        capabilityId: claimId,
        scope: {
          jurisdictionIds: jurisdictionId ? [jurisdictionId] : [],
          countryCodes: jurisdictionId ? [jurisdictions.find((j) => j.id === jurisdictionId)?.countryCode].filter(Boolean) : [],
          entityTypeIds: entityTypeId ? [entityTypeId] : [],
        },
      });
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Claim was rejected.');
    } finally {
      setBusy(false);
    }
  };

  const submitEvidence = async (event) => {
    event.preventDefault();
    if (!evidenceFor) return;
    setBusy(true);
    setError(null);
    try {
      await gbsProviderApi.submitEvidence(selected, evidenceFor.id, {
        expectedVersion: evidenceFor.recordVersion,
        evidence: {
          ...evidence,
          jurisdictionId: evidenceFor.scope?.jurisdictionIds?.[0] || jurisdictionId,
        },
      });
      setEvidenceFor(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Evidence metadata was rejected.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className={card}>
        <h2 className={h2}>Claim a capability</h2>
        <p className={`${muted} mt-1`}>
          You may claim a known capability. You cannot self-verify it. Duplicate active claims are reconciled server-side.
        </p>
        <form onSubmit={submitClaim} className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <span className={label} id="gbs-cap-label">Capability</span>
            <SearchableSelect
              id="gbs-cap"
              aria-label="Capability"
              value={claimId}
              onChange={setClaimId}
              options={taxonomy.map((c) => ({ value: c.capabilityId, label: c.publicName }))}
              placeholder="Select a capability"
            />
          </div>
          <div>
            <span className={label}>Jurisdiction</span>
            <SearchableSelect
              id="gbs-cap-jurisdiction"
              aria-label="Jurisdiction"
              value={jurisdictionId}
              onChange={(id) => {
                setJurisdictionId(id);
                setEntityTypeId('');
              }}
              options={jurisdictions.map((j) => ({
                value: j.id,
                label: `${j.name} (${j.countryCode})${j.currentReviewed ? '' : ' — structural / not current'}`,
              }))}
              placeholder="Select jurisdiction"
            />
          </div>
          <div>
            <span className={label}>Entity type (if applicable)</span>
            <SearchableSelect
              id="gbs-cap-entity"
              aria-label="Entity type"
              value={entityTypeId}
              onChange={setEntityTypeId}
              options={entityTypes.map((e) => ({ value: e.entityTypeId, label: e.displayName || e.officialName || e.code }))}
              placeholder={jurisdictionId ? 'Select entity type' : 'Choose a jurisdiction first'}
            />
          </div>
          <div className="md:col-span-2">
            <Button type="submit" loading={busy} disabled={!claimId || !jurisdictionId}>
              {claimedIds.has(claimId) ? 'Open existing claim' : 'Claim capability'}
            </Button>
          </div>
        </form>
      </section>

      {items.length === 0 ? (
        <div className={emptyBox}>No capability claims yet for this subject.</div>
      ) : (
        <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {items.map((cap) => (
            <li key={cap.id} className={card}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className={`${h2} text-base ${wrap}`}>{cap.publicName}</h3>
                <StatusBadge status={cap.trustStatus} label={`${cap.publicName}: ${cap.trustStatus}`} />
              </div>
              <p className={`${muted} mt-2 ${wrap}`}>Grant status: {cap.status}</p>
              <p className={`${muted} ${wrap}`}>
                Jurisdictions: {(cap.scope?.jurisdictionIds || []).join(', ') || 'none'}
              </p>
              {cap.scope?.entityTypeIds?.length ? (
                <p className={`${muted} ${wrap}`}>Entity types: {cap.scope.entityTypeIds.join(', ')}</p>
              ) : null}
              <p className={`${muted} ${wrap}`}>
                Evidence required: {cap.evidenceRequired ? 'yes' : 'no'}. Protected title: {cap.protectedTitleRequired ? 'yes' : 'no'}.
              </p>
              {protectedTitleCopy(cap) ? <p className={`mt-2 text-sm text-gray-800 dark:text-gray-100 ${wrap}`}>{protectedTitleCopy(cap)}</p> : null}
              {cap.review?.reasonCode ? (
                <p className={`${muted} ${wrap}`}>Review: {cap.review.decision || 'pending'} ({cap.review.reasonCode})</p>
              ) : null}
              {cap.protectedTitleRequired ? (
                <p className={`mt-2 text-sm text-amber-800 dark:text-amber-200 ${wrap}`}>
                  Evidence submission requires additional verification support for documentary files. Metadata below is stored only and is not automatic verification.
                </p>
              ) : null}
              <Button
                variant="secondary"
                className="mt-3"
                onClick={() => setEvidenceFor(cap)}
              >
                Submit evidence metadata
              </Button>
            </li>
          ))}
        </ul>
      )}

      {evidenceFor ? (
        <section className={card} aria-labelledby="gbs-evidence-heading">
          <h2 id="gbs-evidence-heading" className={h2}>Evidence metadata for {evidenceFor.publicName}</h2>
          <p className={`${muted} mt-1`}>No passport, national ID, or licence scans. Official URLs are stored, not fetched.</p>
          <form onSubmit={submitEvidence} className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={label} htmlFor="ev-ref">Registry / licence number</label>
              <input id="ev-ref" className={input} value={evidence.referenceNumber} onChange={(e) => setEvidence((c) => ({ ...c, referenceNumber: e.target.value }))} />
            </div>
            <div>
              <label className={label} htmlFor="ev-url">Official registry URL</label>
              <input id="ev-url" className={`${input} ${wrap}`} value={evidence.officialRegistryUrl} onChange={(e) => setEvidence((c) => ({ ...c, officialRegistryUrl: e.target.value }))} />
            </div>
            <div>
              <label className={label} htmlFor="ev-auth">Issuing authority id</label>
              <input id="ev-auth" className={input} value={evidence.issuingAuthorityId} onChange={(e) => setEvidence((c) => ({ ...c, issuingAuthorityId: e.target.value }))} />
            </div>
            <div>
              <label className={label} htmlFor="ev-from">Effective from</label>
              <DateInput id="ev-from" value={evidence.effectiveFrom} onChange={(e) => setEvidence((c) => ({ ...c, effectiveFrom: e.target.value }))} />
            </div>
            <div>
              <label className={label} htmlFor="ev-to">Expiry date</label>
              <DateInput id="ev-to" value={evidence.expiresAt} onChange={(e) => setEvidence((c) => ({ ...c, expiresAt: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <label className={label} htmlFor="ev-notes">Public-safe notes</label>
              <textarea id="ev-notes" className={`${input} min-h-[6rem]`} value={evidence.notes} onChange={(e) => setEvidence((c) => ({ ...c, notes: e.target.value }))} />
            </div>
            <div className="md:col-span-2 flex flex-wrap gap-2">
              <Button type="submit" loading={busy}>Save metadata</Button>
              <Button type="button" variant="secondary" onClick={() => setEvidenceFor(null)}>Cancel</Button>
            </div>
          </form>
        </section>
      ) : null}
    </div>
  );
}
