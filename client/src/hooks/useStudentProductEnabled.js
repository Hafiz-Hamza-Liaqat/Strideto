import { useAuth } from '../context/AuthContext';

/**
 * Strict client gate for student-product API calls.
 * Requires server-projected `student` in `/auth/me` capabilities.
 */
export function useStudentProductEnabled() {
  const { isAuthenticated, hasStudentCapability, loading } = useAuth();
  return {
    isAuthenticated,
    authLoading: loading,
    hasStudentCapability,
    studentProductEnabled: isAuthenticated && !loading && hasStudentCapability,
  };
}
