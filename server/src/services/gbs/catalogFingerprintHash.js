import { createHash } from 'node:crypto';
import { catalogFingerprintCanonical } from '../../../../shared/gbs/catalogFingerprint.js';

export function hashCatalogFingerprint(record) {
  return createHash('sha256').update(catalogFingerprintCanonical(record)).digest('hex');
}
