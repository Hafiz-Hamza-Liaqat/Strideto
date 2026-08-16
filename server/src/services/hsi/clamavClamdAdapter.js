/**
 * Official ClamAV clamd adapter — private TCP INSTREAM protocol.
 *
 * No REST wrapper. No shell-exec of user input. No process-local clamd.
 * `clean` means only: no known ClamAV signature match on that scan.
 */
import net from 'node:net';
import { HSI_CLAMAV_VERDICTS } from '../../../../shared/gbs/hsiSecurity.js';

const CHUNK = 8192;

function fail(code, extra = {}) {
  return { verdict: HSI_CLAMAV_VERDICTS.FAILED, code, signature: null, ...extra };
}

export function mapClamdResponse(raw) {
  if (raw == null) return fail('malformed_verdict');
  const text = String(raw).replace(/\0/g, '').trim();
  if (!text) return fail('malformed_verdict');
  if (/\bFOUND\b/i.test(text)) {
    const signature = text.replace(/^.*:\s*/i, '').replace(/\s+FOUND\s*$/i, '').trim() || 'FOUND';
    return {
      verdict: HSI_CLAMAV_VERDICTS.REJECTED,
      code: 'found',
      signature: signature.slice(0, 120),
    };
  }
  if (/\bERROR\b/i.test(text)) return fail('scanner_error', { detail: 'error' });
  if (/:\s*OK\s*$/i.test(text) || /^stream:\s*OK$/i.test(text) || text === 'OK') {
    return { verdict: HSI_CLAMAV_VERDICTS.CLEAN, code: 'ok', signature: null };
  }
  return fail('malformed_verdict');
}

function connectSocket({ host, port, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      const err = new Error('clamd_timeout');
      err.code = 'timeout';
      reject(err);
    }, timeoutMs);
    socket.once('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.once('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function readUntilEnd(socket, timeoutMs) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const timer = setTimeout(() => {
      socket.destroy();
      const err = new Error('clamd_timeout');
      err.code = 'timeout';
      reject(err);
    }, timeoutMs);
    socket.on('data', (buf) => chunks.push(buf));
    socket.on('end', () => {
      clearTimeout(timer);
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    socket.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function withSocket(options, fn) {
  const socket = await connectSocket(options);
  try {
    return await fn(socket);
  } finally {
    socket.end();
    socket.destroy();
  }
}

export async function clamdPing({ host, port, timeoutMs = 5000 } = {}) {
  try {
    const raw = await withSocket({ host, port, timeoutMs }, async (socket) => {
      const pending = readUntilEnd(socket, timeoutMs);
      socket.write('nPING\n');
      return pending;
    });
    return String(raw).replace(/\0/g, '').trim() === 'PONG';
  } catch {
    return false;
  }
}

export async function clamdVersion({ host, port, timeoutMs = 5000 } = {}) {
  const raw = await withSocket({ host, port, timeoutMs }, async (socket) => {
    const pending = readUntilEnd(socket, timeoutMs);
    socket.write('nVERSION\n');
    return pending;
  });
  return String(raw).replace(/\0/g, '').trim();
}

export function isClamdSignatureDatabaseReady(versionText) {
  if (typeof versionText !== 'string' || !versionText) return false;
  // Official VERSION: "ClamAV 1.x.x/27000/Mon Jan 1 00:00:00 2024"
  return /ClamAV\s+\d+/i.test(versionText) && /\/\d{3,}\//.test(versionText);
}

export async function clamdInstream(buffer, {
  host,
  port,
  timeoutMs = 30_000,
  maxStreamBytes = 40 * 1024 * 1024,
} = {}) {
  if (!Buffer.isBuffer(buffer)) return fail('size_protocol_failure');
  if (buffer.length < 1 || buffer.length > maxStreamBytes) return fail('size_protocol_failure');
  try {
    const raw = await withSocket({ host, port, timeoutMs }, async (socket) => {
      const pending = readUntilEnd(socket, timeoutMs);
      socket.write('zINSTREAM\0');
      for (let offset = 0; offset < buffer.length; offset += CHUNK) {
        const slice = buffer.subarray(offset, Math.min(offset + CHUNK, buffer.length));
        const header = Buffer.alloc(4);
        header.writeUInt32BE(slice.length, 0);
        socket.write(header);
        socket.write(slice);
      }
      const zero = Buffer.alloc(4);
      socket.write(zero);
      return pending;
    });
    return mapClamdResponse(raw);
  } catch (err) {
    if (err?.code === 'timeout' || err?.message === 'clamd_timeout') {
      return { verdict: HSI_CLAMAV_VERDICTS.TIMEOUT, code: 'timeout', signature: null };
    }
    return fail('connection_failure');
  }
}

export async function probeClamdHealth(options = {}) {
  try {
    const pong = await clamdPing(options);
    if (!pong) {
      return { healthy: false, reason: 'ping_failed', version: null };
    }
    const version = await clamdVersion(options);
    if (!isClamdSignatureDatabaseReady(version)) {
      return { healthy: false, reason: 'signatures_unavailable', version };
    }
    const instream = await clamdInstream(Buffer.from('%PDF-1.4\n'), options);
    if (instream.verdict !== HSI_CLAMAV_VERDICTS.CLEAN && instream.verdict !== HSI_CLAMAV_VERDICTS.REJECTED) {
      return { healthy: false, reason: 'scan_command_failed', version };
    }
    return { healthy: true, reason: null, version };
  } catch {
    return { healthy: false, reason: 'connection_failure', version: null };
  }
}
