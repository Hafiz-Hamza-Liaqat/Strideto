import { forwardRef, useMemo } from 'react';
import { ResumeDocument } from './ResumeDocument';
import { buildResumeViewModel } from './resumeRenderUtils';

export const ResumePreview = forwardRef(function ResumePreview({ resume, template }, ref) {
  const viewModel = useMemo(() => buildResumeViewModel(resume), [resume]);

  return (
    <div
      ref={ref}
      className="resume-preview-wrapper overflow-x-auto overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 shadow-inner flex justify-center p-2 sm:p-4 min-h-[280px] sm:min-h-[400px]"
    >
      <div className="resume-preview-scale origin-top">
        <ResumeDocument viewModel={viewModel} template={template} />
      </div>
    </div>
  );
});
