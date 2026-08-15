/**
 * GBS Case document scan boundary (Phase 17D-8B1).
 *
 * Production remains NOT_CONFIGURED. A test-only scanner may be injected in
 * non-production processes. No environment variable can mint production CLEAN.
 */
let testScanner = null;

export function setGbsCaseDocumentTestScanner(scanner) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('gbs_test_scanner_forbidden');
  }
  testScanner = typeof scanner === 'function' ? scanner : null;
}

export function resetGbsCaseDocumentTestScanner() {
  testScanner = null;
}

export function gbsCaseDocumentSecurityState() {
  if (process.env.NODE_ENV === 'production' || !testScanner) {
    return {
      configured: false,
      mode: 'not_configured',
      provider: null,
    };
  }
  return {
    configured: true,
    mode: 'test_only',
    provider: 'test',
  };
}

export function isGbsProviderScanClean(scanStatus) {
  return scanStatus === 'clean';
}

export async function scanGbsCaseDocumentVersion(params = {}) {
  const state = gbsCaseDocumentSecurityState();
  if (!state.configured) {
    return { scanStatus: 'not_configured', completedAt: null, mode: state.mode };
  }
  const result = await testScanner(params);
  const scanStatus = result?.scanStatus;
  if (!['clean', 'rejected', 'failed', 'pending'].includes(scanStatus)) {
    return { scanStatus: 'failed', completedAt: new Date(), mode: 'test_only' };
  }
  return {
    scanStatus,
    completedAt: scanStatus === 'pending' ? null : new Date(),
    mode: 'test_only',
  };
}
