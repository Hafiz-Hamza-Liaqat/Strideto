import { Link } from 'react-router-dom';
import { ROUTES } from '../../constants';

export default function AgentHelp() {
  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Help</h1>
      <p className="text-sm text-slate-600 dark:text-gray-400">Start with guidelines for everyday Agent / Agency use.</p>
      <ul className="space-y-2 text-sm">
        <li><Link className="text-primary hover:underline" to={ROUTES.AGENT_GUIDELINES}>Guidelines</Link></li>
        <li><Link className="text-primary hover:underline" to={ROUTES.AGENT_VERIFICATION}>Verification</Link></li>
        <li><Link className="text-primary hover:underline" to={ROUTES.AGENT_USAGE_BILLING}>Usage & Billing</Link></li>
        <li><Link className="text-primary hover:underline" to={ROUTES.AGENT_SETTINGS}>Settings / security</Link></li>
        <li><Link className="text-primary hover:underline" to={ROUTES.SUPPORT}>Contact support</Link></li>
      </ul>
    </div>
  );
}
