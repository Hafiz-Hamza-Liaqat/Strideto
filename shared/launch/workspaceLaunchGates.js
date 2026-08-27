/**
 * Central staged-workspace launch truth (STRIDETO).
 *
 * Single source of truth for which private workspaces are publicly active.
 * Unlock is manual via env flags only — never calendar/time auto-unlock.
 *
 * Defaults (safe for current production stage):
 *   student            → ALWAYS ENABLED (not staged; env cannot disable)
 *   employer           → ALWAYS ENABLED (not staged; env cannot disable)
 *   institution        → DISABLED (Coming Soon) until WORKSPACE_LAUNCH_INSTITUTION=1
 *   education_mobility → DISABLED (Coming Soon) until WORKSPACE_LAUNCH_EDUCATION_MOBILITY=1
 *   business_services  → DISABLED (Coming Soon) until WORKSPACE_LAUNCH_BUSINESS_SERVICES=1
 *
 * Server is authoritative for private APIs. Client may mirror the same staged keys
 * (including VITE_WORKSPACE_LAUNCH_* aliases) for route/CTA presentation only.
 */

export const WORKSPACE_LAUNCH_SCHEMA_VERSION = '1.0';

export const WORKSPACE_LAUNCH_IDS = Object.freeze({
  STUDENT: 'student',
  EMPLOYER: 'employer',
  INSTITUTION: 'institution',
  EDUCATION_MOBILITY: 'education_mobility',
  BUSINESS_SERVICES: 'business_services',
});

/** Machine-readable API / client code for launch-disabled private workspaces. */
export const WORKSPACE_LAUNCH_ERROR_CODE = 'WORKSPACE_COMING_SOON';

/**
 * Only staged workspaces have rollout env keys.
 * Student and Employer are permanently active in this phase — no env toggles.
 */
export const WORKSPACE_LAUNCH_ENV_KEYS = Object.freeze({
  [WORKSPACE_LAUNCH_IDS.INSTITUTION]: 'WORKSPACE_LAUNCH_INSTITUTION',
  [WORKSPACE_LAUNCH_IDS.EDUCATION_MOBILITY]: 'WORKSPACE_LAUNCH_EDUCATION_MOBILITY',
  [WORKSPACE_LAUNCH_IDS.BUSINESS_SERVICES]: 'WORKSPACE_LAUNCH_BUSINESS_SERVICES',
});

/** Permanently active workspaces (not staged; cannot be disabled via env). */
const PERMANENTLY_ACTIVE = new Set([
  WORKSPACE_LAUNCH_IDS.STUDENT,
  WORKSPACE_LAUNCH_IDS.EMPLOYER,
]);

/** Staged workspaces that default OFF unless explicitly set to "1". */
const STAGED_DEFAULT_DISABLED = new Set([
  WORKSPACE_LAUNCH_IDS.INSTITUTION,
  WORKSPACE_LAUNCH_IDS.EDUCATION_MOBILITY,
  WORKSPACE_LAUNCH_IDS.BUSINESS_SERVICES,
]);

export const WORKSPACE_LAUNCH_META = Object.freeze({
  [WORKSPACE_LAUNCH_IDS.STUDENT]: Object.freeze({
    id: WORKSPACE_LAUNCH_IDS.STUDENT,
    label: 'Student',
    description: 'Student career dashboard, applications, vault, and discovery tools.',
  }),
  [WORKSPACE_LAUNCH_IDS.EMPLOYER]: Object.freeze({
    id: WORKSPACE_LAUNCH_IDS.EMPLOYER,
    label: 'Employer',
    description: 'Post jobs, review applicants, and manage hiring through the employer workspace.',
  }),
  [WORKSPACE_LAUNCH_IDS.INSTITUTION]: Object.freeze({
    id: WORKSPACE_LAUNCH_IDS.INSTITUTION,
    label: 'Institution',
    description:
      'Manage your institution presence, programs, scholarships, admissions data, and verified education information.',
  }),
  [WORKSPACE_LAUNCH_IDS.EDUCATION_MOBILITY]: Object.freeze({
    id: WORKSPACE_LAUNCH_IDS.EDUCATION_MOBILITY,
    label: 'Education & Mobility',
    description:
      'Professional Education & Mobility workspace for profiles, consultations, student support, and education services.',
  }),
  [WORKSPACE_LAUNCH_IDS.BUSINESS_SERVICES]: Object.freeze({
    id: WORKSPACE_LAUNCH_IDS.BUSINESS_SERVICES,
    label: 'Business Formation & Corporate Services',
    description:
      'Business Formation & Corporate Services provider workspace for listings, service requests, quotes, and cases.',
  }),
});

const KNOWN = new Set(Object.values(WORKSPACE_LAUNCH_IDS));

export function isKnownWorkspaceLaunchId(value) {
  return typeof value === 'string' && KNOWN.has(value);
}

export function isPermanentlyActiveWorkspace(workspaceId) {
  return PERMANENTLY_ACTIVE.has(workspaceId);
}

/**
 * Normalize env bags so WORKSPACE_LAUNCH_* and VITE_WORKSPACE_LAUNCH_* both work.
 * Request body/query/header values must never be passed here as overrides.
 * Only staged workspace keys are read.
 */
export function normalizeWorkspaceLaunchEnv(env) {
  const source = env && typeof env === 'object' ? env : {};
  const out = {};
  for (const [workspaceId, key] of Object.entries(WORKSPACE_LAUNCH_ENV_KEYS)) {
    const viteKey = `VITE_${key}`;
    const raw = source[key] ?? source[viteKey];
    if (raw !== undefined && raw !== null && String(raw).length > 0) {
      out[key] = String(raw);
    }
    void workspaceId;
  }
  return out;
}

function readFlag(normalized, workspaceId) {
  const key = WORKSPACE_LAUNCH_ENV_KEYS[workspaceId];
  if (!key) return undefined;
  return normalized[key];
}

/**
 * Deterministic launch check. Ignores unknown IDs (returns false).
 * Does not consult calendar time or request context.
 * Student/Employer always return true regardless of env.
 */
export function isWorkspaceLaunched(workspaceId, env) {
  if (!isKnownWorkspaceLaunchId(workspaceId)) return false;
  if (PERMANENTLY_ACTIVE.has(workspaceId)) return true;

  const normalized = normalizeWorkspaceLaunchEnv(
    env || (typeof process !== 'undefined' ? process.env : {})
  );
  const raw = readFlag(normalized, workspaceId);

  if (STAGED_DEFAULT_DISABLED.has(workspaceId)) {
    return raw === '1';
  }
  return false;
}

export function getWorkspaceLaunchState(env) {
  const state = {};
  for (const id of Object.values(WORKSPACE_LAUNCH_IDS)) {
    state[id] = isWorkspaceLaunched(id, env);
  }
  return Object.freeze(state);
}

export function getWorkspaceLaunchMeta(workspaceId) {
  if (!isKnownWorkspaceLaunchId(workspaceId)) return null;
  return WORKSPACE_LAUNCH_META[workspaceId];
}

/** Stable JSON body for private API launch denials. */
export function workspaceComingSoonBody(workspaceId) {
  const meta = getWorkspaceLaunchMeta(workspaceId);
  return Object.freeze({
    error: 'This workspace is coming soon',
    code: WORKSPACE_LAUNCH_ERROR_CODE,
    workspace: isKnownWorkspaceLaunchId(workspaceId) ? workspaceId : undefined,
    label: meta?.label,
  });
}
