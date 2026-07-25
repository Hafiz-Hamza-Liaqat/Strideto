import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ResumeDocument } from './ResumeDocument';
import { buildResumeViewModel } from './resumeRenderUtils';

const A4_WIDTH_MM = 210;

function measureMmInPx(mm) {
  const probe = document.createElement('div');
  probe.style.cssText = `width:${mm}mm;position:absolute;visibility:hidden;pointer-events:none`;
  document.body.appendChild(probe);
  const px = probe.offsetWidth || (mm * 96) / 25.4;
  document.body.removeChild(probe);
  return px;
}

export const ResumePreview = forwardRef(function ResumePreview({ resume, template }, ref) {
  const viewModel = useMemo(() => buildResumeViewModel(resume), [resume]);
  const wrapperRef = useRef(null);
  const scaleInnerRef = useRef(null);
  const [scale, setScale] = useState(1);

  const setWrapperRef = useCallback((node) => {
    wrapperRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  }, [ref]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return undefined;

    let a4Px = measureMmInPx(A4_WIDTH_MM);

    const updateScale = () => {
      const styles = getComputedStyle(wrapper);
      const padX = (parseFloat(styles.paddingLeft) || 0) + (parseFloat(styles.paddingRight) || 0);
      const available = wrapper.clientWidth - padX;
      if (available <= 0) return;
      setScale(Math.min(1, available / a4Px));
    };

    updateScale();
    const ro = new ResizeObserver(() => {
      a4Px = measureMmInPx(A4_WIDTH_MM);
      updateScale();
    });
    ro.observe(wrapper);
    window.addEventListener('resize', updateScale);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateScale);
    };
  }, []);

  useEffect(() => {
    const node = scaleInnerRef.current;
    if (!node) return;
    const fullHeight = node.scrollHeight;
    node.style.marginBottom = scale < 1 ? `${(scale - 1) * fullHeight}px` : '0px';
  }, [scale, viewModel, template]);

  return (
    <div
      ref={setWrapperRef}
      className="resume-preview-wrapper overflow-x-hidden overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 shadow-inner flex justify-center p-2 sm:p-4 min-h-[280px] sm:min-h-[400px] max-w-full"
    >
      <div
        ref={scaleInnerRef}
        className="resume-preview-scale"
        style={{
          width: `${A4_WIDTH_MM}mm`,
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
        }}
      >
        <ResumeDocument viewModel={viewModel} template={template} />
      </div>
    </div>
  );
});
