import { useTranslation } from 'react-i18next';
import { TEMPLATE_IDS } from './resumeDefaults';

const TEMPLATE_PREVIEW_COLORS = {
  'modern-professional': 'bg-slate-700 text-white border-slate-600',
  'minimal-ats': 'bg-gray-800 text-gray-100 border-gray-600',
  'creative-portfolio': 'bg-emerald-800 text-white border-emerald-600',
  'academic-cv': 'bg-indigo-900 text-indigo-100 border-indigo-700',
};

const TEMPLATE_LABEL_KEYS = {
  'modern-professional': 'templateModern',
  'minimal-ats': 'templateMinimal',
  'creative-portfolio': 'templateCreative',
  'academic-cv': 'templateAcademic',
};

export function TemplateSelector({ value, onChange }) {
  const { t } = useTranslation('resume');

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
      {TEMPLATE_IDS.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={`rounded-xl border-2 p-2.5 sm:p-4 text-left transition-all duration-200 hover:scale-[1.02] min-w-0 ${
            value === id
              ? 'border-primary ring-2 ring-primary/50 dark:border-mint dark:ring-mint/50'
              : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
          }`}
        >
          <div className={`rounded-lg border p-3 text-xs font-medium ${TEMPLATE_PREVIEW_COLORS[id]}`}>
            <div className="h-2 w-3/4 bg-white/30 rounded mb-2" />
            <div className="h-2 w-1/2 bg-white/20 rounded mb-1" />
            <div className="h-2 w-2/3 bg-white/20 rounded" />
          </div>
          <p className="mt-2 text-xs sm:text-sm font-medium text-gray-900 dark:text-white break-words">{t(TEMPLATE_LABEL_KEYS[id])}</p>
        </button>
      ))}
    </div>
  );
}
