/**
 * Tab-local expected identity. sessionStorage is tab-scoped.
 * Stores only realm + opaque subject id — never tokens or PII.
 */
const PREFIX = 'strideto-tab-identity:';

const REALMS = new Set(['user', 'agent', 'employer', 'institution']);

function keyFor(realm) {
  return `${PREFIX}${realm}`;
}

export function readTabIdentity(realm) {
  if (!REALMS.has(realm)) return null;
  try {
    const raw = sessionStorage.getItem(keyFor(realm));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const subjectId = String(parsed?.subjectId || '');
    if (!subjectId || parsed?.realm !== realm) return null;
    return { realm, subjectId };
  } catch {
    return null;
  }
}

export function bindTabIdentity(realm, subjectId) {
  if (!REALMS.has(realm)) return;
  const id = String(subjectId || '');
  if (!id) return;
  try {
    sessionStorage.setItem(keyFor(realm), JSON.stringify({ realm, subjectId: id }));
  } catch {
    /* private mode / quota */
  }
}

export function clearTabIdentity(realm) {
  if (!REALMS.has(realm)) return;
  try {
    sessionStorage.removeItem(keyFor(realm));
  } catch {
    /* ignore */
  }
}

/**
 * @returns {'missing' | 'match' | 'mismatch'}
 */
export function compareTabIdentity(realm, subjectId) {
  const expected = readTabIdentity(realm);
  const actual = String(subjectId || '');
  if (!expected) return 'missing';
  if (!actual) return 'mismatch';
  return expected.subjectId === actual ? 'match' : 'mismatch';
}
