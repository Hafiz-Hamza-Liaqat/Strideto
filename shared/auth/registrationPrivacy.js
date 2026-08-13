/**
 * Non-enumerating registration / recovery response helpers.
 * Delivery mode is environment-truthful and must not vary by account existence.
 */

export function registrationAcceptedPayload(emailMode, expiresInMinutes = 30) {
  const mode = emailMode || 'unavailable';
  const messages = {
    accepted:
      'If registration can proceed, continue using the instructions sent to your email.',
    queued_worker_stopped:
      'If registration can proceed, a verification challenge was accepted. Email is not sent while delivery is stopped.',
    unavailable:
      'If registration can proceed, use the account instructions when email delivery is available. Delivery is not configured in this environment.',
    delivery_unavailable:
      'If registration can proceed, use the account instructions when email delivery is available. Delivery is not configured in this environment.',
  };
  return {
    accepted: true,
    requiresVerification: true,
    emailMode: mode === 'delivery_unavailable' ? 'unavailable' : mode,
    message: messages[mode] || messages.unavailable,
    expiresInMinutes,
  };
}

export function recoveryAcceptedPayload(emailMode) {
  const mode = emailMode || 'unavailable';
  const messages = {
    accepted:
      'If an account exists for this email, a reset link will be delivered.',
    queued_worker_stopped:
      'If an account exists for this email, a reset was accepted. Email is not sent while the worker is stopped.',
    unavailable:
      'If an account exists for this email, a reset can be completed when email delivery is configured. Delivery is not configured in this environment.',
    delivery_unavailable:
      'If an account exists for this email, a reset can be completed when email delivery is configured. Delivery is not configured in this environment.',
  };
  return {
    accepted: true,
    emailMode: mode === 'delivery_unavailable' ? 'unavailable' : mode,
    message: messages[mode] || messages.unavailable,
  };
}

export function mapDeliveryStateToAuthMode(effectiveState) {
  if (effectiveState === 'enabled') return 'accepted';
  if (effectiveState === 'queued_worker_stopped' || effectiveState === 'configured_delivery_stopped') {
    return 'queued_worker_stopped';
  }
  return 'unavailable';
}
