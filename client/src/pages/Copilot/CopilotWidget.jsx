/**
 * CopilotWidget — Mission 19.
 *
 * Small "Ask Strideto" contextual entry point. Deep-links to CopilotPage.
 * Does NOT duplicate Copilot implementation — one engine, many entry points.
 */
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../constants';

export function CopilotWidget({ contextType, entityRefs = {}, suggestedQuestion = '', label }) {
  const navigate = useNavigate();

  const handleClick = () => {
    const params = new URLSearchParams();
    if (contextType) params.set('context', contextType);
    if (suggestedQuestion) params.set('q', suggestedQuestion);
    if (Object.keys(entityRefs).length > 0) {
      params.set('refs', encodeURIComponent(JSON.stringify(entityRefs)));
    }
    navigate(`${ROUTES.COPILOT}?${params.toString()}`);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title="Ask Strideto Copilot"
      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3.5 py-1.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200 dark:hover:bg-indigo-950/70"
    >
      <span aria-hidden="true">✦</span>
      {label ?? 'Ask Strideto'}
    </button>
  );
}
