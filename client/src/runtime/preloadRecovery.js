const RECOVERY_STATE_KEY = 'strideto:preload-recovery';

function deploymentId() {
  return import.meta.env.VITE_VERCEL_DEPLOYMENT_ID || '';
}

function recoveryCycleId() {
  if (deploymentId()) return `deployment:${deploymentId()}`;
  const entry = typeof document !== 'undefined'
    ? document.querySelector('script[type="module"][src]')?.getAttribute('src')
    : null;
  return `entry:${entry || (typeof location !== 'undefined' ? location.pathname : 'unknown')}`;
}

function readState() {
  try {
    const raw = sessionStorage.getItem(RECOVERY_STATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeState(state) {
  try {
    sessionStorage.setItem(RECOVERY_STATE_KEY, JSON.stringify(state));
  } catch {
    // Storage can be unavailable; the browser still gets normal error handling.
  }
}

function errorDetails(payload) {
  const error = payload instanceof Error ? payload : new Error(String(payload || 'Unknown preload error'));
  const message = error.message.slice(0, 1000).replace(/[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[redacted-email]');
  const failedChunkUrl = message.match(/https?:\/\/[^\s)?#]+\.js|\/assets\/[^\s)?#]+\.js/i)?.[0] || null;
  return { name: error.name || 'Error', message, failedChunkUrl };
}

export function shouldAttemptRecovery({ production, previousState, cycleId }) {
  const alreadyConsumed = previousState?.cycleId === cycleId && previousState.attempted === true;
  return { shouldReload: production && !alreadyConsumed, alreadyConsumed };
}

export function getPreloadRecoveryStatus() {
  const state = readState();
  const cycleId = recoveryCycleId();
  return {
    attempted: state?.cycleId === cycleId && state.attempted === true,
    alreadyConsumed: state?.cycleId === cycleId && state.attempted === true,
  };
}

export function installPreloadErrorRecovery() {
  if (!import.meta.env.PROD || typeof window === 'undefined') return;

  window.addEventListener('vite:preloadError', (event) => {
    const payload = event.payload || event.detail?.payload || event.detail || event.error;
    const cycleId = recoveryCycleId();
    const previous = readState();
    const { shouldReload, alreadyConsumed } = shouldAttemptRecovery({
      production: true,
      previousState: previous,
      cycleId,
    });
    const details = errorDetails(payload);
    const diagnostic = { ...details, cycleId, attempted: !alreadyConsumed, alreadyConsumed };

    console.error('Vite preload failed', diagnostic);
    if (!shouldReload) return;

    writeState({ cycleId, attempted: true, ...details });
    event.preventDefault();
    window.location.reload();
  });
}
