export const JOB_TYPE_ENUM = new Set(['Government', 'Private', 'Internship']);
export function validateJobType(value) {
  return value === undefined || value === null || value === '' || JOB_TYPE_ENUM.has(value);
}
export function normalizeJobType(value, explicitEvidence = false) {
  if (JOB_TYPE_ENUM.has(value)) return value;
  if (!explicitEvidence) return undefined;
  return undefined;
}
