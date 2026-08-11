import { randomUUID } from 'node:crypto';

const INCOMING_ID = /^[A-Za-z0-9._-]{8,128}$/;

/**
 * Correlate each request without accepting attacker-controlled unbounded IDs.
 * Honors a well-formed incoming X-Request-Id; otherwise issues a UUID.
 */
export function requestId(req, res, next) {
  const incoming = req.headers['x-request-id'];
  const id =
    typeof incoming === 'string' && INCOMING_ID.test(incoming) ? incoming : randomUUID();
  req.id = id;
  res.setHeader('X-Request-Id', id);
  next();
}
