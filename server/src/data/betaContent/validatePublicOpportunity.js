/**
 * Validation for public (active) opportunity records before insert.
 */
export function isFutureDate(value, now = new Date()) {
  if (!value) return false;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() > now.getTime();
}

/**
 * @param {object} record
 * @param {'job'|'scholarship'|'admission'|'internship'|'intlScholarship'} kind
 * @param {Date} [now]
 */
export function validatePublicOpportunity(record, kind, now = new Date()) {
  const errors = [];
  if (!record || typeof record !== 'object') {
    return { ok: false, errors: ['Record is required'] };
  }
  if (record.status !== 'active') {
    errors.push('Public records must have status active');
  }
  const deadline = record.deadline || record.applicationDeadline || record.lastDate;
  if (!isFutureDate(deadline, now)) {
    errors.push('Public records require a future deadline');
  }

  if (kind === 'job') {
    if (!record.sourceUrl || typeof record.sourceUrl !== 'string') {
      errors.push('Jobs require sourceUrl');
    }
    if (!record.title || !record.company) {
      errors.push('Jobs require title and company');
    }
  }
  if (kind === 'scholarship') {
    const url = record.link || record.sourceUrl;
    if (!url) errors.push('Scholarships require link (official source URL)');
  }
  if (kind === 'admission') {
    if (!record.sourceUrl && !record.applyLink) {
      errors.push('Admissions require sourceUrl or applyLink');
    }
  }
  if (kind === 'internship') {
    const url = record.applicationLink || record.sourceUrl;
    if (!url) errors.push('Internships require applicationLink or sourceUrl');
  }
  if (kind === 'intlScholarship') {
    if (!record.link) errors.push('International scholarships require link');
  }

  if (record._demo === true || String(record.externalId || '').includes('demo')) {
    errors.push('Demo records cannot be validated as public active');
  }

  return { ok: errors.length === 0, errors };
}

export function validateDemoRecord(record) {
  const errors = [];
  if (record.status !== 'draft') {
    errors.push('Demo records must be draft');
  }
  const marker =
    (record.externalId && String(record.externalId).startsWith('beta-v1-')) ||
    (record.slug && String(record.slug).startsWith('beta-v1-'));
  if (!marker) {
    errors.push('Demo records require beta-v1- externalId or slug');
  }
  return { ok: errors.length === 0, errors };
}
