/** Build a short factual summary for public Job discovery surfaces. */
export function buildJobDiscoverySummary(job = {}) {
  const title = String(job.title || '').trim();
  const company = String(job.organization || job.company || '').trim();
  const locationParts = [job.city, job.region || job.province, job.countryCode]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  const location = locationParts.join(', ');
  const type = String(job.type || '').trim().replace(/_/g, ' ');
  const mode = String(job.workMode || (job.remote ? 'remote' : job.hybrid ? 'hybrid' : '') || '').trim().replace(/_/g, '-');
  const lead = [
    company && title ? `${company} is hiring a ${type ? `${type} ` : ''}${mode ? `${mode} ` : ''}${title}` : title,
    location ? `in ${location}` : '',
  ].filter(Boolean).join(' ');
  if (!lead) return '';
  return `${lead}.`.replace(/\s+/g, ' ').slice(0, 300).replace(/[\s,;:.!?-]+$/, '.') ;
}
