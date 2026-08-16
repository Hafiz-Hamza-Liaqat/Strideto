import { projectStudentIdentity } from './activeWorkspace';

/**
 * Public chrome must follow canonical User session when no B2B workspace is
 * active. Do not invent a separate isLoggedIn flag.
 *
 * kind `student` here means User-realm chrome (historical), not that the
 * account necessarily has the student capability.
 */
export function resolvePublicHeaderSession({
  workspaceIdentity,
  workspaceAuthenticated,
  workspaceHydrating,
  user,
  userAuthenticated,
  userLoading,
  pathname,
}) {
  const realm = workspaceIdentity?.realm;
  const b2b = workspaceAuthenticated && realm && realm !== 'student' && realm !== 'guest';
  if (b2b) {
    return { kind: 'b2b', identity: workspaceIdentity, hydrating: false, user };
  }

  if (userAuthenticated && user) {
    return {
      kind: 'student',
      identity: projectStudentIdentity(user, { pathname }),
      hydrating: false,
      user,
    };
  }

  if (workspaceAuthenticated && realm === 'student') {
    return {
      kind: 'student',
      identity: projectStudentIdentity(user, { pathname }) || workspaceIdentity,
      hydrating: false,
      user,
    };
  }

  if (userLoading || workspaceHydrating) {
    return { kind: 'hydrating', identity: null, hydrating: true, user: null };
  }

  return { kind: 'guest', identity: null, hydrating: false, user: null };
}
