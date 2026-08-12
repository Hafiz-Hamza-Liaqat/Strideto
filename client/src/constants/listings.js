import { PROVINCES } from './profileOptions';
import { JOB_FAMILIES, SPECIALIZATIONS_BY_FAMILY } from '@shared/career/jobTaxonomy.js';
import { ISO_3166_ALPHA2, countryDisplayName } from '@shared/international/country.js';

/** @deprecated Legacy flat categories — prefer jobFamily + specialization. */
export const JOB_CATEGORIES = [
  'Software', 'Data Science', 'Marketing', 'Content', 'HR', 'Design',
  'Finance', 'Education', 'Sales', 'Research', 'Support', 'Product',
  'Business', 'IT',
];

export { JOB_FAMILIES, SPECIALIZATIONS_BY_FAMILY, ISO_3166_ALPHA2, countryDisplayName };

export const SCHOLARSHIP_LEVELS = ['Undergraduate', 'Graduate', 'PhD', 'Other'];

export const SCHOLARSHIP_COUNTRIES = ['Pakistan', 'UK', 'USA', 'Australia', 'Other'];

export { PROVINCES };

export const SORT_OPTIONS = {
  jobs: [
    { value: 'newest', label: 'Newest first' },
    { value: 'deadline', label: 'Deadline approaching' },
  ],
  scholarships: [
    { value: 'newest', label: 'Newest first' },
    { value: 'deadline', label: 'Deadline approaching' },
  ],
  admissions: [
    { value: 'newest', label: 'Newest first' },
    { value: 'deadline', label: 'Deadline approaching' },
  ],
};
