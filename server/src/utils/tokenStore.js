import crypto from 'crypto';

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function hashResetToken(token) {
  return hashToken(token);
}
