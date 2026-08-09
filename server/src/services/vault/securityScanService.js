/**
 * Provider-neutral security scan boundary (Mission 10 §E).
 *
 * No live external scanner calls.
 * Status: not_configured until a real provider is injected.
 * Future: replace initScan with real AV/malware provider.
 */

/**
 * Determine initial scan status on upload.
 * Returns 'not_configured' when no provider is registered.
 */
export function initialScanStatus() {
  if (process.env.VAULT_SCANNER_PROVIDER) return 'pending';
  return 'not_configured';
}

/**
 * Injectable scanner interface contract.
 * Implementors must return: { status: 'clean'|'rejected'|'failed', completedAt: Date }
 *
 * @param {object} _params
 * @param {string} _params.storageKey
 * @param {string} _params.storageProvider
 * @param {string} _params.versionId
 * @returns {Promise<never>} — always throws until a real provider is wired
 */
export async function runSecurityScan(_params) {
  throw new Error('No security scan provider configured (VAULT_SCANNER_PROVIDER not set)');
}

/**
 * Whether a version's scan status permits download.
 * Policy: clean only if explicitly marked clean.
 * not_configured and pending allow access per policy (data not externally shared yet).
 * rejected blocks access.
 */
export function isScanStatusPermittingAccess(scanStatus) {
  return scanStatus !== 'rejected';
}
