import { useState } from 'react';
import { AdminConfirmDialog } from '../admin/AdminConfirmDialog';
import { ui } from '../../design-system/surfaceClasses';

function statusText(auth) {
  if (auth?.externalSubmissionState === 'submitted_externally') {
    return 'External filing recorded — Provider attested. This is not government acceptance.';
  }
  if (auth?.externalSubmissionState === 'authorization_claimed') {
    return 'Authorization claimed for an external filing action. This is not government submission.';
  }
  if (auth?.current?.status === 'revoked') return 'Authorization revoked. It cannot be used for a future filing.';
  if (auth?.current?.status === 'invalidated') return 'Authorization invalidated. A new authorization would be required.';
  if (auth?.current?.status === 'active') return 'Provider is authorized for the described initial external formation filing.';
  if (auth?.current?.status === 'used') return 'Authorization has been used for one initial filing action.';
  if (auth?.current?.status === 'claimed_for_submission') {
    return 'Authorization claimed for an external filing action. This is not government submission.';
  }
  return null;
}

export function CaseFilingAuthorizationPanel({
  auth,
  caseRecordVersion,
  busy,
  error,
  onGrant,
  onRevoke,
}) {
  const [affirmed, setAffirmed] = useState(false);
  const [grantOpen, setGrantOpen] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  if (!auth) return null;
  const text = auth.eligibleLegalText;
  const providerName = auth.providerDisplayName || 'the named Provider';

  return (
    <section className="space-y-3 min-w-0" data-testid="gbs-filing-authorization">
      <h3 className="font-medium">Filing authorization</h3>
      <p className={`${ui.muted} break-words-safe`}>
        This authorizes the named Provider to use this Case information for the described initial external formation filing.
        It is not a power of attorney, statutory signature, government filing, or government acceptance.
      </p>
      <p>
        <span className="font-medium">Provider: </span>
        <span className="break-words-safe">{providerName}</span>
      </p>
      {auth.jurisdictionId || auth.entityTypeId ? (
        <p className={`${ui.muted} break-words-safe`}>
          Scope: {auth.capabilityId || 'business formation'}
          {auth.jurisdictionId ? ` · ${auth.jurisdictionId}` : ''}
          {auth.entityTypeId ? ` · ${auth.entityTypeId}` : ''}
          {auth.packVersion != null ? ` · pack v${auth.packVersion}` : ''}
        </p>
      ) : null}
      {statusText(auth) ? <p>{statusText(auth)}</p> : null}
      {!auth.available && !auth.current ? (
        <p className={ui.muted}>{auth.message || 'Filing authorization is not yet available for this Case.'}</p>
      ) : null}
      {auth.available && text ? (
        <div className="space-y-3 min-w-0">
          <h4 className="font-medium">Authorization text</h4>
          <p className={ui.muted}>Version {text.legalTextVersion}{text.testOnly ? ' · test only' : ''}</p>
          <div className="space-y-2 whitespace-pre-wrap break-words-safe text-sm">
            {(text.paragraphs || []).map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
          <label className="flex items-start gap-2 min-w-0" htmlFor="filing-auth-affirm">
            <input
              id="filing-auth-affirm"
              type="checkbox"
              className="mt-1"
              checked={affirmed}
              disabled={busy}
              onChange={(e) => setAffirmed(e.target.checked)}
            />
            <span>I understand this authorization and I want to authorize this Provider for this Case only.</span>
          </label>
          <button
            type="button"
            className={ui.primaryBtn}
            disabled={busy || !affirmed}
            onClick={() => setGrantOpen(true)}
          >
            Authorize Provider
          </button>
        </div>
      ) : null}
      {auth.canRevoke ? (
        <button type="button" className={ui.secondaryBtn} disabled={busy} onClick={() => setRevokeOpen(true)}>
          Revoke authorization
        </button>
      ) : null}
      {error ? <p className={ui.error} role="alert">{error}</p> : null}
      <AdminConfirmDialog
        open={grantOpen}
        title="Authorize this Provider?"
        message={`This records that you authorize ${providerName} to use this Case information for the described initial external formation filing. It does not sign a government form and does not file with Wyoming.`}
        confirmLabel="Authorize Provider"
        loading={busy}
        onCancel={() => setGrantOpen(false)}
        onConfirm={() => {
          if (!text) return;
          onGrant({
            expectedVersion: caseRecordVersion,
            legalTextId: text.legalTextId,
            legalTextVersion: text.legalTextVersion,
            legalTextHash: text.legalTextHash,
            affirmed: true,
          });
          setGrantOpen(false);
        }}
      />
      <AdminConfirmDialog
        open={revokeOpen}
        title="Revoke this authorization?"
        message="Revoking stops future use of this authorization. It cannot undo an external filing that was already recorded."
        confirmLabel="Revoke authorization"
        danger
        loading={busy}
        onCancel={() => setRevokeOpen(false)}
        onConfirm={() => {
          onRevoke({
            expectedVersion: auth.current?.recordVersion,
            publicAuthorizationRef: auth.current?.publicAuthorizationRef,
          });
          setRevokeOpen(false);
        }}
      />
    </section>
  );
}
