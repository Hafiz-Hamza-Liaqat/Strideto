import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { agentApi } from '../../services/agentService';
import { ROUTES } from '../../constants';

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
      if (currentStep < STEPS.length - 1) {
        setCurrentStep((s) => s + 1);
      } else {
        navigate(ROUTES.AGENT_DASHBOARD, { replace: true });
      }
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to advance step');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] px-4 py-12">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold text-[#0F172A] mb-2">Agent Onboarding</h1>
        <p className="text-slate-500 text-sm mb-8">
          Complete these steps to set up your professional agent profile.
          You may log in and continue at any time before approval.
        </p>

        {/* Step progress */}
        <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${
                  i < currentStep
                    ? 'bg-green-500 text-white'
                    : i === currentStep
                    ? 'bg-[#1D4ED8] text-white'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                {i < currentStep ? '✓' : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-8 h-0.5 flex-shrink-0 ${i < currentStep ? 'bg-green-400' : 'bg-slate-200'}`} />
              )}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
          <h2 className="text-lg font-semibold text-[#0F172A]">{step.label}</h2>
          <p className="text-slate-500 text-sm mt-2 mb-6">{step.description}</p>

          {step.key === 'verification' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-sm text-blue-800">
              Verification uses the Strideto organization verification system.
              Go to <strong>Verification</strong> in the sidebar to submit evidence and track your status.
              Pre-approval agents can complete their profile and prepare services in draft state.
            </div>
          )}
          {step.key === 'review' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 text-sm text-yellow-800">
              Your submission is under review. You may continue editing your profile
              and preparing services in draft state. Privileged features become
              available after approval.
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
          )}

          <div className="flex gap-3">
            {currentStep > 0 && (
              <button
                onClick={() => setCurrentStep((s) => s - 1)}
                className="px-4 py-2 text-sm border border-[#E5E7EB] rounded-lg text-slate-600 hover:bg-slate-50"
              >
                Back
              </button>
            )}
            <button
              onClick={advance}
              disabled={submitting}
              className="px-4 py-2 text-sm bg-[#1D4ED8] text-white rounded-lg font-medium hover:bg-[#1e40af] disabled:opacity-60"
            >
              {submitting
                ? 'Saving…'
                : currentStep < STEPS.length - 1
                ? 'Continue'
                : 'Go to Dashboard'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
