/**
 * Phase 17D-8B2A — HSI capability gate.
 * Run: node src/__tests__/phase17d8b2aHsiCapability.test.js
 */
import assert from 'node:assert/strict';
import { isHsiDocumentCapabilityReady } from '../services/hsi/hsiCapabilityService.js';
import { parseHsiRetentionPolicy } from '../config/hsiSecurityConfig.js';
import { HSI_REQUIRED_RETENTION_CLASSES } from '../../../shared/gbs/hsiSecurity.js';

{
  const cap = await isHsiDocumentCapabilityReady({ env: { GBS_HSI_DOCUMENTS_ENABLED: '0' } });
  assert.equal(cap.enabled, false);
  assert.equal(cap.ready, false);
  assert.equal(cap.state, 'disabled');
  assert.equal(cap.overallReady, false);
}

{
  const cap = await isHsiDocumentCapabilityReady({
    env: { GBS_HSI_DOCUMENTS_ENABLED: '1', NODE_ENV: 'test' },
    probes: {
      scannerHealthy: false,
      storageHealthy: true,
      kmsHealthy: true,
      scanExecutorHealthy: true,
      auditReady: true,
    },
  });
  assert.equal(cap.enabled, true);
  assert.equal(cap.ready, false);
  assert.equal(cap.state, 'not_ready');
}

{
  const policy = {};
  for (const cls of HSI_REQUIRED_RETENTION_CLASSES) policy[cls] = 5;
  const parsed = parseHsiRetentionPolicy({ GBS_HSI_RETENTION_POLICY_JSON: JSON.stringify(policy) });
  assert.equal(parsed.ready, true);
  const missing = parseHsiRetentionPolicy({});
  assert.equal(missing.ready, false);
  const partial = parseHsiRetentionPolicy({ GBS_HSI_RETENTION_POLICY_JSON: '{"unused_upload":5}' });
  assert.equal(partial.ready, false, 'missing class does not default');
}

{
  const cap = await isHsiDocumentCapabilityReady({
    env: {
      GBS_HSI_DOCUMENTS_ENABLED: '1',
      NODE_ENV: 'production',
      VAULT_DEV_MODE: '1',
    },
    probes: {
      scannerHealthy: true,
      storageHealthy: true,
      kmsHealthy: true,
      scanExecutorHealthy: true,
      auditReady: true,
    },
  });
  assert.equal(cap.ready, false, 'prod + vault dev is not ready');
}

console.log('phase17d8b2aHsiCapability.test.js: assertions passed');
