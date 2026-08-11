import { getLanguageConfig } from '../i18n/config';
import { PIPELINE_STAGES } from '@shared/career/constants.js';

export const OPPORTUNITY_TYPE_FILTERS = ['all', 'job', 'scholarship', 'admission', 'internship'];

export const CHANNEL_FILTERS = ['all', 'internal_employer', 'external_personal', 'institution'];

export const SORT_OPTIONS = [
  { id: 'updated_desc', field: 'updatedAt', dir: -1 },
  { id: 'updated_asc', field: 'updatedAt', dir: 1 },
  { id: 'title_asc', field: 'title', dir: 1 },
  { id: 'stage_asc', field: 'pipelineStage', dir: 1 },
];

export function formatApplicationDate(dateStr, languageCode = 'en', options = {}) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  const locale = getLanguageConfig(languageCode).locale || 'en-PK';
  return d.toLocaleString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: options.time ? '2-digit' : undefined,
    minute: options.time ? '2-digit' : undefined,
  });
}

/**
 * Shared human-readable, i18n-compatible label for a canonical pipeline stage.
 * Routes through the existing `applications:stages.*` contract so no surface
 * exposes a raw enum slug (e.g. "screening", "negotiation", "joined").
 *
 * @param {(key: string, opts?: object) => string} t  react-i18next translator
 * @param {string} stage  canonical stage slug
 */
export function stageLabel(t, stage) {
  if (!stage) return '';
  return t(`applications:stages.${stage}`, { defaultValue: stage });
}

export function stageBadgeClass(stage) {
  const terminal = ['rejected', 'withdrawn', 'joined'];
  const positive = ['accepted', 'offer', 'negotiation'];
  const active = ['applied', 'viewed', 'screening', 'assessment', 'interview'];
  if (terminal.includes(stage)) {
    if (stage === 'joined' || stage === 'accepted') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300';
    if (stage === 'withdrawn') return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
    return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
  }
  if (positive.includes(stage)) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300';
  if (active.includes(stage)) return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300';
  return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
}

export function filterApplications(applications, { type = 'all', query = '', channel = 'all' } = {}) {
  let list = [...applications];
  if (type !== 'all') {
    list = list.filter((a) => a.opportunityRef?.opportunityType === type);
  }
  if (channel !== 'all') {
    list = list.filter((a) => a.applicationChannel === channel);
  }
  const q = String(query || '').trim().toLowerCase();
  if (q) {
    list = list.filter((a) => {
      const hay = [
        a.title,
        a.companyName,
        a.opportunityRef?.opportunityType,
        a.pipelineStage,
        a.externalUrl,
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }
  return list;
}

export function sortApplications(applications, sortId = 'updated_desc') {
  const opt = SORT_OPTIONS.find((s) => s.id === sortId) || SORT_OPTIONS[0];
  const list = [...applications];
  list.sort((a, b) => {
    let av = a[opt.field];
    let bv = b[opt.field];
    if (opt.field === 'updatedAt' || opt.field === 'appliedAt') {
      av = new Date(av || 0).getTime();
      bv = new Date(bv || 0).getTime();
    } else if (opt.field === 'pipelineStage') {
      av = PIPELINE_STAGES.indexOf(av);
      bv = PIPELINE_STAGES.indexOf(bv);
    } else {
      av = String(av || '').toLowerCase();
      bv = String(bv || '').toLowerCase();
    }
    if (av < bv) return -1 * opt.dir;
    if (av > bv) return 1 * opt.dir;
    return 0;
  });
  return list;
}

export function applicationDisplayTitle(app, t) {
  if (app?.title) return app.title;
  const type = app?.opportunityRef?.opportunityType;
  if (type) return t(`applications:opportunityTypes.${type}`, { defaultValue: type });
  return t('applications:untitled');
}

export function opportunityDetailRoute(app) {
  const type = app?.opportunityRef?.opportunityType;
  const id = app?.opportunityRef?.opportunityId;
  if (!type || !id) return null;
  const map = {
    job: `/jobs/${id}`,
    scholarship: `/scholarships/${id}`,
    admission: `/admissions/${id}`,
    internship: `/internships/${id}`,
  };
  return map[type] || null;
}
