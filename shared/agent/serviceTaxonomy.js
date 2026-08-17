import { AGENT_SERVICE_CATEGORIES } from './constants.js';

export const AGENT_SERVICE_CATEGORY_LABELS = Object.freeze({
  [AGENT_SERVICE_CATEGORIES.STUDY_ABROAD_GUIDANCE]: 'Study Abroad Guidance',
  [AGENT_SERVICE_CATEGORIES.UNIVERSITY_APPLICATION_SUPPORT]: 'University Application Support',
  [AGENT_SERVICE_CATEGORIES.SCHOLARSHIP_GUIDANCE]: 'Scholarship Guidance',
  [AGENT_SERVICE_CATEGORIES.TEST_GUIDANCE]: 'Test Guidance',
  [AGENT_SERVICE_CATEGORIES.DOCUMENT_REVIEW]: 'Document Review',
  [AGENT_SERVICE_CATEGORIES.CAREER_GUIDANCE]: 'Career Guidance',
  [AGENT_SERVICE_CATEGORIES.WORK_MOBILITY_GUIDANCE]: 'Work Mobility Guidance',
  [AGENT_SERVICE_CATEGORIES.VISA_PROCESS_GUIDANCE_INFORMATIONAL]: 'Visa Process Guidance (Informational)',
  [AGENT_SERVICE_CATEGORIES.OTHER]: 'Other',
});

export const AGENT_SERVICE_CATEGORY_OPTIONS = Object.freeze(
  Object.values(AGENT_SERVICE_CATEGORIES).map((value) => Object.freeze({
    value,
    label: AGENT_SERVICE_CATEGORY_LABELS[value],
  }))
);

export function isAgentServiceCategory(value) {
  return Object.hasOwn(AGENT_SERVICE_CATEGORY_LABELS, value);
}

export function agentServiceCategoryLabel(value) {
  return AGENT_SERVICE_CATEGORY_LABELS[value] || 'Other';
}
