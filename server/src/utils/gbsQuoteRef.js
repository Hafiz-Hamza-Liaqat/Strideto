import { randomBytes } from 'node:crypto';
import { GBS_QUOTE_BOUNDS, isOpaqueQuoteRef } from '../../../shared/gbs/quoteContract.js';

export function generatePublicQuoteRef() {
  return randomBytes(18).toString('base64url').slice(0, GBS_QUOTE_BOUNDS.REF_MAX);
}

export { isOpaqueQuoteRef };
