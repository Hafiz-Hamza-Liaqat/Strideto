const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = LEVELS[process.env.LOG_LEVEL || 'info'] ?? LEVELS.info;

const SENSITIVE_KEY =
  /password|passwd|secret|token|authorization|cookie|refresh|jwt|mongo_uri|database_url|stripe|cvv|pan|apikey|api_key|private_key|webhook/i;

function redactString(value) {
  if (typeof value !== 'string') return value;
  return value
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/mongodb(\+srv)?:\/\/[^@\s]+@/gi, 'mongodb$1://***@')
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9._-]+/g, '[redacted-jwt]');
}

export function redactMeta(meta, depth = 0) {
  if (meta == null) return meta;
  if (typeof meta === 'string') return redactString(meta);
  if (typeof meta !== 'object' || depth > 5) return meta;
  if (Array.isArray(meta)) return meta.map((item) => redactMeta(item, depth + 1));
  const out = {};
  for (const [key, value] of Object.entries(meta)) {
    if (SENSITIVE_KEY.test(key)) out[key] = '[redacted]';
    else out[key] = redactMeta(value, depth + 1);
  }
  return out;
}

function log(level, message, meta = {}) {
  if (LEVELS[level] > currentLevel) return;
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...redactMeta(meta),
  };
  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  error: (msg, meta) => log('error', msg, meta),
  warn: (msg, meta) => log('warn', msg, meta),
  info: (msg, meta) => log('info', msg, meta),
  debug: (msg, meta) => log('debug', msg, meta),
};
