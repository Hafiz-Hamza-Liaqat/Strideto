/**
 * UX-only last-used Provider subject/workspace.
 * Never grants membership, domain, capability, or verification.
 */
export const PROVIDER_WORKSPACE_PREF_KEY = 'strideto-provider-workspace';

export function readProviderWorkspacePref() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PROVIDER_WORKSPACE_PREF_KEY) || 'null');
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.subjectType || !parsed.subjectId) return null;
    return {
      subjectType: String(parsed.subjectType),
      subjectId: String(parsed.subjectId),
      domainId: parsed.domainId ? String(parsed.domainId) : null,
    };
  } catch {
    return null;
  }
}

export function writeProviderWorkspacePref(next) {
  if (!next?.subjectType || !next?.subjectId) return;
  try {
    localStorage.setItem(PROVIDER_WORKSPACE_PREF_KEY, JSON.stringify({
      subjectType: String(next.subjectType),
      subjectId: String(next.subjectId),
      domainId: next.domainId ? String(next.domainId) : null,
    }));
  } catch {
    /* UX only */
  }
}

export function subjectKey(row) {
  return `${row.subjectType}:${row.subjectId}`;
}

export function uniqueProviderSubjects(workspaces = []) {
  const map = new Map();
  for (const row of workspaces) {
    const key = subjectKey(row);
    if (!map.has(key)) {
      map.set(key, {
        subjectType: row.subjectType,
        subjectId: row.subjectId,
        kind: row.kind,
        label: row.label,
      });
    }
  }
  return [...map.values()];
}

export function workspacesForSubject(workspaces = [], subject) {
  if (!subject?.subjectType || !subject?.subjectId) return [];
  return workspaces.filter(
    (row) => row.subjectType === subject.subjectType && String(row.subjectId) === String(subject.subjectId)
  );
}

export function authorizedDomainIdsForSubject(workspaces, subject) {
  return [...new Set(workspacesForSubject(workspaces, subject).map((row) => row.domainId))];
}

export function withProviderSubject(path, subject) {
  if (!path) return path;
  if (!subject?.subjectType || !subject?.subjectId) return path;
  const hashIndex = path.indexOf('#');
  const hash = hashIndex >= 0 ? path.slice(hashIndex) : '';
  const withoutHash = hashIndex >= 0 ? path.slice(0, hashIndex) : path;
  const qIndex = withoutHash.indexOf('?');
  const pathname = qIndex >= 0 ? withoutHash.slice(0, qIndex) : withoutHash;
  const search = qIndex >= 0 ? withoutHash.slice(qIndex + 1) : '';
  const params = new URLSearchParams(search);
  params.set('subjectType', String(subject.subjectType));
  params.set('subjectId', String(subject.subjectId));
  const nextSearch = params.toString();
  return `${pathname}?${nextSearch}${hash}`;
}

export function kindLabel(kind) {
  if (kind === 'agency' || kind === 'organization') return 'Agency';
  return 'Independent';
}
