/**
 * Non-sensitive public workspace preference (Phase 17D-0).
 *
 * Stored value is only: student | employer | agent | institution.
 * It is NOT security authority. Authenticated UI requires the matching
 * realm's in-memory access token + authoritative /me (or equivalent).
 *
 * Within the User cookie realm (`student` key historically), display labels
 * and default href follow server capabilities + UX-only user workspace mode.
 */
import { ROUTES } from '../constants';
import {
  pathHintForUserWorkspace,
  readUserCapabilities,
  readUserWorkspacePreference,
  resolveUserWorkspaceMode,
  userWorkspacePresentation,
} from './userCapabilityWorkspace';

export const ACTIVE_WORKSPACE_STORAGE_KEY = 'strideto-active-workspace';
export const ACTIVE_WORKSPACE_EVENT = 'strideto-active-workspace';

export const WORKSPACE_REALMS = Object.freeze(['student', 'employer', 'agent', 'institution']);

export const WORKSPACE_DESTINATIONS = Object.freeze({
  student: Object.freeze({
    workspace: ROUTES.DASHBOARD,
    settings: `${ROUTES.PROFILE}#account-settings`,
    notifications: ROUTES.NOTIFICATIONS,
    help: ROUTES.STUDENT_HELP,
    login: ROUTES.LOGIN,
    roleLabel: 'Student',
    workspaceLabel: 'My Workspace',
  }),
  employer: Object.freeze({
    workspace: ROUTES.EMPLOYER_DASHBOARD,
    settings: ROUTES.EMPLOYER_SETTINGS,
    notifications: ROUTES.EMPLOYER_NOTIFICATIONS,
    help: ROUTES.EMPLOYER_HELP,
    login: ROUTES.EMPLOYER_LOGIN,
    roleLabel: 'Employer',
    workspaceLabel: 'Employer Workspace',
  }),
  agent: Object.freeze({
    workspace: ROUTES.AGENT_DASHBOARD,
    settings: ROUTES.AGENT_SETTINGS,
    notifications: ROUTES.AGENT_NOTIFICATIONS,
    help: ROUTES.AGENT_HELP,
    login: ROUTES.AGENT_LOGIN,
    roleLabel: 'Agent',
    workspaceLabel: 'Agent Workspace',
  }),
  institution: Object.freeze({
    workspace: ROUTES.INSTITUTION_DASHBOARD,
    settings: ROUTES.INSTITUTION_SETTINGS,
    notifications: ROUTES.INSTITUTION_NOTIFICATIONS,
    help: ROUTES.INSTITUTION_HELP,
    login: ROUTES.INSTITUTION_LOGIN,
    roleLabel: 'Institution',
    workspaceLabel: 'Institution Workspace',
  }),
});

export function isWorkspaceRealm(value) {
  return WORKSPACE_REALMS.includes(value);
}

export function readActiveWorkspacePreference() {
  try {
    const raw = localStorage.getItem(ACTIVE_WORKSPACE_STORAGE_KEY);
    return isWorkspaceRealm(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function writeActiveWorkspacePreference(realm) {
  if (!isWorkspaceRealm(realm)) return;
  try {
    localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, realm);
  } catch {
    /* private mode */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ACTIVE_WORKSPACE_EVENT, { detail: realm }));
  }
}

export function clearActiveWorkspacePreference() {
  try {
    localStorage.removeItem(ACTIVE_WORKSPACE_STORAGE_KEY);
  } catch {
    /* private mode */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ACTIVE_WORKSPACE_EVENT, { detail: null }));
  }
}

export function clearActiveWorkspacePreferenceIfRealm(realm) {
  if (readActiveWorkspacePreference() === realm) clearActiveWorkspacePreference();
}

export function publicSafeAvatarUrl(value) {
  const s = String(value || '').trim();
  if (!s) return '';
  if (s.startsWith('/') && !s.startsWith('//') && !s.includes('://')) return s;
  try {
    const u = new URL(s);
    if (u.protocol === 'http:' || u.protocol === 'https:') return s;
  } catch {
    return '';
  }
  return '';
}

