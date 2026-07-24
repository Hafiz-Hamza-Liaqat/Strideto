/**
 * Skip link — first focusable control; revealed on focus; jumps to main content.
 */
export function SkipLink({ href = '#main-content', label = 'Skip to content' }) {
  return (
    <a href={href} className="skip-link">
      {label}
    </a>
  );
}
