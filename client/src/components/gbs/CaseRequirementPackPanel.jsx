import { useState } from 'react';
import { ui } from '../../design-system/surfaceClasses';
import { requirementReasonLabel } from './requirementReasonLabel';

function FactInput({ def, value, onChange, disabled, idPrefix }) {
  const id = `${idPrefix}-${def.factKey}`;
  const required = !def.optional;
  const marker = required ? 'Required' : 'Optional';
  if (def.valueType === 'boolean') {
    return (
      <div className="min-w-0">
        <label className="block text-sm font-medium mb-1" htmlFor={id}>{def.label}</label>
        <p className={ui.muted}>{marker}</p>
        <select
          id={id}
          className={ui.input}
          disabled={disabled}
          value={value === true ? 'true' : value === false ? 'false' : ''}
          onChange={(e) => onChange(e.target.value === '' ? null : e.target.value === 'true')}
        >
          <option value="">Select</option>
          <option value="false">No</option>
          <option value="true">Yes</option>
        </select>
        {def.help ? <p className={`mt-1 ${ui.muted}`}>{def.help}</p> : null}
      </div>
    );
  }
  if (def.valueType === 'enum') {
    return (
      <div className="min-w-0">
        <label className="block text-sm font-medium mb-1" htmlFor={id}>{def.label}</label>
        <p className={ui.muted}>{marker}</p>
        <select
          id={id}
          className={ui.input}
          disabled={disabled}
          value={value || ''}
          onChange={(e) => onChange(e.target.value || null)}
        >
          <option value="">Select</option>
          {(def.enumValues || []).filter((item) => item !== 'provider_as_ra').map((item) => (
            <option key={item} value={item}>{item.replace(/_/g, ' ')}</option>
          ))}
        </select>
        {def.help ? <p className={`mt-1 ${ui.muted}`}>{def.help}</p> : null}
      </div>
    );
  }
  if (def.valueType === 'address') {
    const addr = value && typeof value === 'object' ? value : {};
    const setPart = (key, next) => onChange({ ...addr, [key]: next });
    return (
      <fieldset className="min-w-0 space-y-2">
        <legend className="text-sm font-medium">{def.label}</legend>
        <p className={ui.muted}>{marker}</p>
        <div>
          <label className="block text-sm mb-1" htmlFor={`${id}-line1`}>Street</label>
          <input id={`${id}-line1`} className={ui.input} maxLength={160} disabled={disabled} value={addr.line1 || ''} onChange={(e) => setPart('line1', e.target.value)} />
        </div>
        <div>
          <label className="block text-sm mb-1" htmlFor={`${id}-line2`}>Line 2 (optional)</label>
          <input id={`${id}-line2`} className={ui.input} maxLength={160} disabled={disabled} value={addr.line2 || ''} onChange={(e) => setPart('line2', e.target.value)} />
        </div>
        <div>
          <label className="block text-sm mb-1" htmlFor={`${id}-city`}>City</label>
          <input id={`${id}-city`} className={ui.input} maxLength={160} disabled={disabled} value={addr.city || ''} onChange={(e) => setPart('city', e.target.value)} />
        </div>
        <div>
          <label className="block text-sm mb-1" htmlFor={`${id}-state`}>State / region</label>
          <input id={`${id}-state`} className={ui.input} maxLength={32} disabled={disabled} value={addr.state || ''} onChange={(e) => setPart('state', e.target.value)} />
        </div>
        <div>
          <label className="block text-sm mb-1" htmlFor={`${id}-postal`}>Postal code</label>
          <input id={`${id}-postal`} className={ui.input} maxLength={16} disabled={disabled} value={addr.postalCode || ''} onChange={(e) => setPart('postalCode', e.target.value)} />
        </div>
      </fieldset>
    );
  }
  return (
    <div className="min-w-0">
      <label className="block text-sm font-medium mb-1" htmlFor={id}>{def.label}</label>
      <p className={ui.muted}>{marker}</p>
      <input
        id={id}
        className={ui.input}
        maxLength={def.valueType === 'email' ? 254 : 160}
        type={def.valueType === 'date' ? 'date' : 'text'}
        disabled={disabled}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
      />
      {def.help ? <p className={`mt-1 ${ui.muted}`}>{def.help}</p> : null}
    </div>
  );
}

export function CaseRequirementPackPanel({
  pack,
  recordVersion,
  busy,
  error,
  onSaveFact,
  role = 'customer',
}) {
  const [drafts, setDrafts] = useState({});
  if (!pack?.attached) return null;
  const facts = pack.facts || [];
  const companyKeys = ['proposed_entity_name', 'close_llc_election', 'mailing_address', 'principal_office_address', 'entity_email', 'organizer_print_name', 'filing_contact_name', 'filing_contact_phone', 'delayed_effective_date'];
  const raKeys = facts.filter((row) => String(row.factKey).startsWith('ra_')).map((row) => row.factKey);
  const byKey = Object.fromEntries(facts.map((row) => [row.factKey, row]));
  const blockers = pack.readiness?.reasons || [];

  const save = (factKey) => {
    const def = byKey[factKey];
    const value = Object.prototype.hasOwnProperty.call(drafts, factKey) ? drafts[factKey] : def?.value;
    onSaveFact({ factKey, value, expectedVersion: recordVersion });
  };

  const renderGroup = (title, keys) => (
    <section className="space-y-3 min-w-0">
      <h4 className="font-medium">{title}</h4>
      {keys.map((key) => {
        const def = byKey[key];
        if (!def) return null;
        const current = Object.prototype.hasOwnProperty.call(drafts, key) ? drafts[key] : def.value;
        const canEdit = def.canEdit === true;
        return (
          <div key={key} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-2 min-w-0">
            <FactInput
              def={def}
              value={current}
              disabled={busy || !canEdit}
              idPrefix={`${role}-req`}
              onChange={(next) => setDrafts((prev) => ({ ...prev, [key]: next }))}
            />
            {!canEdit ? (
              <p className={ui.muted}>
                {def.value != null && def.value !== '' ? 'Recorded for preparation.' : 'Provider preparation pending.'}
              </p>
            ) : (
              <button type="button" className={ui.secondaryBtn} disabled={busy} onClick={() => save(key)}>
                Save
              </button>
            )}
          </div>
        );
      })}
    </section>
  );

  return (
    <section className="space-y-4 min-w-0" data-testid="gbs-requirement-pack">
      <h3 className="font-medium">Formation requirements</h3>
      <p className={ui.muted}>
        Required for STRIDETO pre-submission preparation. This is not a guarantee of Wyoming approval or registration.
      </p>
      {error ? <p className={ui.error} role="alert">{error}</p> : null}
      {renderGroup('Company information', companyKeys.filter((key) => byKey[key]))}
      {renderGroup('Registered agent information', raKeys)}
      <section>
        <h4 className="font-medium">Preparation status</h4>
        <p className="mt-2">
          {pack.readiness?.b2bRequirementsReady
            ? 'Pre-submission preparation information is complete. This is not government approval.'
            : 'Missing information or provider preparation pending.'}
        </p>
        {pack.raConsent ? (
          <p className="mt-2">
            Registered agent written consent:{' '}
            {pack.raConsent.status === 'attested' ? 'Obtained and retained — Provider attested' : 'Missing'}
          </p>
        ) : null}
      </section>
      {blockers.length ? (
        <section>
          <h4 className="font-medium">Readiness blockers</h4>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            {blockers.map((reason) => (
              <li key={reason}>{requirementReasonLabel(reason)}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}
