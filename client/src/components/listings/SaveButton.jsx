import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ROUTES } from '../../constants';

export function SaveButton({ id, saved: initialSaved, onToggle }) {
  const { isAuthenticated } = useAuth();
  const [saved, setSaved] = useState(!!initialSaved);
  const [loading, setLoading] = useState(false);

  if (!isAuthenticated) {
    return (
      <Link
        to={ROUTES.LOGIN}
        className="inline-flex items-center justify-center gap-1.5 min-w-[44px] min-h-[44px] px-2 sm:px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-200"
        aria-label="Login to save"
        title="Login to Save"
      >
        <span aria-hidden>🔖</span>
        <span className="hidden sm:inline">Login to Save</span>
      </Link>
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
