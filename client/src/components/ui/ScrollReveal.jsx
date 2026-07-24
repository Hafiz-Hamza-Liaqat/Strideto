import { useEffect, useRef, useState } from 'react';

const defaultOptions = {
  rootMargin: '0px 0px -60px 0px',
  threshold: 0.1,
};

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Wraps content and reveals it with a smooth animation when it scrolls into view.
 * Honors prefers-reduced-motion by showing content immediately with no transform.
 */
export function ScrollReveal({
  children,
  className = '',
  variant = 'up',
  delay = 0,
  ioOptions = {},
  as: Component = 'div',
}) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(() => prefersReducedMotion());
  const options = { ...defaultOptions, ...ioOptions };

  useEffect(() => {
    if (prefersReducedMotion()) {
      setVisible(true);
      return undefined;
    }
    const el = ref.current;
    if (!el) return undefined;
    let timeoutId;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        if (delay > 0) {
          timeoutId = setTimeout(() => setVisible(true), delay);
        } else {
          setVisible(true);
        }
      },
      options
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [delay, options.rootMargin, options.threshold]);

  const baseClass = variant === 'fade' ? 'scroll-reveal scroll-reveal--fade' : 'scroll-reveal';
  const visibleClass = visible ? ' is-visible' : '';

  return (
    <Component
      ref={ref}
      className={`${baseClass}${visibleClass} ${className}`.trim()}
      style={delay > 0 && !prefersReducedMotion() ? { transitionDelay: visible ? `${delay}ms` : undefined } : undefined}
    >
      {children}
    </Component>
  );
}

export default ScrollReveal;
