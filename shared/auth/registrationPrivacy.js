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
      'Your account request was accepted. Email verification is currently unavailable. Try again later or contact support.',
    unavailable:
      'Your account request was accepted. Email verification is currently unavailable. Try again later or contact support.',
    delivery_unavailable:
      'Your account request was accepted. Email verification is currently unavailable. Try again later or contact support.',
  };
  return {
    accepted: true,
    requiresVerification: true,
    emailMode: mode === 'delivery_unavailable' || mode === 'queued_worker_stopped' ? 'unavailable' : mode,
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
      'If an account exists for this email, a reset was accepted. Email delivery is currently unavailable. Try again later or contact support.',
    unavailable:
      'If an account exists for this email, a reset can be completed when email delivery is available. Try again later or contact support.',
    delivery_unavailable:
      'If an account exists for this email, a reset can be completed when email delivery is available. Try again later or contact support.',
  };
  return {
    accepted: true,
    emailMode: mode === 'delivery_unavailable' || mode === 'queued_worker_stopped' ? 'unavailable' : mode,
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
