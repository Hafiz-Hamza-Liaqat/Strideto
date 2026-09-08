export const SCHOLARSHIP_DEADLINE_TYPES = Object.freeze({
  FIXED: 'fixed',
  COURSE_SPECIFIC: 'course_specific',
  ROLLING: 'rolling',
  MULTIPLE: 'multiple',
  NOT_PUBLISHED: 'not_published',
  CLOSED: 'closed',
});

const TYPES = new Set(Object.values(SCHOLARSHIP_DEADLINE_TYPES));
const TEXT_REQUIRED = new Set([
  SCHOLARSHIP_DEADLINE_TYPES.COURSE_SPECIFIC,
  SCHOLARSHIP_DEADLINE_TYPES.ROLLING,
  SCHOLARSHIP_DEADLINE_TYPES.MULTIPLE,
  SCHOLARSHIP_DEADLINE_TYPES.NOT_PUBLISHED,
]);

export function normalizeScholarshipDeadline({ deadline, deadlineType, deadlineText } = {}) {
  const hasDate = deadline !== undefined && deadline !== null && String(deadline).trim() !== '';
  const type = String(deadlineType || (hasDate ? SCHOLARSHIP_DEADLINE_TYPES.FIXED : SCHOLARSHIP_DEADLINE_TYPES.NOT_PUBLISHED)).trim().toLowerCase();
  const text = deadlineText == null ? '' : String(deadlineText).trim();
  if (!TYPES.has(type)) return { ok: false, error: `Unsupported deadline type: ${type}` };
  if (type === SCHOLARSHIP_DEADLINE_TYPES.FIXED) {
    if (!hasDate) return { ok: false, error: 'A fixed deadline requires a date' };
    const parsed = new Date(deadline);
    if (Number.isNaN(parsed.getTime())) return { ok: false, error: 'Fixed deadline must be a valid date' };
    return { ok: true, deadlineType: type, deadline: parsed, deadlineText: text || null };
  }
  if (TEXT_REQUIRED.has(type) && !text) return { ok: false, error: `${type} deadline requires deadline text` };
  return { ok: true, deadlineType: type, deadline: null, deadlineText: text || null };
}

export function isFixedScholarshipDeadline(record = {}) {
  return (record.deadlineType || (record.deadline ? SCHOLARSHIP_DEADLINE_TYPES.FIXED : null)) === SCHOLARSHIP_DEADLINE_TYPES.FIXED
    && Boolean(record.deadline);
}

export function scholarshipDeadlineDisplay(record = {}) {
  if (record.deadlineType === SCHOLARSHIP_DEADLINE_TYPES.FIXED && record.deadline) return { kind: 'fixed', value: record.deadline };
  if (record.deadlineText) return { kind: record.deadlineType || 'unknown', value: record.deadlineText };
  return null;
}
