import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useActiveWorkspace } from '../../context/ActiveWorkspaceContext';
import { useStudentProductEnabled } from '../../hooks/useStudentProductEnabled';
import { ROUTES } from '../../constants';
import { loginLocationState } from '../../utils/loginReturn.js';

export function SaveButton({ id, saved: initialSaved, onToggle }) {
  const { isAuthenticated } = useAuth();
  const { studentProductEnabled } = useStudentProductEnabled();
  const { canActAsStudent, isAuthenticated: workspaceAuth, realm } = useActiveWorkspace();
  const location = useLocation();
  const [saved, setSaved] = useState(!!initialSaved);
  const [loading, setLoading] = useState(false);

  const b2bBlocksStudentSave = workspaceAuth && realm && realm !== 'student' && realm !== 'guest';

  if (b2bBlocksStudentSave && !canActAsStudent) {
    return (
      <Link
        to={ROUTES.LOGIN}
        state={loginLocationState(location)}
        className="inline-flex items-center justify-center gap-1.5 min-w-[44px] min-h-[44px] px-2 sm:px-3 py-1.5 text-sm rounded-lg border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors duration-200"
        aria-label="A Student account is required to save"
        title="A Student account is required for this action."
      >
        <span aria-hidden>🔖</span>
        <span className="hidden sm:inline">Student account required</span>
      </Link>
    );
  }

  if (!isAuthenticated) {
    return (
      <Link
        to={ROUTES.LOGIN}
        state={loginLocationState(location)}
        className="inline-flex items-center justify-center gap-1.5 min-w-[44px] min-h-[44px] px-2 sm:px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-200"
        aria-label="Login to save"
        title="Login to Save"
      >
        <span aria-hidden>🔖</span>
        <span className="hidden sm:inline">Login to Save</span>
      </Link>
    );
  }

  if (!studentProductEnabled) {
    return (
      <span
        className="inline-flex items-center justify-center gap-1.5 min-w-[44px] min-h-[44px] px-2 sm:px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
        aria-label="Student access required to save"
        title="Student access required for this action."
      >
        <span aria-hidden>🔖</span>
        <span className="hidden sm:inline">Save unavailable</span>
      </span>
    );
  }

  const handleClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    try {
      await onToggle(id, !saved);
      setSaved((prev) => !prev);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={`inline-flex items-center justify-center gap-1.5 min-w-[44px] min-h-[44px] px-2 sm:px-3 py-1.5 text-sm rounded-lg border transition-all duration-200 ${
        saved
          ? 'bg-mint/30 dark:bg-mint/20 border-primary/50 dark:border-mint/50 text-primary dark:text-mint'
          : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
      }`}
      aria-pressed={saved}
      aria-label={saved ? 'Saved' : 'Save'}
      title={saved ? 'Saved' : 'Save'}
    >
      <span aria-hidden className="sm:hidden">{saved ? '✓' : '🔖'}</span>
      <span aria-hidden className="hidden sm:inline">{saved ? '✓ Saved' : '🔖 Save'}</span>
    </button>
  );
}