function destinationsFor(realm) {
  return WORKSPACE_DESTINATIONS[realm] || WORKSPACE_DESTINATIONS.student;
}

export function guestWorkspaceIdentity() {
  return {
    realm: 'guest',
    displayName: '',
    organizationName: '',
    roleLabel: '',
    verifiedLabel: '',
    avatarUrl: '',
    workspaceHref: '',
    settingsHref: '',
    helpHref: '',
    notificationsHref: '',
    loginHref: ROUTES.LOGIN,
    isAuthenticated: false,
  };
}

/**
 * User-realm identity projection. Auth preference realm key remains `student`
 * (User cookie). roleLabel / workspaceHref follow server capabilities + UX mode.
 */
export function projectStudentIdentity(user, options = {}) {
  if (!user) return null;
  const dest = destinationsFor('student');
  const caps = readUserCapabilities(user);
  const preference = options.modePreference ?? readUserWorkspacePreference();
  const pathHint = options.pathHint ?? pathHintForUserWorkspace(options.pathname);
  const mode = resolveUserWorkspaceMode(caps, preference, pathHint);
  const presentation = userWorkspacePresentation(mode);
  const displayName = String(user.name || '').trim() || presentation.roleLabel;
  return {
    realm: 'student',
    displayName,
    organizationName: '',
    roleLabel: presentation.roleLabel,
    verifiedLabel: '',
    avatarUrl: publicSafeAvatarUrl(user.avatarUrl || user.avatar),
    workspaceHref: presentation.workspaceHref,
    settingsHref: dest.settings,
    helpHref: dest.help,
    notificationsHref: dest.notifications,
    loginHref: dest.login,
    isAuthenticated: true,
    userWorkspace: mode,
    capabilities: caps.active,
    hasStudentCapability: caps.student,
    hasBusinessClientCapability: caps.businessClient,
  };
}

export function projectEmployerIdentity(employer) {
  if (!employer) return null;
  const dest = destinationsFor('employer');
  const organizationName = String(employer.organizationName || employer.companyName || '').trim();
  const displayName = organizationName || dest.roleLabel;
  const verified = employer.verified === true || employer.verificationStatus === 'approved';
  return {
    realm: 'employer',
    displayName,
    organizationName,
    roleLabel: dest.roleLabel,
    verifiedLabel: verified ? 'Verified Employer' : '',
    avatarUrl: publicSafeAvatarUrl(employer.logoUrl),
    workspaceHref: dest.workspace,
    settingsHref: dest.settings,
    helpHref: dest.help,
    notificationsHref: dest.notifications,
    loginHref: dest.login,
    isAuthenticated: true,
  };
}

export function projectAgentIdentity(agent) {
  if (!agent) return null;
  const dest = destinationsFor('agent');
  const isAgency = agent.agentType === 'agency';
  const roleLabel = isAgency ? 'Agency' : dest.roleLabel;
  const organizationName = String(agent.professionalName || agent.displayName || '').trim();
  const displayName = organizationName || roleLabel;
  const verified = agent.profileStatus === 'approved';
  return {
    realm: 'agent',
    displayName,
    organizationName,
    roleLabel,
    verifiedLabel: verified ? (isAgency ? 'Verified Agent' : 'Verified Agent') : '',
    avatarUrl: '',
    workspaceHref: dest.workspace,
    settingsHref: dest.settings,
    helpHref: dest.help,
    notificationsHref: dest.notifications,
    loginHref: dest.login,
    isAuthenticated: true,
  };
}

export function projectInstitutionIdentity(session) {
  const account = session?.account;
  if (!account) return null;
  const dest = destinationsFor('institution');
  const membership = Array.isArray(session.memberships) ? session.memberships[0] : session.membership;
  const organizationName = String(membership?.organizationName || '').trim();
  const displayName = organizationName || dest.roleLabel;
  return {
    realm: 'institution',
    displayName,
    organizationName,
    roleLabel: dest.roleLabel,
    verifiedLabel: '',
    avatarUrl: '',
    workspaceHref: dest.workspace,
    settingsHref: dest.settings,
    helpHref: dest.help,
    notificationsHref: dest.notifications,
    loginHref: dest.login,
    isAuthenticated: true,
  };
}
