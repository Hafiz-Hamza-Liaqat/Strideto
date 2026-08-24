import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  WIZARD_STEPS,
  defaultEducationEntry,
  defaultExperienceEntry,
  defaultProjectEntry,
  defaultReferenceEntry,
  defaultAwardEntry,
  defaultVolunteerEntry,
  defaultPublicationEntry,
  defaultMembershipEntry,
  CAREER_OBJECTIVE_SUGGESTION,
  SKILL_SUGGESTIONS,
  parseSkillLines,
} from './resumeDefaults';
import { AdminImageUrlField } from '../../components/admin/AdminImageUrlField';
import { PhoneInput } from '../../components/forms/PhoneInput';
import { resumesApi } from '../../services/listingsService';
import { useToast } from '../../context/ToastContext';
import { sanitizeGpa, sanitizeYear } from './resumeInputSanitize';

const inputClass =
  'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary dark:focus:ring-mint outline-none text-sm';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

const TIP_KEYS = ['tip1', 'tip2', 'tip3', 'tip4'];

/**
 * Textarea that shows raw text while editing and only commits the parsed
 * skill array to the parent on blur. Prevents Enter/comma/spaces being
 * consumed by parseSkillLines on every keystroke.
 */
function SkillDraftTextarea({ skills, onCommit, ...props }) {
  const [draft, setDraft] = useState(() => (skills || []).join('\n'));
  const editingRef = useRef(false);
  const prevSkillsSerialRef = useRef(JSON.stringify(skills ?? []));

  useEffect(() => {
    const serial = JSON.stringify(skills ?? []);
    if (!editingRef.current && prevSkillsSerialRef.current !== serial) {
      prevSkillsSerialRef.current = serial;
      setDraft((skills || []).join('\n'));
    }
  }, [skills]);

  return (
    <textarea
      {...props}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => { editingRef.current = true; }}
      onBlur={() => {
        editingRef.current = false;
        const parsed = parseSkillLines(draft);
        prevSkillsSerialRef.current = JSON.stringify(parsed);
        onCommit(parsed);
      }}
    />
  );
}

