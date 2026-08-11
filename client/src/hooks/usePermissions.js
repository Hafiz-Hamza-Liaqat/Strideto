import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { getAccessToken } from '../services/axiosBase';
import { getPermissionsForRole, hasPermission, isStaffRole } from '../config/rbac';
import { adminApi } from '../services/listingsService';

let sharedPermissionsPromise = null;
let sharedPermissionsCache = { role: null, permissions: [], serverConfirmed: false };

function fetchPermissionsOnce(role) {
  if (
    sharedPermissionsCache.role === role &&
    sharedPermissionsCache.permissions.length &&
    sharedPermissionsCache.serverConfirmed
  ) {
    return Promise.resolve(sharedPermissionsCache.permissions);
  }
  if (!sharedPermissionsPromise) {
    sharedPermissionsPromise = adminApi.permissions()
      .then(({ data }) => {
        const perms = data.permissions || getPermissionsForRole(role);
        sharedPermissionsCache = { role, permissions: perms, serverConfirmed: true };
        return perms;
      })
      .catch(() => {
        sharedPermissionsCache = { role, permissions: [], serverConfirmed: false };
        return [];
      })
      .finally(() => {
        sharedPermissionsPromise = null;
      });
  }
  return sharedPermissionsPromise;
}

export function resetPermissionsCache() {
  sharedPermissionsCache = { role: null, permissions: [], serverConfirmed: false };
  sharedPermissionsPromise = null;
}

export function usePermissions() {
  const { user, isAuthenticated } = useAuth();
  const role = user?.role;
  const [permissions, setPermissions] = useState(() => getPermissionsForRole(role));
  const [serverConfirmed, setServerConfirmed] = useState(false);
  const [loading, setLoading] = useState(isStaffRole(role));
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    if (!role || !isStaffRole(role) || !isAuthenticated || !getAccessToken()) {
      setPermissions([]);
      setServerConfirmed(false);
      setLoading(false);
      return () => { mountedRef.current = false; };
    }
    setPermissions(getPermissionsForRole(role));
    setLoading(true);
    fetchPermissionsOnce(role)
      .then((perms) => {
        if (mountedRef.current) {
          setPermissions(perms);
          setServerConfirmed(sharedPermissionsCache.serverConfirmed);
        }
      })
      .finally(() => {
        if (mountedRef.current) setLoading(false);
      });
    return () => { mountedRef.current = false; };
  }, [role, isAuthenticated]);

  const can = useCallback(
    (perm) => {
      if (!isAuthenticated || !getAccessToken()) return false;
      if (role === 'SuperAdmin' && serverConfirmed) return true;
      if (permissions?.length) return permissions.includes(perm);
      if (serverConfirmed) return false;
      return hasPermission(role, perm);
    },
    [role, permissions, isAuthenticated, serverConfirmed]
  );

  const canAny = useCallback(
    (perms) => perms.some((p) => can(p)),
    [can]
  );

  return {
    role,
    permissions,
    loading,
    isStaff: isStaffRole(role),
    can,
    canAny,
  };
}
