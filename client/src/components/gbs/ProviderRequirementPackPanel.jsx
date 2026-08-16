import { useState } from 'react';
import { AdminConfirmDialog } from '../admin/AdminConfirmDialog';
import { ui } from '../../design-system/surfaceClasses';
import { CaseRequirementPackPanel } from './CaseRequirementPackPanel';
import { requirementReasonLabel } from './requirementReasonLabel';

export function ProviderRequirementPackPanel({
  pack,
  recordVersion,
  busy,
  error,
  onSaveFact,
  onAttestCheck,
  onAttestRaConsent,
}) {
  const [checkOpen, setCheckOpen] = useState(null);
  const [method, setMethod] = useState('wyobiz_online');
  const [raOpen, setRaOpen] = useState(false);
  if (!pack?.attached) return null;
  const checks = pack.checks || [];

  return (
    <section className="space-y-4 min-w-0" data-testid="gbs-provider-requirement-pack">
      <h3 className="font-medium">Formation preparation</h3>
      <p className={ui.muted}>
        {pack.displayName}. Source set {pack.identity?.sourceSetId}. This is STRIDETO pre-submission preparation, not a Wyoming filing.
      </p>
      <CaseRequirementPackPanel
        pack={pack}
        recordVersion={recordVersion}
        busy={busy}
        error={error}
        onSaveFact={onSaveFact}
        role="provider"
      />
      <section className="space-y-3 min-w-0">
        <h4 className="font-medium">Provider checks</h4>
        <ul className="space-y-3">
          {checks.map((check) => (
            <li key={check.checkKey} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 min-w-0">
              <p className="font-medium break-words-safe">{check.label}</p>
              {check.help ? <p className={`${ui.muted} whitespace-pre-wrap break-words-safe`}>{check.help}</p> : null}
              <p>
                Status:{' '}
                {check.status === 'attested' || check.status === 'derived_pass'
                  ? 'Complete for preparation'
                  : 'Missing'}
              </p>
              {check.checkKey === 'filing_method_selected' && check.canAttest ? (
                <div className="mt-2">
                  <label className="block text-sm font-medium mb-1" htmlFor="gbs-filing-method">External filing method</label>
                  <select
                    id="gbs-filing-method"
                    className={ui.input}
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                    disabled={busy}
                  >
                    <option value="wyobiz_online">WyoBiz online</option>
                    <option value="paper_mail">Paper mail</option>
                  </select>
                </div>
              ) : null}
              {check.canAttest && check.status !== 'attested' ? (
                <button
                  type="button"
                  className={`${ui.secondaryBtn} mt-2`}
                  disabled={busy}
                  onClick={() => setCheckOpen(check)}
                >
                  Confirm this check
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
      <section className="space-y-2 min-w-0">
        <h4 className="font-medium">Registered agent written consent</h4>
        <p>
          {pack.raConsent?.status === 'attested'
            ? 'Obtained and retained — Provider attested'
            : 'Missing'}
        </p>
        <p className={ui.muted}>{pack.raConsent?.helper}</p>
        {pack.raConsent?.canAttest && pack.raConsent.status !== 'attested' ? (
          <button type="button" className={ui.secondaryBtn} disabled={busy} onClick={() => setRaOpen(true)}>
            Confirm written consent obtained and retained
          </button>
        ) : null}
      </section>
      <section>
        <h4 className="font-medium">Pre-submission readiness</h4>
        <p className="mt-2">
          {pack.readiness?.b2bRequirementsReady
            ? 'B2B pre-submission requirements are complete. STRIDETO has not submitted anything to Wyoming.'
            : 'Not ready for the next STRIDETO pre-submission step.'}
        </p>
        {(pack.readiness?.reasons || []).length ? (
          <ul className="mt-2 list-disc pl-5 space-y-1">
            {(pack.readiness.reasons || []).map((reason) => (
              <li key={reason}>{requirementReasonLabel(reason)}</li>
            ))}
          </ul>
        ) : null}
      </section>
      <AdminConfirmDialog
        open={Boolean(checkOpen)}
        title="Confirm this preparation check?"
        message={checkOpen?.help || 'This records that you performed the listed preparation step. It is not government approval.'}
        confirmLabel="Confirm check"
        loading={busy}
        onCancel={() => setCheckOpen(null)}
        onConfirm={() => {
          const current = checkOpen;
          setCheckOpen(null);
          if (!current) return;
          onAttestCheck({
            checkKey: current.checkKey,
            selectedMethod: current.checkKey === 'filing_method_selected' ? method : undefined,
            expectedVersion: recordVersion,
          });
        }}
      />
      <AdminConfirmDialog
        open={raOpen}
        title="Confirm registered agent written consent?"
        message="Confirm that the registered agent's written consent has been obtained and will be retained or included as required for the external Wyoming filing. This is not customer consent, STRIDETO consent, or a Wyoming filing authorization."
        confirmLabel="Confirm obtained and retained"
        loading={busy}
        onCancel={() => setRaOpen(false)}
        onConfirm={() => {
          setRaOpen(false);
          onAttestRaConsent({ expectedVersion: recordVersion });
        }}
      />
    </section>
  );
}
