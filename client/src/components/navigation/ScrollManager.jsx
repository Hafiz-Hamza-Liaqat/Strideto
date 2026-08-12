import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

function scrollToTop() {
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

function scrollToHashTarget(hash) {
  const id = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!id) {
    scrollToTop();
    return;
  }
  requestAnimationFrame(() => {
    const escaped = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(id) : id.replace(/[^\w-]/g, '\\$&');
    const target =
      document.getElementById(id) ||
      document.querySelector(`[name="${escaped}"]`);
    if (target) {
      target.scrollIntoView();
    } else {
      scrollToTop();
    }
  });
}

/**
 * Central scroll policy for client-side navigations.
 * POP restores browser history scroll; PUSH/REPLACE reset on pathname change.
 */
export function ScrollManager() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const prevPathnameRef = useRef(location.pathname);

  useEffect(() => {
    const { pathname, hash } = location;
    const prevPathname = prevPathnameRef.current;
    prevPathnameRef.current = pathname;

    if (navigationType === 'POP') {
      return;
    }

    if (hash) {
      scrollToHashTarget(hash);
      return;
    }

    if (pathname !== prevPathname) {
      scrollToTop();
    }
  }, [location, navigationType]);

  return null;
}

export default ScrollManager;
