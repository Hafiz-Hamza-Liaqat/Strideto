import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { agentApi } from '../../services/agentService';
import { ROUTES } from '../../constants';
import { Logo } from '../../components/brand/Logo';
import { btnPrimary, btnSecondary, cardClass, muted } from './agentUi';

const STEPS = [
  { key: 'identity', label: 'Professional Identity', description: 'Set up your professional name, country, and organization details.' },
  { key: 'services', label: 'Services', description: 'Define the services you offer to students and clients.' },
  { key: 'markets', label: 'Countries & Markets', description: 'Specify which countries you serve and your destination markets.' },
  { key: 'representative', label: 'Representative', description: 'For agencies: add authorized representative information.' },
  { key: 'verification', label: 'Verification', description: 'Submit your organization for Strideto verification review.' },
  { key: 'review', label: 'Review', description: 'Your application is under review. You may complete your profile while waiting.' },
];

export default function AgentOnboarding() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const step = STEPS[currentStep];

  const advance = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await agentApi.submitOnboardingStep(step.key);
      if (currentStep < STEPS.length - 1) setCurrentStep((s) => s + 1);
      else navigate(ROUTES.AGENT_DASHBOARD, { replace: true });
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to advance step');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-main dark:bg-secondary px-4 py-12">
      <div className="max-w-2xl mx-auto">
        <Logo height={32} className="mb-6" />
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">Agent Onboarding</h1>
        <p className={`${muted} mb-8`}>Complete these steps to set up your professional agent profile. Profile completion is not verification.</p>
        <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${i < currentStep ? 'bg-green-500 text-white' : i === currentStep ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-gray-700 text-slate-500 dark:text-gray-300'}`}>
                {i < currentStep ? '✓' : i + 1}
              </div>
              {i < STEPS.length - 1 ? <div className={`w-8 h-0.5 flex-shrink-0 ${i < currentStep ? 'bg-green-400' : 'bg-slate-200 dark:bg-gray-700'}`} /> : null}
            </div>
          ))}
        </div>
        <div className={cardClass}>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{step.label}</h2>
          <p className={`${muted} mt-2 mb-6`}>{step.description}</p>
          {step.key === 'verification' ? (
            <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6 text-sm text-blue-800 dark:text-blue-200">
              Verification uses the Strideto organization verification system. Go to Verification in the sidebar to submit a full dossier. Numbers alone are not proof. Maps/Business is supporting evidence only.
            </div>
          ) : null}
          {step.key === 'review' ? (
            <div className="bg-yellow-50 dark:bg-yellow-950/40 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6 text-sm text-yellow-800 dark:text-yellow-200">
              Your submission is under review. You may continue editing your profile and preparing services in draft state. Privileged features become available after approval.
            </div>
          ) : null}
          {error ? <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm" role="alert">{error}</div> : null}
          <div className="flex gap-3">
            {currentStep > 0 ? <button type="button" onClick={() => setCurrentStep((s) => s - 1)} className={btnSecondary}>Back</button> : null}
            <button type="button" onClick={advance} disabled={submitting} className={btnPrimary}>
              {submitting ? 'Saving…' : currentStep < STEPS.length - 1 ? 'Continue' : 'Go to Dashboard'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
