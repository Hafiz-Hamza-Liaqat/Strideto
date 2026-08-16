import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useEmployerAuth } from './EmployerAuthContext';
import { useAgentAuth } from './AgentAuthContext';
import { useInstitutionAuth } from './InstitutionAuthContext';
import { onSessionExpired } from '../auth/sessionExpired';
import { getAccessToken } from '../services/axiosBase';
import {
  ACTIVE_WORKSPACE_EVENT,
  WORKSPACE_DESTINATIONS,
  WORKSPACE_REALMS,
  clearActiveWorkspacePreference,
  clearActiveWorkspacePreferenceIfRealm,
  guestWorkspaceIdentity,
  projectAgentIdentity,
  projectEmployerIdentity,
  projectInstitutionIdentity,
  projectStudentIdentity,
  readActiveWorkspacePreference,
  writeActiveWorkspacePreference,
} from '../auth/activeWorkspace';

const ActiveWorkspaceContext = createContext(null);

function mapRealmToSessionExpired(expiredRealm) {
  if (expiredRealm === 'user') return 'student';
  if (expiredRealm === 'employer' || expiredRealm === 'agent' || expiredRealm === 'institution') {
    return expiredRealm;
  }
  return null;
}

export function ActiveWorkspaceProvider({ children }) {
  const navigate = useNavigate();
  const studentAuth = useAuth();
  const employerAuth = useEmployerAuth();
  const agentAuth = useAgentAuth();
  const institutionAuth = useInstitutionAuth();

  const [preference, setPreference] = useState(readActiveWorkspacePreference);
  const [identity, setIdentity] = useState(guestWorkspaceIdentity);
  const [isHydrating, setIsHydrating] = useState(() => !!readActiveWorkspacePreference());
  const [discovered, setDiscovered] = useState([]);
  const discoveryInFlightRef = useRef(null);
  const validatedPrefRef = useRef(null);

  useEffect(() => {
    const sync = () => setPreference(readActiveWorkspacePreference());
    window.addEventListener(ACTIVE_WORKSPACE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(ACTIVE_WORKSPACE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  useEffect(() => {
    return onSessionExpired((expiredRealm) => {
      const mapped = mapRealmToSessionExpired(expiredRealm);
      if (!mapped) return;
      clearActiveWorkspacePreferenceIfRealm(mapped);
      setDiscovered((prev) => prev.filter((item) => item.realm !== mapped));
    });
  }, []);

  const projectLive = useCallback((realm) => {
    if (realm === 'student' && studentAuth.isAuthenticated) {
      return projectStudentIdentity(studentAuth.user);
    }
    if (realm === 'employer' && employerAuth.isAuthenticated) {
      return projectEmployerIdentity(employerAuth.employer);
    }
    if (realm === 'agent' && agentAuth.isAuthenticated) {
      return projectAgentIdentity(agentAuth.agent);
    }
    if (realm === 'institution' && institutionAuth.isAuthenticated) {
      return projectInstitutionIdentity({
        account: institutionAuth.account,
        memberships: institutionAuth.memberships,
        membership: institutionAuth.membership,
      });
    }
    return null;
  }, [
    studentAuth.isAuthenticated,
    studentAuth.user,
    employerAuth.isAuthenticated,
    employerAuth.employer,
    agentAuth.isAuthenticated,
    agentAuth.agent,
    institutionAuth.isAuthenticated,
    institutionAuth.account,
    institutionAuth.memberships,
    institutionAuth.membership,
  ]);

  const studentEnsure = studentAuth.refreshToken;
  const studentLoading = studentAuth.loading;
  const employerEnsure = employerAuth.ensureSession;
  const agentEnsure = agentAuth.ensureSession;
  const institutionEnsure = institutionAuth.ensureSession;
  const employerRefreshQuietly = employerAuth.refreshQuietly;
  const agentRefreshQuietly = agentAuth.refreshQuietly;
  const institutionRefreshQuietly = institutionAuth.refreshQuietly;
  const studentLogout = studentAuth.logout;
  const employerLogout = employerAuth.logout;
  const agentLogout = agentAuth.logout;
  const institutionLogout = institutionAuth.logout;

  const validateRealm = useCallback(async (realm) => {
    const live = projectLive(realm);
    if (live) return live;
    if (realm === 'student') {
      if (studentLoading) return { pending: true };
      if (getAccessToken() && !studentAuth.isAuthenticated) return { pending: true };
      return null;
    }
    if (realm === 'employer') {
      const emp = await employerEnsure();
      return emp ? projectEmployerIdentity(emp) : null;
    }
    if (realm === 'agent') {
      const agent = await agentEnsure();
      return agent ? projectAgentIdentity(agent) : null;
    }
    if (realm === 'institution') {
      const session = await institutionEnsure();
      return session ? projectInstitutionIdentity(session) : null;
    }
    return null;
  }, [projectLive, studentLoading, studentAuth.isAuthenticated, employerEnsure, agentEnsure, institutionEnsure]);

  useEffect(() => {
    let cancelled = false;
    const preferred = preference;

    if (!preferred) {
      validatedPrefRef.current = null;
      setIdentity(guestWorkspaceIdentity());
      setIsHydrating(false);
      return undefined;
    }

    const live = projectLive(preferred);
    if (live) {
      validatedPrefRef.current = preferred;
      setIdentity(live);
      setIsHydrating(false);
      return undefined;
    }

    if (preferred === 'student' && (studentLoading || (getAccessToken() && !projectLive('student')))) {
      setIsHydrating(true);
      return undefined;
    }

    setIsHydrating(true);
    validateRealm(preferred).then((result) => {
      if (cancelled) return;
      if (result?.pending) {
        setIsHydrating(true);
        return;
      }
      if (result?.isAuthenticated) {
        validatedPrefRef.current = preferred;
        setIdentity(result);
      } else if (preferred === 'student' && getAccessToken()) {
        setIsHydrating(true);
        return;
      } else {
        validatedPrefRef.current = null;
        clearActiveWorkspacePreferenceIfRealm(preferred);
        setIdentity(guestWorkspaceIdentity());
      }
      setIsHydrating(false);
    });

    return () => {
      cancelled = true;
    };
  }, [preference, projectLive, validateRealm, studentLoading]);

  useEffect(() => {
    const realm = identity.realm;
    if (!identity.isAuthenticated || realm === 'guest') return undefined;

    const refreshQuietly = () => {
      if (document.hidden) return;
      if (realm === 'student') studentEnsure?.({ clearOnFailure: false });
      else if (realm === 'employer') employerRefreshQuietly?.();
      else if (realm === 'agent') agentRefreshQuietly?.();
      else if (realm === 'institution') institutionRefreshQuietly?.();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refreshQuietly();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', refreshQuietly);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', refreshQuietly);
    };
  }, [identity.realm, identity.isAuthenticated, studentEnsure, employerRefreshQuietly, agentRefreshQuietly, institutionRefreshQuietly]);

  const preferRealm = useCallback((realm) => {
    writeActiveWorkspacePreference(realm);
    setPreference(realm);
  }, []);

  const discoverOtherRealms = useCallback(async () => {
    if (discoveryInFlightRef.current) return discoveryInFlightRef.current;
    const run = (async () => {
      const active = identity.isAuthenticated ? identity.realm : null;
      const summaries = [];
      for (const realm of WORKSPACE_REALMS) {
        if (realm === active) continue;
        try {
          const live = projectLive(realm);
          if (live?.isAuthenticated) {
            summaries.push(live);
            continue;
          }
          const projected = await validateRealm(realm);
          if (projected?.isAuthenticated) summaries.push(projected);
        } catch {
          /* expected 401 for realms without a session */
        }
      }
      setDiscovered(summaries);
      return summaries;
    })();
    discoveryInFlightRef.current = run;
    try {
      return await run;
    } finally {
      discoveryInFlightRef.current = null;
    }
  }, [identity.isAuthenticated, identity.realm, validateRealm, projectLive]);

  const activateRealm = useCallback(async (realm) => {
    const projected = (await validateRealm(realm)) || projectLive(realm);
    if (!projected?.isAuthenticated) {
      const loginHref = WORKSPACE_DESTINATIONS[realm]?.login;
      if (loginHref) navigate(loginHref);
      return false;
    }
    preferRealm(realm);
    setIdentity(projected);
    navigate(projected.workspaceHref);
    return true;
  }, [validateRealm, projectLive, preferRealm, navigate]);

  const logoutActive = useCallback(async () => {
    const realm = identity.realm;
    if (realm === 'student') await studentLogout();
    else if (realm === 'employer') await employerLogout();
    else if (realm === 'agent') await agentLogout();
    else if (realm === 'institution') await institutionLogout();
    clearActiveWorkspacePreference();
    setPreference(null);
    setIdentity(guestWorkspaceIdentity());
    setDiscovered([]);
    validatedPrefRef.current = null;
    navigate('/', { replace: true });
  }, [identity.realm, studentLogout, employerLogout, agentLogout, institutionLogout, navigate]);

  const canActAsStudent = identity.realm === 'student' && identity.isAuthenticated;

  const value = useMemo(
    () => ({
      realm: identity.realm,
      identity,
      isAuthenticated: identity.isAuthenticated,
      isHydrating,
      canActAsStudent,
      preference,
      preferRealm,
      discoverOtherRealms,
      discovered,
      activateRealm,
      logoutActive,
    }),
    [
      identity,
      isHydrating,
      canActAsStudent,
      preference,
      preferRealm,
      discoverOtherRealms,
      discovered,
      activateRealm,
      logoutActive,
    ]
  );

  return (
    <ActiveWorkspaceContext.Provider value={value}>
      {children}
    </ActiveWorkspaceContext.Provider>
  );
}

export function useActiveWorkspace() {
  const ctx = useContext(ActiveWorkspaceContext);
  if (!ctx) throw new Error('useActiveWorkspace must be used within ActiveWorkspaceProvider');
  return ctx;
}

export function useOptionalActiveWorkspace() {
  return useContext(ActiveWorkspaceContext);
}
