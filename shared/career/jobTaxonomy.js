/**
 * Canonical job family → specialization taxonomy (Track K).
 * Client- and server-safe: pure JS.
 */

export const JOB_FAMILIES = Object.freeze([
  'Software & IT',
  'Data & AI',
  'Engineering',
  'Business & Finance',
  'Marketing & Sales',
  'Design & Creative',
  'Healthcare',
  'Education',
  'Operations & Support',
  'Legal & Compliance',
  'Research & Science',
  'Human Resources',
  'Other',
]);

export const SPECIALIZATIONS_BY_FAMILY = Object.freeze({
  'Software & IT': Object.freeze([
    'Software Development',
    'DevOps & Cloud',
    'Cybersecurity',
    'IT Support',
    'QA & Testing',
    'Product Management',
  ]),
  'Data & AI': Object.freeze([
    'Data Science',
    'Data Engineering',
    'Machine Learning',
    'Business Intelligence',
    'Analytics',
  ]),
  Engineering: Object.freeze([
    'Mechanical Engineering',
    'Electrical Engineering',
    'Civil Engineering',
    'Chemical Engineering',
    'Industrial Engineering',
    'Other Engineering',
  ]),
  'Business & Finance': Object.freeze([
    'Accounting',
    'Finance',
    'Consulting',
    'Operations Management',
    'General Business',
  ]),
  'Marketing & Sales': Object.freeze([
    'Marketing',
    'Digital Marketing',
    'Sales',
    'Business Development',
    'Content Marketing',
  ]),
  'Design & Creative': Object.freeze([
    'UI/UX Design',
    'Graphic Design',
    'Product Design',
    'Video & Motion',
    'Creative Direction',
  ]),
  Healthcare: Object.freeze([
    'Nursing',
    'Clinical',
    'Pharmacy',
    'Allied Health',
    'Healthcare Administration',
  ]),
  Education: Object.freeze([
    'Teaching',
    'Academic Administration',
    'Training & Development',
    'Curriculum Design',
  ]),
  'Operations & Support': Object.freeze([
    'Customer Support',
    'Operations',
    'Supply Chain',
    'Facilities',
    'Administrative Support',
  ]),
  'Legal & Compliance': Object.freeze([
    'Legal',
    'Compliance',
    'Risk & Audit',
  ]),
  'Research & Science': Object.freeze([
    'Research',
    'Laboratory Science',
    'Environmental Science',
  ]),
  'Human Resources': Object.freeze([
    'Recruiting',
    'HR Operations',
    'People Operations',
  ]),
  Other: Object.freeze(['General', 'Uncategorized']),
});

const FAMILY_SET = new Set(JOB_FAMILIES);

/** Deterministic legacy flat category → family/specialization (only unambiguous mappings). */
const LEGACY_CATEGORY_MAP = Object.freeze({
  Software: { jobFamily: 'Software & IT', specialization: 'Software Development' },
  IT: { jobFamily: 'Software & IT', specialization: 'IT Support' },
  'Data Science': { jobFamily: 'Data & AI', specialization: 'Data Science' },
  Marketing: { jobFamily: 'Marketing & Sales', specialization: 'Marketing' },
  Content: { jobFamily: 'Marketing & Sales', specialization: 'Content Marketing' },
  HR: { jobFamily: 'Human Resources', specialization: 'HR Operations' },
  Design: { jobFamily: 'Design & Creative', specialization: 'Graphic Design' },
  Finance: { jobFamily: 'Business & Finance', specialization: 'Finance' },
  Education: { jobFamily: 'Education', specialization: 'Teaching' },
  Sales: { jobFamily: 'Marketing & Sales', specialization: 'Sales' },
  Research: { jobFamily: 'Research & Science', specialization: 'Research' },
  Support: { jobFamily: 'Operations & Support', specialization: 'Customer Support' },
  Product: { jobFamily: 'Software & IT', specialization: 'Product Management' },
  Business: { jobFamily: 'Business & Finance', specialization: 'General Business' },
});

export function isValidJobFamily(value) {
  return typeof value === 'string' && FAMILY_SET.has(value.trim());
}

export function specializationsForFamily(family) {
  if (!isValidJobFamily(family)) return [];
  return [...(SPECIALIZATIONS_BY_FAMILY[family.trim()] || [])];
}

export function isValidSpecialization(family, specialization) {
  const specs = specializationsForFamily(family);
  return typeof specialization === 'string' && specs.includes(specialization.trim());
}

/**
 * Map a legacy flat category when the mapping is deterministic.
 * Returns null when ambiguous or unknown — caller should leave fields user-correctable.
 */
export function mapLegacyCategory(category) {
  if (!category || typeof category !== 'string') return null;
  const key = category.trim();
  return LEGACY_CATEGORY_MAP[key] || null;
}
