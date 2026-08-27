/**
 * Client mirror of shared staged-workspace launch gates.
 * Presentation only — private APIs remain server-authoritative.
 *
 * Student and Employer are permanently active (helpers always true).
 * Only Institution / Education & Mobility / Business Services read Vite flags.
 */
import {
  WORKSPACE_LAUNCH_IDS,
  WORKSPACE_LAUNCH_ERROR_CODE,
  WORKSPACE_LAUNCH_META,
  getWorkspaceLaunchMeta,
  getWorkspaceLaunchState,
  isWorkspaceLaunched as sharedIsWorkspaceLaunched,
} from '@shared/launch/workspaceLaunchGates.js';

function clientLaunchEnv() {
  const env = typeof import.meta !== 'undefined' ? import.meta.env : {};
  return {
    VITE_WORKSPACE_LAUNCH_INSTITUTION: env?.VITE_WORKSPACE_LAUNCH_INSTITUTION,
    VITE_WORKSPACE_LAUNCH_EDUCATION_MOBILITY: env?.VITE_WORKSPACE_LAUNCH_EDUCATION_MOBILITY,
    VITE_WORKSPACE_LAUNCH_BUSINESS_SERVICES: env?.VITE_WORKSPACE_LAUNCH_BUSINESS_SERVICES,
  };
}

export {
  WORKSPACE_LAUNCH_IDS,
  WORKSPACE_LAUNCH_ERROR_CODE,
  WORKSPACE_LAUNCH_META,
  getWorkspaceLaunchMeta,
};

export function isWorkspaceLaunched(workspaceId) {
  return sharedIsWorkspaceLaunched(workspaceId, clientLaunchEnv());
}

export function getClientWorkspaceLaunchState() {
  return getWorkspaceLaunchState(clientLaunchEnv());
}

/** Permanently active in this phase — env cannot disable. */
export function isStudentWorkspaceLaunched() {
  return true;
}

/** Permanently active in this phase — env cannot disable. */
export function isEmployerWorkspaceLaunched() {
  return true;
}

export function isInstitutionWorkspaceLaunched() {
  return isWorkspaceLaunched(WORKSPACE_LAUNCH_IDS.INSTITUTION);
}

export function isEducationMobilityWorkspaceLaunched() {
  return isWorkspaceLaunched(WORKSPACE_LAUNCH_IDS.EDUCATION_MOBILITY);
}

export function isBusinessServicesWorkspaceLaunched() {
  return isWorkspaceLaunched(WORKSPACE_LAUNCH_IDS.BUSINESS_SERVICES);
}

export function isAnyProviderWorkspaceLaunched() {
  return isEducationMobilityWorkspaceLaunched() || isBusinessServicesWorkspaceLaunched();
}
