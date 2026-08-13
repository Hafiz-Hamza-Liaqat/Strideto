import { isSmtpConfigured } from './emailService.js';
import { isWorkerHeartbeatFresh } from './workerHeartbeat.js';

export function isEmailDeliveryEnabled(env = process.env) {
  return env.EMAIL_DELIVERY_ENABLED === '1';
}

/**
 * Separate SMTP configuration, worker execution, and delivery enablement.
 * Does not claim mail is sending merely because credentials exist.
 */
export async function resolveEmailDeliveryState({ pending = 0 } = {}) {
  const providerConfigured = isSmtpConfigured();
  const workerRunning = await isWorkerHeartbeatFresh();
  const deliveryEnabled = isEmailDeliveryEnabled();
  const queuePending = Number(pending) || 0;

  let effectiveState = 'not_configured';
  let note = 'SMTP is not configured. Email jobs are not delivered.';

  if (!providerConfigured) {
    effectiveState = 'not_configured';
  } else if (!workerRunning && queuePending > 0) {
    effectiveState = 'queued_worker_stopped';
    note = 'SMTP is configured but the worker is stopped. Jobs remain queued and are not sent.';
  } else if (!workerRunning || !deliveryEnabled) {
    effectiveState = 'configured_delivery_stopped';
    note = 'SMTP is configured. Delivery is not enabled and/or the worker is not running. No email is sent.';
  } else {
    effectiveState = 'enabled';
    note = 'SMTP is configured, the worker is running, and delivery is enabled.';
  }

  return {
    providerConfigured,
    workerRunning,
    deliveryEnabled,
    queuePending,
    effectiveState,
    mode: effectiveState,
    note,
  };
}
