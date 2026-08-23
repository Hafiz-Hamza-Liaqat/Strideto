import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FormField } from '../../components/common/FormField';
import { DateInput } from '../../components/forms/NativeTemporalInput';
import { PhoneInput } from '../../components/forms/PhoneInput';
import { Button } from '../../components/common/Button';
import {
  GRADING_SYSTEMS,
  GRADING_SYSTEM_LABELS,
} from '../../../../shared/career/studentProfile.js';
import {
  emptyEducation,
  emptyExperience,
  emptySkill,
  emptyLanguage,
  emptyCertification,
  emptyPortfolio,
  emptyExamScore,
  emptyStudyGoal,
  parseListInput,
  formatListInput,
} from './talentProfileMapper';

/**
 * Input that shows a comma-separated draft while editing and only commits the
 * parsed array to the parent on blur. Prevents commas/spaces being consumed on
 * every keystroke.
 */
function DraftListInput({ value, onCommit, ...props }) {
  const [draft, setDraft] = useState(() => formatListInput(value));
  const prevRef = useRef(value);

  useEffect(() => {
    if (prevRef.current !== value) {
      prevRef.current = value;
      setDraft(formatListInput(value));
    }
  }, [value]);

  return (
    <input
      {...props}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => onCommit(parseListInput(draft))}
    />
  );
}

export const inputClass =
  'w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary outline-none min-h-[44px]';

function SectionCard({ title, children }) {
  return (
    <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-6 space-y-4">
      {title && <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>}
      {children}
    </section>
  );
}

function updateNested(setForm, path, value) {
  setForm((prev) => {
    const next = { ...prev };
    const keys = path.split('.');
    let cur = next;
    for (let i = 0; i < keys.length - 1; i += 1) {
      cur[keys[i]] = { ...cur[keys[i]] };
      cur = cur[keys[i]];
    }
    cur[keys[keys.length - 1]] = value;
    return next;
  });
}

function updateArrayItem(setForm, key, index, patch) {
  setForm((prev) => {
    const arr = [...(prev[key] || [])];
    arr[index] = { ...arr[index], ...patch };
    return { ...prev, [key]: arr };
  });
}

function addArrayItem(setForm, key, factory) {
  setForm((prev) => ({ ...prev, [key]: [...(prev[key] || []), factory()] }));
}

function removeArrayItem(setForm, key, index) {
  setForm((prev) => ({
    ...prev,
    [key]: (prev[key] || []).filter((_, i) => i !== index),
  }));
}

