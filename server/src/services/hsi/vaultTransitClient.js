/**
 * HashiCorp Vault Transit client (backend only).
 *
 * Wrap/unwrap DEKs. Never persist KEK. Never log tokens.
 * Vault dev mode is TEST ONLY and is refused in production.
 */
import { isInsecureHsiCredential } from '../../config/hsiSecurityConfig.js';

function deny(code, status = 503) {
  const err = new Error(code);
  err.code = code;
  err.status = status;
  throw err;
}

function assertUsable(vault = {}, { nodeEnv } = {}) {
  if (nodeEnv === 'production' && vault.devMode) {
    deny('document_kms_unavailable');
  }
  if (!vault.addr || !vault.transitKeyName || isInsecureHsiCredential(vault.token)) {
    deny('document_kms_unavailable');
  }
}

async function vaultRequest(vault, method, path, body) {
  const url = `${String(vault.addr).replace(/\/$/, '')}${path}`;
  const headers = {
    'X-Vault-Token': vault.token,
    'Content-Type': 'application/json',
  };
  if (vault.namespace) headers['X-Vault-Namespace'] = vault.namespace;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), vault.timeoutMs || 8000);
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body == null ? undefined : JSON.stringify(body),
      signal: ac.signal,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      deny('document_kms_unavailable');
    }
    return json;
  } catch (err) {
    if (err?.code === 'document_kms_unavailable') throw err;
    deny('document_kms_unavailable');
  } finally {
    clearTimeout(timer);
  }
}

export async function wrapDataKey(vault, dek, { context, nodeEnv } = {}) {
  assertUsable(vault, { nodeEnv });
  if (!Buffer.isBuffer(dek) || dek.length !== 32) deny('document_encryption_failed', 500);
  const json = await vaultRequest(vault, 'POST', `/v1/transit/encrypt/${encodeURIComponent(vault.transitKeyName)}`, {
    plaintext: dek.toString('base64'),
    context: Buffer.isBuffer(context) ? context.toString('base64') : undefined,
  });
  const ciphertext = json?.data?.ciphertext;
  const keyVersion = json?.data?.key_version;
  if (typeof ciphertext !== 'string' || !ciphertext.startsWith('vault:')) {
    deny('document_kms_unavailable');
  }
  return {
    wrappedDek: ciphertext,
    keyVersion: keyVersion == null ? null : Number(keyVersion),
    transitKeyName: vault.transitKeyName,
  };
}

export async function unwrapDataKey(vault, wrappedDek, { context, nodeEnv } = {}) {
  assertUsable(vault, { nodeEnv });
  if (typeof wrappedDek !== 'string' || !wrappedDek.startsWith('vault:')) {
    deny('document_kms_unavailable');
  }
  const json = await vaultRequest(vault, 'POST', `/v1/transit/decrypt/${encodeURIComponent(vault.transitKeyName)}`, {
    ciphertext: wrappedDek,
    context: Buffer.isBuffer(context) ? context.toString('base64') : undefined,
  });
  const b64 = json?.data?.plaintext;
  if (typeof b64 !== 'string') deny('document_kms_unavailable');
  const dek = Buffer.from(b64, 'base64');
  if (dek.length !== 32) deny('document_kms_unavailable');
  return dek;
}

export async function probeVaultTransitHealth(vault, { nodeEnv } = {}) {
  try {
    if (nodeEnv === 'production' && vault.devMode) {
      return { healthy: false, reason: 'dev_mode_forbidden' };
    }
    if (!vault.addr || !vault.transitKeyName || isInsecureHsiCredential(vault.token)) {
      return { healthy: false, reason: 'not_configured' };
    }
    const json = await vaultRequest(vault, 'GET', `/v1/transit/keys/${encodeURIComponent(vault.transitKeyName)}`);
    const name = json?.data?.name || json?.data?.latest_version;
    if (!name && json?.data?.latest_version == null) {
      return { healthy: false, reason: 'key_missing' };
    }
    return { healthy: true, reason: null, testOnlyDevMode: vault.devMode === true };
  } catch {
    return { healthy: false, reason: 'unavailable' };
  }
}

export async function ensureTransitMount(vault, { nodeEnv } = {}) {
  if (nodeEnv === 'production' && vault.devMode) {
    deny('document_kms_unavailable');
  }
  try {
    await vaultRequest(vault, 'GET', '/v1/sys/mounts/transit');
    return { created: false };
  } catch {
    await vaultRequest(vault, 'POST', '/v1/sys/mounts/transit', { type: 'transit' });
    return { created: true };
  }
}

export async function ensureTransitKey(vault, { nodeEnv } = {}) {
  assertUsable(vault, { nodeEnv });
  try {
    await vaultRequest(vault, 'GET', `/v1/transit/keys/${encodeURIComponent(vault.transitKeyName)}`);
    return { created: false };
  } catch {
    await vaultRequest(vault, 'POST', `/v1/transit/keys/${encodeURIComponent(vault.transitKeyName)}`, {
      type: 'aes256-gcm96',
      derived: true,
    });
    return { created: true };
  }
}
