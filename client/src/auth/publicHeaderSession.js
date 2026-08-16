import { projectStudentIdentity } from './activeWorkspace';

/**
 * Public chrome must follow canonical User session when no B2B workspace is
 * active. Do not invent a separate isLoggedIn flag.
 */
export function resolvePublicHeaderSession({
  workspaceIdentity,
  workspaceAuthenticated,
  workspaceHydrating,
  user,
  userAuthenticated,
  userLoading,
}) {
  const realm = workspaceIdentity?.realm;
  const b2b = workspaceAuthenticated && realm && realm !== 'student' && realm !== 'guest';
  if (b2b) {
    return { kind: 'b2b', identity: workspaceIdentity, hydrating: false, user };
  }

  if (userAuthenticated && user) {
    return {
      kind: 'student',
      identity: projectStudentIdentity(user),
      hydrating: false,
      user,
    };
  }

  if (workspaceAuthenticated && realm === 'student') {
    return { kind: 'student', identity: workspaceIdentity, hydrating: false, user };
  }

  if (userLoading || workspaceHydrating) {
    return { kind: 'hydrating', identity: null, hydrating: true, user: null };
  }

  return { kind: 'guest', identity: null, hydrating: false, user: null };
}
