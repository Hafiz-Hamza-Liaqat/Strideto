/**
 * CopilotWidget — Mission 19.
 *
 * Small "Ask Strideto" contextual entry point for use on:
 *   - Test detail pages
 *   - Program detail pages
 *   - Scholarship detail pages
 *   - Institution detail pages
 *   - Personalization hub
 *   - Journey dashboard
 *
 * Deep-links to CopilotPage with preselected context and entity refs.
 * Does NOT duplicate Copilot implementation — one engine, many entry points.
 *
 * @param {object} props
 * @param {string} props.contextType - COPILOT_CONTEXT_TYPES value
 * @param {object} props.entityRefs - { testIds, programIds, scholarshipIds, institutionIds }
 * @param {string} [props.suggestedQuestion] - pre-fill question
 * @param {string} [props.label] - button label
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
    <button onClick={handleClick} style={widgetStyles.btn} title="Ask Strideto Copilot">
      <span style={widgetStyles.icon}>✦</span>
      {label ?? 'Ask Strideto'}
    </button>
  );
}

const widgetStyles = {
  btn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 14px',
    borderRadius: 20,
    border: '1px solid #c7d2fe',
    background: '#eef2ff',
    color: '#4f46e5',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  icon: { fontSize: 14 },
};
