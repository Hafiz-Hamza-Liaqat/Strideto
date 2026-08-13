import { asyncHandler } from '../utils/asyncHandler.js';
import { consumeRealmVerificationToken } from '../services/auth/realmEmailVerification.js';

const REALMS = new Set(['user', 'employer', 'agent', 'institution']);

export const verifyRealmEmail = asyncHandler(async (req, res) => {
  const realm = String(req.params.realm || req.query.realm || req.body?.realm || 'user').trim();
  const token = String(req.query.token || req.body?.token || '').trim();
  if (!REALMS.has(realm)) {
    return res.status(400).json({ error: 'Invalid verification realm' });
  }
  if (!token) {
    return res.status(400).json({ error: 'Verification token is required' });
  }
  const result = await consumeRealmVerificationToken(realm, token);
  if (!result.ok) {
    return res.status(400).json({ error: 'Invalid or expired verification link' });
  }
  return res.json({ message: 'Email verified successfully', emailVerified: true, realm: result.realm });
});