export function TalentProfileForm({ form, setForm, activeTab }) {
  const { t } = useTranslation(['talent', 'common']);

  if (activeTab === 'personal') {
    return (
      <SectionCard title={t('talent:tabs.personal')}>
        <div className="grid sm:grid-cols-2 gap-4">
          <FormField label={t('talent:personal.firstName')} id="tp-firstName">
            <input
              id="tp-firstName"
              className={inputClass}
              value={form.personal.firstName}
              onChange={(e) => updateNested(setForm, 'personal.firstName', e.target.value)}
              autoComplete="given-name"
            />
          </FormField>
          <FormField label={t('talent:personal.lastName')} id="tp-lastName">
            <input
              id="tp-lastName"
              className={inputClass}
              value={form.personal.lastName}
              onChange={(e) => updateNested(setForm, 'personal.lastName', e.target.value)}
              autoComplete="family-name"
            />
          </FormField>
          <FormField label={t('talent:personal.photo')} id="tp-avatar" className="sm:col-span-2">
            <input
              id="tp-avatar"
              className={inputClass}
              type="url"
              value={form.avatarUrl}
              onChange={(e) => setForm((p) => ({ ...p, avatarUrl: e.target.value }))}
              placeholder="https://"
            />
          </FormField>
          <FormField label={t('talent:personal.dateOfBirth')} id="tp-dob">
            <DateInput
              id="tp-dob"
              className={inputClass}
              value={form.personal.dateOfBirth}
              onChange={(e) => updateNested(setForm, 'personal.dateOfBirth', e.target.value)}
            />
          </FormField>
          <FormField label={t('talent:personal.gender')} id="tp-gender">
            <input
              id="tp-gender"
              className={inputClass}
              value={form.personal.gender}
              onChange={(e) => updateNested(setForm, 'personal.gender', e.target.value)}
            />
          </FormField>
          <FormField label={t('talent:personal.country')} id="tp-country">
            <input
              id="tp-country"
              className={inputClass}
              value={form.personal.country}
              onChange={(e) => updateNested(setForm, 'personal.country', e.target.value)}
              autoComplete="country-name"
            />
          </FormField>
          <FormField label={t('talent:personal.region')} id="tp-region">
            <input
              id="tp-region"
              className={inputClass}
              value={form.personal.region}
              onChange={(e) => updateNested(setForm, 'personal.region', e.target.value)}
            />
          </FormField>
          <FormField label={t('talent:personal.city')} id="tp-city">
            <input
              id="tp-city"
              className={inputClass}
              value={form.personal.city}
              onChange={(e) => updateNested(setForm, 'personal.city', e.target.value)}
              autoComplete="address-level2"
            />
          </FormField>
          <FormField label={t('talent:personal.nationality')} id="tp-nationality">
            <input
              id="tp-nationality"
              className={inputClass}
              value={form.personal.nationality}
              onChange={(e) => updateNested(setForm, 'personal.nationality', e.target.value)}
            />
          </FormField>
        </div>
        <label className="flex items-center gap-3 min-h-[44px] cursor-pointer">
          <input
            type="checkbox"
            checked={form.visibility === 'public'}
            onChange={(e) => setForm((p) => ({ ...p, visibility: e.target.checked ? 'public' : 'private' }))}
            className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">{t('talent:personal.visibility')}</span>
        </label>
        <p className="text-xs text-gray-500 dark:text-gray-400">{t('talent:personal.visibilityHint')}</p>
      </SectionCard>
    );
  }

  if (activeTab === 'contact') {
    return (
      <SectionCard title={t('talent:tabs.contact')}>
        <div className="grid sm:grid-cols-2 gap-4">
          <FormField label={t('talent:contact.email')} id="tp-email" className="sm:col-span-2">
            <input id="tp-email" className={`${inputClass} opacity-70`} value={form.contactEmail} readOnly aria-readonly="true" />
            <p className="text-xs text-gray-500 mt-1">{t('talent:contact.emailReadOnly')}</p>
          </FormField>
          <FormField label={t('talent:personal.phone')} id="tp-phone">
            <PhoneInput
              id="tp-phone"
              value={form.personal.phone}
              defaultCountry={form.personal.country || ''}
              onChange={(next) => updateNested(setForm, 'personal.phone', next?.e164 || '')}
            />
          </FormField>
          <FormField label={t('talent:personal.timeZone')} id="tp-tz-contact">
            <input
              id="tp-tz-contact"
              className={inputClass}
              placeholder="e.g. Europe/London"
              value={form.personal.timeZone}
              onChange={(e) => {
                updateNested(setForm, 'personal.timeZone', e.target.value);
                updateNested(setForm, 'preferences.timeZone', e.target.value);
              }}
            />
          </FormField>
          <FormField label={t('talent:contact.website')} id="tp-website">
            <input id="tp-website" type="url" className={inputClass} value={form.socialProfile.websiteUrl} onChange={(e) => updateNested(setForm, 'socialProfile.websiteUrl', e.target.value)} />
          </FormField>
          <FormField label={t('talent:contact.linkedIn')} id="tp-linkedin">
            <input id="tp-linkedin" type="url" className={inputClass} value={form.socialProfile.linkedInUrl} onChange={(e) => updateNested(setForm, 'socialProfile.linkedInUrl', e.target.value)} />
          </FormField>
          <FormField label={t('talent:contact.github')} id="tp-github">
            <input id="tp-github" type="url" className={inputClass} value={form.socialProfile.githubUrl} onChange={(e) => updateNested(setForm, 'socialProfile.githubUrl', e.target.value)} />
          </FormField>
          <FormField label={t('talent:contact.portfolio')} id="tp-portfolio">
            <input id="tp-portfolio" type="url" className={inputClass} value={form.socialProfile.portfolioUrl} onChange={(e) => updateNested(setForm, 'socialProfile.portfolioUrl', e.target.value)} />
          </FormField>
          <FormField label={t('talent:contact.twitter')} id="tp-twitter">
            <input id="tp-twitter" type="url" className={inputClass} value={form.socialProfile.twitterUrl} onChange={(e) => updateNested(setForm, 'socialProfile.twitterUrl', e.target.value)} />
          </FormField>
        </div>
      </SectionCard>
    );
  }

  if (activeTab === 'career') {
    return (
      <SectionCard title={t('talent:tabs.career')}>
        <FormField label={t('talent:career.headline')} id="tp-headline">
          <input id="tp-headline" className={inputClass} value={form.headline} onChange={(e) => setForm((p) => ({ ...p, headline: e.target.value }))} />
        </FormField>
        <FormField label={t('talent:career.summary')} id="tp-summary">
          <textarea id="tp-summary" rows={5} className={inputClass} value={form.summary} onChange={(e) => setForm((p) => ({ ...p, summary: e.target.value }))} />
        </FormField>
        <div className="grid sm:grid-cols-2 gap-4">
          <FormField label={t('talent:career.employmentStatus')} id="tp-employment">
            <select id="tp-employment" className={inputClass} value={form.preferences.employmentStatus} onChange={(e) => updateNested(setForm, 'preferences.employmentStatus', e.target.value)}>
              {['employed', 'unemployed', 'student', 'freelance', 'self_employed', 'open_to_work'].map((k) => (
                <option key={k} value={k}>{t(`talent:employmentStatus.${k}`)}</option>
              ))}
            </select>
          </FormField>
          <FormField label={t('talent:career.workMode')} id="tp-workmode">
            <select id="tp-workmode" className={inputClass} value={form.preferences.workMode} onChange={(e) => updateNested(setForm, 'preferences.workMode', e.target.value)}>
              {['onsite', 'remote', 'hybrid'].map((k) => (
                <option key={k} value={k}>{t(`talent:workMode.${k}`)}</option>
              ))}
            </select>
          </FormField>
          <FormField label={t('talent:career.timeZone')} id="tp-tz">
            <input id="tp-tz" className={inputClass} placeholder="e.g. America/New_York" value={form.preferences.timeZone}
              onChange={(e) => { updateNested(setForm, 'preferences.timeZone', e.target.value); updateNested(setForm, 'personal.timeZone', e.target.value); }}
            />
          </FormField>
          <FormField label={t('talent:career.preferredCountries')} id="tp-countries" className="sm:col-span-2">
            <input id="tp-countries" className={inputClass} value={formatListInput(form.preferences.preferredCountries)} onChange={(e) => updateNested(setForm, 'preferences.preferredCountries', parseListInput(e.target.value))} />
            <p className="text-xs text-gray-500 mt-1">{t('talent:career.preferredCountriesHint')}</p>
          </FormField>
          <FormField label={t('talent:career.salaryMin')} id="tp-sal-min">
            <input id="tp-sal-min" type="number" min="0" className={inputClass} value={form.preferences.salaryExpectation.min} onChange={(e) => updateNested(setForm, 'preferences.salaryExpectation.min', e.target.value)} />
          </FormField>
          <FormField label={t('talent:career.salaryMax')} id="tp-sal-max">
            <input id="tp-sal-max" type="number" min="0" className={inputClass} value={form.preferences.salaryExpectation.max} onChange={(e) => updateNested(setForm, 'preferences.salaryExpectation.max', e.target.value)} />
          </FormField>
          <FormField label={t('talent:career.salaryCurrency')} id="tp-currency">
            <input id="tp-currency" className={inputClass} value={form.preferences.salaryExpectation.currency} onChange={(e) => updateNested(setForm, 'preferences.salaryExpectation.currency', e.target.value)} />
          </FormField>
          <FormField label={t('talent:career.salaryPeriod')} id="tp-period">
            <select id="tp-period" className={inputClass} value={form.preferences.salaryExpectation.period} onChange={(e) => updateNested(setForm, 'preferences.salaryExpectation.period', e.target.value)}>
              <option value="hourly">Hourly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </FormField>
        </div>
      </SectionCard>
    );
  }

  if (activeTab === 'education') {
    return (
      <SectionCard title={t('talent:tabs.education')}>
        <div className="space-y-4">
          {(form.education || []).map((row, i) => (
            <div key={i} className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-4 space-y-3">
              <h3 className="font-medium text-gray-900 dark:text-white">Education entry {i + 1}</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <FormField id={`education-${i}-institution`} label={t('talent:education.institution')}>
                  <input id={`education-${i}-institution`} className={inputClass} value={row.institution} onChange={(e) => updateArrayItem(setForm, 'education', i, { institution: e.target.value })} />
                </FormField>
                <FormField id={`education-${i}-degree`} label={t('talent:education.degree')}>
                  <input id={`education-${i}-degree`} className={inputClass} value={row.degree} onChange={(e) => updateArrayItem(setForm, 'education', i, { degree: e.target.value })} />
                </FormField>
                <FormField id={`education-${i}-field`} label={t('talent:education.field')}>
                  <input id={`education-${i}-field`} className={inputClass} value={row.fieldOfStudy} onChange={(e) => updateArrayItem(setForm, 'education', i, { fieldOfStudy: e.target.value })} />
                </FormField>
                <FormField id={`education-${i}-country`} label={t('talent:education.country')}>
                  <input id={`education-${i}-country`} className={inputClass} value={row.country || ''} maxLength={2} onChange={(e) => updateArrayItem(setForm, 'education', i, { country: e.target.value.toUpperCase() })} />
                </FormField>
                <FormField id={`education-${i}-start-year`} label={t('talent:education.startYear')}>
                  <input id={`education-${i}-start-year`} className={inputClass} value={row.startYear} onChange={(e) => updateArrayItem(setForm, 'education', i, { startYear: e.target.value })} />
                </FormField>
                <FormField id={`education-${i}-end-year`} label={t('talent:education.endYear')}>
                  <input id={`education-${i}-end-year`} className={inputClass} value={row.endYear} onChange={(e) => updateArrayItem(setForm, 'education', i, { endYear: e.target.value })} />
                </FormField>
                <FormField id={`education-${i}-grading-system`} label={t('talent:education.gradingSystem')}>
                  <select
                    id={`education-${i}-grading-system`}
                    className={inputClass}
                    value={row.gradingSystem || ''}
                    required
                    onChange={(e) => updateArrayItem(setForm, 'education', i, { gradingSystem: e.target.value, _legacyGradingSystem: '' })}
                  >
                    <option value="">Grading system needs selection</option>
                    {GRADING_SYSTEMS.map((value) => (
                      <option key={value} value={value}>{GRADING_SYSTEM_LABELS[value]}</option>
                    ))}
                  </select>
                  {row._legacyGradingSystem ? (
                    <p className="mt-1 text-sm text-amber-700 dark:text-amber-300" role="status">
                      The previous value “{row._legacyGradingSystem}” is not supported. Select the correct grading system; no conversion has been applied.
                    </p>
                  ) : null}
                </FormField>
                <FormField id={`education-${i}-grade-value`} label={t('talent:education.gradeValue')}>
                  <input id={`education-${i}-grade-value`} className={inputClass} placeholder="For example: 78%, 4.2, 3.33, A" value={row.gradeValue || ''} onChange={(e) => updateArrayItem(setForm, 'education', i, { gradeValue: e.target.value })} />
                </FormField>
                <FormField id={`education-${i}-grade-scale`} label={t('talent:education.gradeScale')}>
                  <input id={`education-${i}-grade-scale`} className={inputClass} placeholder="For example: 100, 4, 5, 10" value={row.gradeScale || ''} onChange={(e) => updateArrayItem(setForm, 'education', i, { gradeScale: e.target.value })} />
                </FormField>
                <FormField id={`education-${i}-honors`} label={t('talent:education.honors')}>
                  <input id={`education-${i}-honors`} className={inputClass} value={row.honors || ''} onChange={(e) => updateArrayItem(setForm, 'education', i, { honors: e.target.value })} />
                </FormField>
              </div>
              <FormField id={`education-${i}-description`} label={t('talent:education.description')}>
                <textarea id={`education-${i}-description`} className={inputClass} rows={2} value={row.description} onChange={(e) => updateArrayItem(setForm, 'education', i, { description: e.target.value })} />
              </FormField>
              <Button type="button" variant="outline" onClick={() => removeArrayItem(setForm, 'education', i)}>{t('talent:education.remove')}</Button>
            </div>
          ))}
        </div>
        <Button type="button" variant="secondary" onClick={() => addArrayItem(setForm, 'education', emptyEducation)}>{t('talent:education.add')}</Button>
      </SectionCard>
    );
  }

  if (activeTab === 'tests') {
    return (
      <SectionCard title={t('talent:tabs.tests')}>
        <div className="space-y-4">
          {(form.examScores || []).map((row, i) => (
            <div key={i} className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-4 space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <input className={inputClass} placeholder={t('talent:tests.testType') + ' (e.g. IELTS, GRE)'} value={row.testType} onChange={(e) => updateArrayItem(setForm, 'examScores', i, { testType: e.target.value })} />
                <input className={inputClass} placeholder={t('talent:tests.overallScore')} value={row.overallScore} onChange={(e) => updateArrayItem(setForm, 'examScores', i, { overallScore: e.target.value })} />
                <input type="date" className={inputClass} value={row.testDate ? String(row.testDate).slice(0, 10) : ''} onChange={(e) => updateArrayItem(setForm, 'examScores', i, { testDate: e.target.value })} />
                <input type="date" className={inputClass} placeholder={t('talent:tests.expiryDate')} value={row.expiryDate ? String(row.expiryDate).slice(0, 10) : ''} onChange={(e) => updateArrayItem(setForm, 'examScores', i, { expiryDate: e.target.value })} />
                <select className={inputClass} value={row.status} onChange={(e) => updateArrayItem(setForm, 'examScores', i, { status: e.target.value })}>
                  {['planned', 'booked', 'completed'].map((k) => (
                    <option key={k} value={k}>{t(`talent:tests.statusOptions.${k}`)}</option>
                  ))}
                </select>
                <input className={inputClass} placeholder={t('talent:tests.referenceNumber')} value={row.referenceNumber} onChange={(e) => updateArrayItem(setForm, 'examScores', i, { referenceNumber: e.target.value })} />
              </div>
              <Button type="button" variant="outline" onClick={() => removeArrayItem(setForm, 'examScores', i)}>{t('talent:tests.remove')}</Button>
            </div>
          ))}
        </div>
        <Button type="button" variant="secondary" onClick={() => addArrayItem(setForm, 'examScores', emptyExamScore)}>{t('talent:tests.add')}</Button>
      </SectionCard>
    );
  }

  if (activeTab === 'goals') {
    const sp = form.studentPreferences || {};
    const bp = form.budgetProfile || {};
    return (
      <div className="space-y-6">
        <SectionCard title={t('talent:tabs.goals')}>
          <div className="space-y-4">
            {(form.studyGoals || []).map((row, i) => (
              <div key={i} className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-4 space-y-3">
                <div className="grid sm:grid-cols-2 gap-3">
                  <select className={inputClass} value={row.goalType} onChange={(e) => updateArrayItem(setForm, 'studyGoals', i, { goalType: e.target.value })}>
                    {['study', 'scholarship', 'job', 'internship', 'fellowship', 'work_mobility', 'other'].map((k) => (
                      <option key={k} value={k}>{t(`talent:goals.goalTypeOptions.${k}`)}</option>
                    ))}
                  </select>
                  <input className={inputClass} placeholder={t('talent:goals.fieldOfStudy')} value={row.fieldOfStudy} onChange={(e) => updateArrayItem(setForm, 'studyGoals', i, { fieldOfStudy: e.target.value })} />
                  <input className={inputClass} placeholder={t('talent:goals.destinationCountries')} value={formatListInput(row.destinationCountries)} onChange={(e) => updateArrayItem(setForm, 'studyGoals', i, { destinationCountries: parseListInput(e.target.value).map((c) => c.toUpperCase()) })} />
                  <input className={inputClass} placeholder={t('talent:goals.targetIntake')} value={row.targetIntake} onChange={(e) => updateArrayItem(setForm, 'studyGoals', i, { targetIntake: e.target.value })} />
                  <input type="number" min="2024" max="2035" className={inputClass} placeholder={t('talent:goals.targetYear')} value={row.targetYear} onChange={(e) => updateArrayItem(setForm, 'studyGoals', i, { targetYear: e.target.value })} />
                  <select className={inputClass} value={row.studyMode} onChange={(e) => updateArrayItem(setForm, 'studyGoals', i, { studyMode: e.target.value })}>
                    <option value="">— {t('talent:goals.studyMode')} —</option>
                    {['full_time', 'part_time', 'online', 'blended'].map((k) => (
                      <option key={k} value={k}>{t(`talent:goals.studyModeOptions.${k}`)}</option>
                    ))}
                  </select>
                </div>
                <textarea className={inputClass} rows={2} placeholder={t('talent:goals.notes')} value={row.notes} onChange={(e) => updateArrayItem(setForm, 'studyGoals', i, { notes: e.target.value })} />
                <Button type="button" variant="outline" onClick={() => removeArrayItem(setForm, 'studyGoals', i)}>{t('talent:goals.remove')}</Button>
              </div>
            ))}
          </div>
          <Button type="button" variant="secondary" onClick={() => addArrayItem(setForm, 'studyGoals', emptyStudyGoal)}>{t('talent:goals.add')}</Button>
        </SectionCard>

        <SectionCard title={t('talent:goals.preferencesTitle')}>
          <div className="grid sm:grid-cols-2 gap-4">
            <FormField label={t('talent:goals.destinationCountries')} id="sp-dest" className="sm:col-span-2">
              <input id="sp-dest" className={inputClass} placeholder="GB, DE, CA" value={formatListInput(sp.destinationCountries)} onChange={(e) => updateNested(setForm, 'studentPreferences.destinationCountries', parseListInput(e.target.value).map((c) => c.toUpperCase()))} />
            </FormField>
            <FormField label={t('talent:goals.fieldsOfStudy')} id="sp-fields" className="sm:col-span-2">
              <DraftListInput id="sp-fields" className={inputClass} value={sp.fieldsOfStudy || []} onCommit={(arr) => updateNested(setForm, 'studentPreferences.fieldsOfStudy', arr)} />
            </FormField>
            <FormField label={t('talent:goals.targetIntake')} id="sp-intake">
              <input id="sp-intake" className={inputClass} value={sp.targetIntake || ''} onChange={(e) => updateNested(setForm, 'studentPreferences.targetIntake', e.target.value)} />
            </FormField>
            <FormField label={t('talent:goals.targetYear')} id="sp-year">
              <input id="sp-year" type="number" min="2024" max="2035" className={inputClass} value={sp.targetYear || ''} onChange={(e) => updateNested(setForm, 'studentPreferences.targetYear', e.target.value)} />
            </FormField>
            <FormField label={t('talent:goals.preferredCurrency')} id="sp-curr">
              <input id="sp-curr" className={inputClass} placeholder="USD" maxLength={3} value={sp.preferredCurrency || ''} onChange={(e) => updateNested(setForm, 'studentPreferences.preferredCurrency', e.target.value.toUpperCase())} />
            </FormField>
            <label className="flex items-center gap-3 min-h-[44px] cursor-pointer sm:col-span-2">
              <input type="checkbox" checked={Boolean(sp.scholarshipRequired)} onChange={(e) => updateNested(setForm, 'studentPreferences.scholarshipRequired', e.target.checked)} className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary" />
              <span className="text-sm text-gray-700 dark:text-gray-300">{t('talent:goals.scholarshipRequired')}</span>
            </label>
          </div>
        </SectionCard>

        <SectionCard title={t('talent:goals.budgetTitle')}>
          <div className="grid sm:grid-cols-2 gap-4">
            {[['tuition', t('talent:goals.tuition')], ['living', t('talent:goals.living')], ['general', t('talent:goals.general')]].map(([field, label]) => (
              <div key={field} className="sm:col-span-2 grid sm:grid-cols-2 gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700 items-end">
                <FormField label={label + ' — ' + t('talent:goals.budgetAmount')} id={`bp-${field}-amt`}>
                  <input id={`bp-${field}-amt`} type="number" min="0" className={inputClass} value={bp[field]?.amountMinor ?? ''} onChange={(e) => updateNested(setForm, `budgetProfile.${field}.amountMinor`, e.target.value)} />
                </FormField>
                <FormField label={t('talent:goals.budgetCurrency')} id={`bp-${field}-cur`}>
                  <input id={`bp-${field}-cur`} className={inputClass} placeholder="USD" maxLength={3} value={bp[field]?.currency || ''} onChange={(e) => updateNested(setForm, `budgetProfile.${field}.currency`, e.target.value.toUpperCase())} />
                </FormField>
              </div>
            ))}
            <FormField label={t('talent:goals.budgetPeriod')} id="bp-period">
              <select id="bp-period" className={inputClass} value={bp.period || ''} onChange={(e) => updateNested(setForm, 'budgetProfile.period', e.target.value)}>
                <option value="">—</option>
                {['monthly', 'yearly', 'total_program'].map((k) => <option key={k} value={k}>{k.replace('_', ' ')}</option>)}
              </select>
            </FormField>
            <FormField label={t('talent:goals.fundingSource')} id="bp-funding">
              <input id="bp-funding" className={inputClass} value={bp.fundingSource || ''} onChange={(e) => updateNested(setForm, 'budgetProfile.fundingSource', e.target.value)} />
            </FormField>
          </div>
        </SectionCard>
      </div>
    );
  }

  if (activeTab === 'experience') {
    return (
      <SectionCard title={t('talent:tabs.experience')}>
        <div className="space-y-4">
          {(form.experience || []).map((row, i) => (
            <div key={i} className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-4 space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <input className={inputClass} placeholder={t('talent:experience.company')} value={row.company} onChange={(e) => updateArrayItem(setForm, 'experience', i, { company: e.target.value })} />
                <input className={inputClass} placeholder={t('talent:experience.title')} value={row.role} onChange={(e) => updateArrayItem(setForm, 'experience', i, { role: e.target.value })} />
                <input className={inputClass} placeholder={t('talent:experience.employmentType') + ' (e.g. full_time)'} value={row.employmentType || ''} onChange={(e) => updateArrayItem(setForm, 'experience', i, { employmentType: e.target.value })} />
                <input className={inputClass} placeholder={t('talent:experience.country')} value={row.country || ''} maxLength={2} onChange={(e) => updateArrayItem(setForm, 'experience', i, { country: e.target.value.toUpperCase() })} />
                <input className={inputClass} placeholder={t('talent:experience.location')} value={row.location} onChange={(e) => updateArrayItem(setForm, 'experience', i, { location: e.target.value })} />
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 min-h-[44px]">
                  <input type="checkbox" checked={row.isCurrent} onChange={(e) => updateArrayItem(setForm, 'experience', i, { isCurrent: e.target.checked })} />
                  {t('talent:experience.current')}
                </label>
                <input className={inputClass} placeholder={t('talent:experience.startDate')} value={row.startDate} onChange={(e) => updateArrayItem(setForm, 'experience', i, { startDate: e.target.value })} />
                <input className={inputClass} placeholder={t('talent:experience.endDate')} value={row.endDate} onChange={(e) => updateArrayItem(setForm, 'experience', i, { endDate: e.target.value })} disabled={row.isCurrent} />
              </div>
              <textarea className={inputClass} rows={3} placeholder={t('talent:experience.responsibilities')} value={row.description} onChange={(e) => updateArrayItem(setForm, 'experience', i, { description: e.target.value })} />
              <textarea
                className={inputClass}
                rows={2}
                placeholder={t('talent:experience.achievements')}
                value={(row.achievements || []).join('\n')}
                onChange={(e) => updateArrayItem(setForm, 'experience', i, { achievements: e.target.value.split('\n') })}
              />
              <Button type="button" variant="outline" onClick={() => removeArrayItem(setForm, 'experience', i)}>{t('talent:experience.remove')}</Button>
            </div>
          ))}
        </div>
        <Button type="button" variant="secondary" onClick={() => addArrayItem(setForm, 'experience', emptyExperience)}>{t('talent:experience.add')}</Button>
      </SectionCard>
    );
  }

  if (activeTab === 'skills') {
    const renderSkillGroup = (category, titleKey) => {
      const items = (form.skills || []).map((s, idx) => ({ ...s, idx })).filter((s) => (s.category || 'technical') === category);
      return (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{t(titleKey)}</h3>
          {items.map(({ idx, ...row }) => (
            <div key={idx} className="grid sm:grid-cols-[1fr_160px_auto] gap-2 items-center">
              <input className={inputClass} placeholder={t('talent:skills.name')} value={row.name} onChange={(e) => updateArrayItem(setForm, 'skills', idx, { name: e.target.value })} />
              <select className={inputClass} value={row.level} onChange={(e) => updateArrayItem(setForm, 'skills', idx, { level: e.target.value })}>
                {['beginner', 'intermediate', 'advanced', 'expert'].map((k) => (
                  <option key={k} value={k}>{t(`talent:skillLevel.${k}`)}</option>
                ))}
              </select>
              <Button type="button" variant="outline" onClick={() => removeArrayItem(setForm, 'skills', idx)}>{t('talent:skills.remove')}</Button>
            </div>
          ))}
          <Button type="button" variant="secondary" onClick={() => addArrayItem(setForm, 'skills', () => emptySkill(category))}>{t('talent:skills.add')}</Button>
        </div>
      );
    };
    return (
      <SectionCard title={t('talent:tabs.skills')}>
        <div className="space-y-6">
          {renderSkillGroup('technical', 'talent:skills.technical')}
          {renderSkillGroup('soft', 'talent:skills.soft')}
        </div>
      </SectionCard>
    );
  }

  if (activeTab === 'languages') {
    return (
      <SectionCard title={t('talent:tabs.languages')}>
        <div className="space-y-3">
          {(form.languages || []).map((row, i) => (
            <div key={i} className="grid sm:grid-cols-[1fr_160px_auto] gap-2 items-center">
              <input className={inputClass} placeholder={t('talent:languages.language')} value={row.language} onChange={(e) => updateArrayItem(setForm, 'languages', i, { language: e.target.value })} />
              <select className={inputClass} value={row.proficiency} onChange={(e) => updateArrayItem(setForm, 'languages', i, { proficiency: e.target.value })}>
                {['basic', 'conversational', 'professional', 'native'].map((k) => (
                  <option key={k} value={k}>{t(`talent:languageLevel.${k}`)}</option>
                ))}
              </select>
              <Button type="button" variant="outline" onClick={() => removeArrayItem(setForm, 'languages', i)}>{t('talent:languages.remove')}</Button>
            </div>
          ))}
        </div>
        <Button type="button" variant="secondary" className="mt-4" onClick={() => addArrayItem(setForm, 'languages', emptyLanguage)}>{t('talent:languages.add')}</Button>
      </SectionCard>
    );
  }

  if (activeTab === 'certifications') {
    return (
      <SectionCard title={t('talent:tabs.certifications')}>
        <div className="space-y-4">
          {(form.certificationReferences || []).map((row, i) => (
            <div key={i} className="grid sm:grid-cols-2 gap-3 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-4">
              <input className={inputClass} placeholder={t('talent:certifications.name')} value={row.name} onChange={(e) => updateArrayItem(setForm, 'certificationReferences', i, { name: e.target.value })} />
              <input className={inputClass} placeholder={t('talent:certifications.issuer')} value={row.issuer} onChange={(e) => updateArrayItem(setForm, 'certificationReferences', i, { issuer: e.target.value })} />
              <input type="date" className={inputClass} value={row.issuedAt ? String(row.issuedAt).slice(0, 10) : ''} onChange={(e) => updateArrayItem(setForm, 'certificationReferences', i, { issuedAt: e.target.value })} />
              <input type="date" className={inputClass} value={row.expiresAt ? String(row.expiresAt).slice(0, 10) : ''} onChange={(e) => updateArrayItem(setForm, 'certificationReferences', i, { expiresAt: e.target.value })} />
              <input className={`${inputClass} sm:col-span-2`} placeholder={t('talent:certifications.url')} value={row.externalUrl} onChange={(e) => updateArrayItem(setForm, 'certificationReferences', i, { externalUrl: e.target.value })} />
              <Button type="button" variant="outline" onClick={() => removeArrayItem(setForm, 'certificationReferences', i)}>{t('talent:certifications.remove')}</Button>
            </div>
          ))}
        </div>
        <Button type="button" variant="secondary" className="mt-4" onClick={() => addArrayItem(setForm, 'certificationReferences', emptyCertification)}>{t('talent:certifications.add')}</Button>
      </SectionCard>
    );
  }

  if (activeTab === 'portfolio') {
    return (
      <SectionCard title={t('talent:tabs.portfolio')}>
        <div className="space-y-4">
          {(form.portfolioReferences || []).map((row, i) => (
            <div key={i} className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-4 space-y-3">
              <input className={inputClass} placeholder={t('talent:portfolio.title')} value={row.title} onChange={(e) => updateArrayItem(setForm, 'portfolioReferences', i, { title: e.target.value })} />
              <textarea className={inputClass} rows={2} placeholder={t('talent:portfolio.description')} value={row.description} onChange={(e) => updateArrayItem(setForm, 'portfolioReferences', i, { description: e.target.value })} />
              <input className={inputClass} placeholder={t('talent:portfolio.url')} value={row.url} onChange={(e) => updateArrayItem(setForm, 'portfolioReferences', i, { url: e.target.value })} />
              <input className={inputClass} placeholder={t('talent:portfolio.technologies')} value={formatListInput(row.technologies)} onChange={(e) => updateArrayItem(setForm, 'portfolioReferences', i, { technologies: parseListInput(e.target.value) })} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={row.featured} onChange={(e) => updateArrayItem(setForm, 'portfolioReferences', i, { featured: e.target.checked })} />
                {t('talent:portfolio.featured')}
              </label>
              <Button type="button" variant="outline" onClick={() => removeArrayItem(setForm, 'portfolioReferences', i)}>{t('talent:portfolio.remove')}</Button>
            </div>
          ))}
        </div>
        <Button type="button" variant="secondary" className="mt-4" onClick={() => addArrayItem(setForm, 'portfolioReferences', emptyPortfolio)}>{t('talent:portfolio.add')}</Button>
      </SectionCard>
    );
  }

  return null;
}
