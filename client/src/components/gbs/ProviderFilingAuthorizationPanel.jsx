import { useState } from 'react';
import { AdminConfirmDialog } from '../admin/AdminConfirmDialog';
import { ui } from '../../design-system/surfaceClasses';

export function ProviderFilingAuthorizationPanel({
  auth,
  caseRecordVersion,
  busy,
  error,
  onAttest,
}) {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState('wyobiz_online');
  const [confirmed, setConfirmed] = useState(false);
  if (!auth) return null;

  return (
    <section className="space-y-3 min-w-0" data-testid="gbs-provider-filing-authorization">
      <h3 className="font-medium">Customer filing authorization</h3>
      <p className={ui.muted}>
        You cannot grant or revoke the customer&apos;s filing authorization. Status below is read-only except for recording an external filing that was completed outside STRIDETO.
      </p>
      <p>
        <span className="font-medium">Authorization: </span>
        <span>{auth.statusLabel || 'Not authorized'}</span>
      </p>
      <p className={ui.muted}>
        B2B requirements: {auth.requirementsReady ? 'ready' : 'not ready'}.
        External filing eligibility: {auth.externalSubmissionEligible ? 'eligible to record' : 'not eligible'}.
      </p>
      {auth.externalSubmissionState === 'submitted_externally' ? (
        <p>
          External filing recorded — Provider attested. This is not government approval, registration, or company formation.
        </p>
      ) : null}
      {auth.canAttest ? (
        <div className="space-y-2 min-w-0">
          <label className="block text-sm font-medium" htmlFor="ext-filing-method">Filing method used outside STRIDETO</label>
          <select
            id="ext-filing-method"
            className={ui.input}
            value={method}
            disabled={busy}
            onChange={(e) => setMethod(e.target.value)}
          >
            <option value="wyobiz_online">WyoBiz online (outside STRIDETO)</option>
            <option value="paper_mail">Paper mail (outside STRIDETO)</option>
          </select>
          <label className="flex items-start gap-2 min-w-0" htmlFor="ext-filing-confirm">
            <input
              id="ext-filing-confirm"
              type="checkbox"
              className="mt-1"
              checked={confirmed}
              disabled={busy}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            <span>I confirm the external filing was performed for this exact Case using the selected method, outside STRIDETO.</span>
          </label>
          <button type="button" className={ui.primaryBtn} disabled={busy || !confirmed} onClick={() => setOpen(true)}>
            Record external filing
          </button>
        </div>
      ) : (
        <p className={ui.muted}>Recording an external filing is not available for this Case.</p>
      )}
      {error ? <p className={ui.error} role="alert">{error}</p> : null}
      <AdminConfirmDialog
        open={open}
        title="Confirm external filing was completed outside STRIDETO?"
        message="This records that you attested the external filing action for this Case. STRIDETO is not transmitting to Wyoming. This is not government acceptance or company registration."
        confirmLabel="Confirm external filing was completed outside STRIDETO"
        loading={busy}
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          onAttest({
            expectedVersion: caseRecordVersion,
            filingMethod: method,
            authorityId: 'auth:US-WY-SOS',
            providerConfirmation: true,
          });
          setOpen(false);
        }}
      />
    </section>
  );
}
