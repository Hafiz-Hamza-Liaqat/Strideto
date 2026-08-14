import { asyncHandler } from '../utils/asyncHandler.js';
import { consumeRealmVerificationToken, publicEmailVerifyFailure } from '../services/auth/realmEmailVerification.js';

const REALMS = new Set(['user', 'employer', 'agent', 'institution']);

export const verifyRealmEmail = asyncHandler(async (req, res) => {
  const realm = String(req.params.realm || req.query.realm || req.body?.realm || 'user').trim();
  const token = String(req.query.token || req.body?.token || '').trim();
  if (!REALMS.has(realm)) {
    const failure = publicEmailVerifyFailure('REALM_MISMATCH');
    return res.status(failure.status).json(failure.body);
  }
  if (!token) {
    const failure = publicEmailVerifyFailure('TOKEN_INVALID');
    return res.status(failure.status).json({
      error: 'This verification link is invalid or has expired. Request a new verification link.',
      code: 'INVALID_OR_EXPIRED',
    });
  }
  const result = await consumeRealmVerificationToken(realm, token);
  if (!result.ok) {
    const failure = publicEmailVerifyFailure(result.code);
    return res.status(failure.status).json(failure.body);
  }
  return res.json({ message: 'Email verified successfully', emailVerified: true, realm: result.realm });
});