export function ResumeForm({ stepIndex, resume, onChange }) {
  const { t } = useTranslation('resume');
  const step = WIZARD_STEPS[stepIndex];
  const { toast } = useToast();
  const [aiLoading, setAiLoading] = useState(false);

  const update = (path, value) => {
    const keys = path.split('.');
    const next = JSON.parse(JSON.stringify(resume));
    let target = next;
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!target[k]) target[k] = {};
      target = target[k];
    }
    target[keys[keys.length - 1]] = value;
    onChange(next);
  };

  const addEntry = (arrayKey, defaultEntry) => {
    const arr = resume[arrayKey] || [];
    onChange({ ...resume, [arrayKey]: [...arr, defaultEntry()] });
  };

  const updateEntry = (arrayKey, index, field, value) => {
    const arr = [...(resume[arrayKey] || [])];
    if (!arr[index]) arr[index] = {};
    arr[index] = { ...arr[index], [field]: value };
    onChange({ ...resume, [arrayKey]: arr });
  };

  const removeEntry = (arrayKey, index) => {
    const arr = (resume[arrayKey] || []).filter((_, i) => i !== index);
    onChange({ ...resume, [arrayKey]: arr });
  };

  const handleAiCareerObjective = async () => {
    if (!resume.careerObjective?.trim()) {
      update('careerObjective', CAREER_OBJECTIVE_SUGGESTION);
      return;
    }
    setAiLoading(true);
    try {
      const { data } = await resumesApi.aiSuggest({ careerObjective: resume.careerObjective });
      if (data.careerObjective?.improved) {
        update('careerObjective', data.careerObjective.improved);
        toast.success(t('objectiveUpdated'));
      }
    } catch {
      toast.error(t('suggestionFailed'));
      update('careerObjective', CAREER_OBJECTIVE_SUGGESTION);
    } finally {
      setAiLoading(false);
    }
  };

  const p = resume.personalInfo || {};

  if (step.id === 'personal') {
    return (
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>{t('fullName')}</label>
            <input type="text" className={inputClass} value={p.fullName || ''} onChange={(e) => update('personalInfo.fullName', e.target.value)} placeholder={t('fullName')} />
          </div>
          <div>
            <label className={labelClass}>{t('professionalTitle')}</label>
            <input type="text" className={inputClass} value={p.professionalTitle || ''} onChange={(e) => update('personalInfo.professionalTitle', e.target.value)} placeholder={t('professionalTitlePlaceholder')} />
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>{t('email')}</label>
            <input type="email" className={inputClass} value={p.email || ''} onChange={(e) => update('personalInfo.email', e.target.value)} placeholder="email@example.com" />
          </div>
          <div>
            <label className={labelClass} htmlFor="resume-phone-national">{t('phone')}</label>
            <PhoneInput
              id="resume-phone"
              nationalId="resume-phone-national"
              value={p.phone || ''}
              onChange={(next) => update('personalInfo.phone', next?.e164 || '')}
            />
          </div>
          <div>
            <label className={labelClass}>{t('cityProvince')}</label>
            <div className="flex gap-2">
              <input type="text" className={inputClass} value={p.city || ''} onChange={(e) => update('personalInfo.city', e.target.value)} placeholder={t('city')} />
              <input type="text" className={inputClass} value={p.province || ''} onChange={(e) => update('personalInfo.province', e.target.value)} placeholder={t('province')} />
            </div>
          </div>
        </div>
        <div>
          <label className={labelClass}>{t('linkedInUrl')}</label>
          <input type="url" className={inputClass} value={p.linkedInUrl || ''} onChange={(e) => update('personalInfo.linkedInUrl', e.target.value)} placeholder="https://linkedin.com/in/username" />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>{t('githubPortfolio')}</label>
            <input type="url" className={inputClass} value={p.githubUrl || ''} onChange={(e) => update('personalInfo.githubUrl', e.target.value)} placeholder="https://github.com/username" />
          </div>
          <div>
            <label className={labelClass}>{t('portfolioUrl')}</label>
            <input type="url" className={inputClass} value={p.portfolioUrl || ''} onChange={(e) => update('personalInfo.portfolioUrl', e.target.value)} placeholder="https://yourportfolio.com" />
          </div>
        </div>
        <AdminImageUrlField
          label={t('profilePhotoUrl')}
          value={p.profilePhotoUrl || ''}
          onChange={(v) => update('personalInfo.profilePhotoUrl', v)}
          allowUpload={false}
        />
      </div>
    );
  }

  if (step.id === 'objective') {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">{t('objectiveHint')}</p>
        <textarea
          className={`${inputClass} min-h-[120px]`}
          value={resume.careerObjective || ''}
          onChange={(e) => update('careerObjective', e.target.value)}
          placeholder={t('objectivePlaceholder')}
          rows={4}
        />
        <button type="button" onClick={handleAiCareerObjective} disabled={aiLoading} className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover disabled:opacity-50">
          {aiLoading ? '…' : resume.careerObjective?.trim() ? t('improveWithAi') : t('useSuggestedObjective')}
        </button>
      </div>
    );
  }

  if (step.id === 'education') {
    const entries = resume.education || [];
    return (
      <div className="space-y-4">
        {entries.map((entry, i) => (
          <div key={i} className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('entryNumber', { number: i + 1 })}</span>
              <button type="button" onClick={() => removeEntry('education', i)} className="text-sm text-red-600 dark:text-red-400 hover:underline">{t('removeEntry')}</button>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>{t('degree')}</label>
                <input type="text" className={inputClass} value={entry.degree || ''} onChange={(e) => updateEntry('education', i, 'degree', e.target.value)} placeholder={t('degreePlaceholder')} />
              </div>
              <div>
                <label className={labelClass}>{t('university')}</label>
                <input type="text" className={inputClass} value={entry.university || ''} onChange={(e) => updateEntry('education', i, 'university', e.target.value)} placeholder={t('universityPlaceholder')} />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>{t('fieldOfStudy')}</label>
                <input type="text" className={inputClass} value={entry.fieldOfStudy || ''} onChange={(e) => updateEntry('education', i, 'fieldOfStudy', e.target.value)} placeholder={t('fieldOfStudyPlaceholder')} />
              </div>
              <div>
                <label className={labelClass}>{t('graduationYear')}</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  className={inputClass}
                  value={entry.graduationYear || ''}
                  onChange={(e) => updateEntry('education', i, 'graduationYear', sanitizeYear(e.target.value))}
                  placeholder="2025"
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>{t('gpa')}</label>
              <input
                type="text"
                inputMode="decimal"
                className={inputClass}
                value={entry.gpa || ''}
                onChange={(e) => updateEntry('education', i, 'gpa', sanitizeGpa(e.target.value))}
                placeholder={t('gpaPlaceholder')}
              />
            </div>
          </div>
        ))}
        <button type="button" onClick={() => addEntry('education', defaultEducationEntry)} className="px-4 py-2 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-primary dark:hover:border-mint text-sm font-medium">
          {t('addEducation')}
        </button>
      </div>
    );
  }

  if (step.id === 'skills') {
    return (
      <div className="space-y-6">
        <div>
          <label className={labelClass}>{t('technicalSkills')}</label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{t('skillsMultilineHint')}</p>
          <SkillDraftTextarea
            skills={resume.skills?.technical || []}
            onCommit={(technical) => onChange({ ...resume, skills: { ...resume.skills, technical } })}
            className={`${inputClass} min-h-[140px] font-mono text-sm`}
            placeholder={SKILL_SUGGESTIONS.technical.join('\n')}
            rows={8}
          />
          <p className="text-xs text-gray-500 mt-1">{t('skillCount', { count: (resume.skills?.technical || []).length })}</p>
        </div>
        <div>
          <label className={labelClass}>{t('softSkills')}</label>
          <SkillDraftTextarea
            skills={resume.skills?.soft || []}
            onCommit={(soft) => onChange({ ...resume, skills: { ...resume.skills, soft } })}
            className={`${inputClass} min-h-[100px] font-mono text-sm`}
            placeholder={SKILL_SUGGESTIONS.soft.join('\n')}
            rows={5}
          />
          <p className="text-xs text-gray-500 mt-1">{t('skillCount', { count: (resume.skills?.soft || []).length })}</p>
        </div>
      </div>
    );
  }

  if (step.id === 'experience') {
    const entries = resume.experience || [];
    return (
      <div className="space-y-4">
        {entries.map((entry, i) => (
          <div key={i} className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('entryNumber', { number: i + 1 })}</span>
              <button type="button" onClick={() => removeEntry('experience', i)} className="text-sm text-red-600 dark:text-red-400 hover:underline">{t('removeEntry')}</button>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>{t('company')}</label>
                <input type="text" className={inputClass} value={entry.company || ''} onChange={(e) => updateEntry('experience', i, 'company', e.target.value)} placeholder={t('companyPlaceholder')} />
              </div>
              <div>
                <label className={labelClass}>{t('role')}</label>
                <input type="text" className={inputClass} value={entry.role || ''} onChange={(e) => updateEntry('experience', i, 'role', e.target.value)} placeholder={t('rolePlaceholder')} />
              </div>
            </div>
            <div>
              <label className={labelClass}>{t('duration')}</label>
              <input type="text" className={inputClass} value={entry.duration || ''} onChange={(e) => updateEntry('experience', i, 'duration', e.target.value)} placeholder={t('durationPlaceholder')} />
            </div>
            <div>
              <label className={labelClass}>{t('description')}</label>
              <textarea className={`${inputClass} min-h-[80px]`} value={entry.description || ''} onChange={(e) => updateEntry('experience', i, 'description', e.target.value)} placeholder={t('experienceDescPlaceholder')} rows={3} />
            </div>
          </div>
        ))}
        <button type="button" onClick={() => addEntry('experience', defaultExperienceEntry)} className="px-4 py-2 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-primary dark:hover:border-mint text-sm font-medium">
          {t('addExperience')}
        </button>
      </div>
    );
  }

  if (step.id === 'projects') {
    const entries = resume.projects || [];
    return (
      <div className="space-y-4">
        {entries.map((entry, i) => (
          <div key={i} className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('projectNumber', { number: i + 1 })}</span>
              <button type="button" onClick={() => removeEntry('projects', i)} className="text-sm text-red-600 dark:text-red-400 hover:underline">{t('removeEntry')}</button>
            </div>
            <div>
              <label className={labelClass}>{t('projectTitle')}</label>
              <input type="text" className={inputClass} value={entry.title || ''} onChange={(e) => updateEntry('projects', i, 'title', e.target.value)} placeholder={t('projectTitlePlaceholder')} />
            </div>
            <div>
              <label className={labelClass}>{t('description')}</label>
              <textarea className={`${inputClass} min-h-[80px]`} value={entry.description || ''} onChange={(e) => updateEntry('projects', i, 'description', e.target.value)} placeholder={t('projectDescPlaceholder')} rows={3} />
            </div>
            <div>
              <label className={labelClass}>{t('technologiesUsed')}</label>
              <input type="text" className={inputClass} value={entry.technologies || ''} onChange={(e) => updateEntry('projects', i, 'technologies', e.target.value)} placeholder={t('technologiesPlaceholder')} />
            </div>
          </div>
        ))}
        <button type="button" onClick={() => addEntry('projects', defaultProjectEntry)} className="px-4 py-2 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-primary dark:hover:border-mint text-sm font-medium">
          {t('addProject')}
        </button>
      </div>
    );
  }

  if (step.id === 'certifications') {
    const certs = resume.certifications || [];
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">{t('certificationsHint')}</p>
        {certs.map((c, i) => (
          <div key={i} className="flex gap-2">
            <input type="text" className={inputClass} value={c} onChange={(e) => {
              const next = [...certs];
              next[i] = e.target.value;
              onChange({ ...resume, certifications: next });
            }} placeholder={t('certificationPlaceholder')} />
            <button type="button" onClick={() => onChange({ ...resume, certifications: certs.filter((_, j) => j !== i) })} className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-red-600 dark:text-red-400">{t('removeEntry')}</button>
          </div>
        ))}
        <button type="button" onClick={() => onChange({ ...resume, certifications: [...certs, ''] })} className="px-4 py-2 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-primary dark:hover:border-mint text-sm font-medium">
          {t('addCertification')}
        </button>
      </div>
    );
  }

  if (step.id === 'languages') {
    const langs = resume.languages || [];
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">{t('languagesHint')}</p>
        {langs.map((l, i) => (
          <div key={i} className="flex gap-2">
            <input type="text" className={inputClass} value={l} onChange={(e) => {
              const next = [...langs];
              next[i] = e.target.value;
              onChange({ ...resume, languages: next });
            }} placeholder={t('languagePlaceholder')} />
            <button type="button" onClick={() => onChange({ ...resume, languages: langs.filter((_, j) => j !== i) })} className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-red-600 dark:text-red-400">{t('removeEntry')}</button>
          </div>
        ))}
        <button type="button" onClick={() => onChange({ ...resume, languages: [...langs, ''] })} className="px-4 py-2 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-primary dark:hover:border-mint text-sm font-medium">
          {t('addLanguage')}
        </button>
      </div>
    );
  }

  if (step.id === 'additional') {
    const interestsText = (resume.interests || []).join('\n');
    return (
      <div className="space-y-8">
        <p className="text-sm text-gray-600 dark:text-gray-400">{t('additionalHint')}</p>

        <div>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">{t('references')}</h3>
          {(resume.references || []).map((entry, i) => (
            <div key={i} className="p-4 mb-3 rounded-xl border border-gray-200 dark:border-gray-700 space-y-2">
              <div className="flex justify-between"><span className="text-sm font-medium">{t('entryNumber', { number: i + 1 })}</span>
                <button type="button" onClick={() => removeEntry('references', i)} className="text-sm text-red-600">{t('removeEntry')}</button></div>
              <input className={inputClass} placeholder={t('referenceName')} value={entry.name || ''} onChange={(e) => updateEntry('references', i, 'name', e.target.value)} />
              <input className={inputClass} placeholder={t('referenceTitle')} value={entry.title || ''} onChange={(e) => updateEntry('references', i, 'title', e.target.value)} />
              <input className={inputClass} placeholder={t('company')} value={entry.company || ''} onChange={(e) => updateEntry('references', i, 'company', e.target.value)} />
              <div className="grid sm:grid-cols-2 gap-2">
                <input className={inputClass} placeholder={t('email')} value={entry.email || ''} onChange={(e) => updateEntry('references', i, 'email', e.target.value)} />
                <PhoneInput
                  id={`resume-ref-phone-${i}`}
                  value={entry.phone || ''}
                  onChange={(next) => updateEntry('references', i, 'phone', next?.e164 || '')}
                />
              </div>
            </div>
          ))}
          <button type="button" onClick={() => addEntry('references', defaultReferenceEntry)} className="text-sm text-primary dark:text-mint">{t('addReference')}</button>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">{t('awards')}</h3>
          {(resume.awards || []).map((entry, i) => (
            <div key={i} className="p-4 mb-3 rounded-xl border border-gray-200 dark:border-gray-700 space-y-2">
              <div className="flex justify-between"><span className="text-sm font-medium">{t('entryNumber', { number: i + 1 })}</span>
                <button type="button" onClick={() => removeEntry('awards', i)} className="text-sm text-red-600">{t('removeEntry')}</button></div>
              <input className={inputClass} placeholder={t('awardTitle')} value={entry.title || ''} onChange={(e) => updateEntry('awards', i, 'title', e.target.value)} />
              <input className={inputClass} placeholder={t('awardIssuer')} value={entry.issuer || ''} onChange={(e) => updateEntry('awards', i, 'issuer', e.target.value)} />
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                className={inputClass}
                placeholder={t('graduationYear')}
                value={entry.year || ''}
                onChange={(e) => updateEntry('awards', i, 'year', sanitizeYear(e.target.value))}
              />
              <textarea className={`${inputClass} min-h-[60px]`} placeholder={t('description')} value={entry.description || ''} onChange={(e) => updateEntry('awards', i, 'description', e.target.value)} rows={2} />
            </div>
          ))}
          <button type="button" onClick={() => addEntry('awards', defaultAwardEntry)} className="text-sm text-primary dark:text-mint">{t('addAward')}</button>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">{t('volunteerExperience')}</h3>
          {(resume.volunteerExperience || []).map((entry, i) => (
            <div key={i} className="p-4 mb-3 rounded-xl border border-gray-200 dark:border-gray-700 space-y-2">
              <div className="flex justify-between"><span className="text-sm font-medium">{t('entryNumber', { number: i + 1 })}</span>
                <button type="button" onClick={() => removeEntry('volunteerExperience', i)} className="text-sm text-red-600">{t('removeEntry')}</button></div>
              <input className={inputClass} placeholder={t('company')} value={entry.organization || ''} onChange={(e) => updateEntry('volunteerExperience', i, 'organization', e.target.value)} />
              <input className={inputClass} placeholder={t('role')} value={entry.role || ''} onChange={(e) => updateEntry('volunteerExperience', i, 'role', e.target.value)} />
              <input className={inputClass} placeholder={t('duration')} value={entry.duration || ''} onChange={(e) => updateEntry('volunteerExperience', i, 'duration', e.target.value)} />
              <textarea className={`${inputClass} min-h-[60px]`} placeholder={t('description')} value={entry.description || ''} onChange={(e) => updateEntry('volunteerExperience', i, 'description', e.target.value)} rows={2} />
            </div>
          ))}
          <button type="button" onClick={() => addEntry('volunteerExperience', defaultVolunteerEntry)} className="text-sm text-primary dark:text-mint">{t('addVolunteer')}</button>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">{t('publications')}</h3>
          {(resume.publications || []).map((entry, i) => (
            <div key={i} className="p-4 mb-3 rounded-xl border border-gray-200 dark:border-gray-700 space-y-2">
              <div className="flex justify-between"><span className="text-sm font-medium">{t('entryNumber', { number: i + 1 })}</span>
                <button type="button" onClick={() => removeEntry('publications', i)} className="text-sm text-red-600">{t('removeEntry')}</button></div>
              <input className={inputClass} placeholder={t('publicationTitle')} value={entry.title || ''} onChange={(e) => updateEntry('publications', i, 'title', e.target.value)} />
              <input className={inputClass} placeholder={t('publicationPublisher')} value={entry.publisher || ''} onChange={(e) => updateEntry('publications', i, 'publisher', e.target.value)} />
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                className={inputClass}
                placeholder={t('graduationYear')}
                value={entry.year || ''}
                onChange={(e) => updateEntry('publications', i, 'year', sanitizeYear(e.target.value))}
              />
              <input className={inputClass} placeholder={t('publicationUrl')} value={entry.url || ''} onChange={(e) => updateEntry('publications', i, 'url', e.target.value)} />
              <textarea className={`${inputClass} min-h-[60px]`} placeholder={t('description')} value={entry.description || ''} onChange={(e) => updateEntry('publications', i, 'description', e.target.value)} rows={2} />
            </div>
          ))}
          <button type="button" onClick={() => addEntry('publications', defaultPublicationEntry)} className="text-sm text-primary dark:text-mint">{t('addPublication')}</button>
        </div>

        <div>
          <label className={labelClass}>{t('interests')}</label>
          <textarea
            className={`${inputClass} min-h-[80px]`}
            value={interestsText}
            onChange={(e) => onChange({ ...resume, interests: parseSkillLines(e.target.value) })}
            placeholder={t('interestsPlaceholder')}
            rows={4}
          />
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">{t('professionalMemberships')}</h3>
          {(resume.professionalMemberships || []).map((entry, i) => (
            <div key={i} className="p-4 mb-3 rounded-xl border border-gray-200 dark:border-gray-700 space-y-2">
              <div className="flex justify-between"><span className="text-sm font-medium">{t('entryNumber', { number: i + 1 })}</span>
                <button type="button" onClick={() => removeEntry('professionalMemberships', i)} className="text-sm text-red-600">{t('removeEntry')}</button></div>
              <input className={inputClass} placeholder={t('membershipOrg')} value={entry.organization || ''} onChange={(e) => updateEntry('professionalMemberships', i, 'organization', e.target.value)} />
              <input className={inputClass} placeholder={t('role')} value={entry.role || ''} onChange={(e) => updateEntry('professionalMemberships', i, 'role', e.target.value)} />
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                className={inputClass}
                placeholder={t('membershipSince')}
                value={entry.since || ''}
                onChange={(e) => updateEntry('professionalMemberships', i, 'since', sanitizeYear(e.target.value))}
              />
            </div>
          ))}
          <button type="button" onClick={() => addEntry('professionalMemberships', defaultMembershipEntry)} className="text-sm text-primary dark:text-mint">{t('addMembership')}</button>
        </div>
      </div>
    );
  }

  return null;
}

export function ResumeTips() {
  const { t } = useTranslation('resume');

  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4">
      <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-2">{t('resumeTipsTitle')}</h3>
      <ul className="space-y-1 text-sm text-amber-700 dark:text-amber-300">
        {TIP_KEYS.map((key) => (
          <li key={key}>• {t(key)}</li>
        ))}
      </ul>
    </div>
  );
}
