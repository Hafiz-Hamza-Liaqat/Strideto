import { useTranslation } from 'react-i18next';
import { WIZARD_STEPS } from './resumeDefaults';
import { ResumeForm, ResumeTips } from './ResumeForm';

const STEP_LABEL_KEYS = {
  personal: 'personalInfo',
  objective: 'careerObjective',
  education: 'education',
  skills: 'skills',
  experience: 'experience',
  projects: 'projects',
  certifications: 'certifications',
  languages: 'languages',
  additional: 'additionalSections',
};

export function ResumeWizard({ resume, onChange, stepIndex, setStepIndex }) {
  const { t } = useTranslation('resume');
  const total = WIZARD_STEPS.length;
  const currentStep = WIZARD_STEPS[stepIndex];
  const currentLabel = t(STEP_LABEL_KEYS[currentStep.id] || currentStep.id);

  return (
    <div className="space-y-6">
      <div className="scroll-tabs pb-2 -mx-2 px-2 sm:mx-0 sm:px-0">
        <div className="flex gap-1 min-w-max">
          {WIZARD_STEPS.map((step, i) => (
            <button
              key={step.id}
              type="button"
              onClick={() => setStepIndex(i)}
              className={`shrink-0 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors min-h-[44px] ${
                i === stepIndex
                  ? 'bg-primary text-white dark:bg-mint dark:text-gray-900'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {t(STEP_LABEL_KEYS[step.id] || step.id)}
            </button>
          ))}
        </div>
      </div>
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary dark:bg-mint transition-all duration-300"
          style={{ width: `${((stepIndex + 1) / total) * 100}%` }}
        />
      </div>
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {currentLabel}
        </h2>
        <ResumeForm
          stepIndex={stepIndex}
          resume={resume}
          onChange={onChange}
        />
      </div>
      <div className="flex justify-between">
        <button
          type="button"
          onClick={() => setStepIndex(Math.max(0, stepIndex - 1))}
          disabled={stepIndex === 0}
          className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          {t('previous')}
        </button>
        <button
          type="button"
          onClick={() => setStepIndex(Math.min(total - 1, stepIndex + 1))}
          disabled={stepIndex === total - 1}
          className="px-4 py-2 rounded-lg bg-primary text-white dark:bg-mint dark:text-gray-900 font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-hover"
        >
          {t('next')}
        </button>
      </div>
      <ResumeTips />
    </div>
  );
}
