/**
 * Canonical job family → specialization taxonomy (Track K / Mission B2).
 * Client- and server-safe: pure JS.
 *
 * Legacy family labels remain accepted for backward compatibility.
 * Ambiguous legacy categories stay user-correctable via mapLegacyCategory null.
 */

export const JOB_FAMILIES = Object.freeze([
  'Software & IT',
  'Data, AI & Analytics',
  'Data & AI', // legacy alias retained for stored records
  'Engineering',
  'Product & Project Management',
  'Design & Creative',
  'Marketing & Communications',
  'Marketing & Sales', // legacy
  'Sales & Business Development',
  'Finance & Accounting',
  'Business & Finance', // legacy
  'Human Resources & Recruiting',
  'Human Resources', // legacy
  'Operations & Supply Chain',
  'Operations & Support', // legacy
  'Customer Support & Success',
  'Legal, Compliance & Risk',
  'Legal & Compliance', // legacy
  'Education & Training',
  'Education', // legacy
  'Healthcare & Life Sciences',
  'Healthcare', // legacy
  'Research & Academia',
  'Research & Science', // legacy
  'Construction, Trades & Manufacturing',
  'Hospitality & Travel',
  'Media & Content',
  'Public Sector & Nonprofit',
  'Other',
]);

export const SPECIALIZATIONS_BY_FAMILY = Object.freeze({
  'Software & IT': Object.freeze([
    'Frontend',
    'Backend',
    'Full Stack',
    'Mobile',
    'DevOps',
    'Cloud',
    'Cybersecurity',
    'QA',
    'Software Development', // legacy-friendly
    'DevOps & Cloud',
    'IT Support',
    'QA & Testing',
    'Product Management',
  ]),
  'Data, AI & Analytics': Object.freeze([
    'Data Science',
    'Data Engineering',
    'Machine Learning',
    'Business Intelligence',
    'Analytics',
    'AI Research',
  ]),
  'Data & AI': Object.freeze([
    'Data Science',
    'Data Engineering',
    'Machine Learning',
    'Business Intelligence',
    'Analytics',
  ]),
  Engineering: Object.freeze([
    'Electrical',
    'Mechanical',
    'Civil',
    'Chemical',
    'Industrial',
    'Mechanical Engineering',
    'Electrical Engineering',
    'Civil Engineering',
    'Chemical Engineering',
    'Industrial Engineering',
    'Other Engineering',
  ]),
  'Product & Project Management': Object.freeze([
    'Product Management',
    'Project Management',
    'Program Management',
    'Scrum / Agile',
  ]),
  'Design & Creative': Object.freeze([
    'UI/UX Design',
    'Graphic Design',
    'Product Design',
    'Video & Motion',
    'Creative Direction',
  ]),
  'Marketing & Communications': Object.freeze([
    'Marketing',
    'Digital Marketing',
    'Communications',
    'Brand',
    'Content Marketing',
    'Public Relations',
  ]),
  'Marketing & Sales': Object.freeze([
    'Marketing',
    'Digital Marketing',
    'Sales',
    'Business Development',
    'Content Marketing',
  ]),
  'Sales & Business Development': Object.freeze([
    'Sales',
    'Business Development',
    'Account Management',
    'Partnerships',
  ]),
  'Finance & Accounting': Object.freeze([
    'Accounting',
    'Finance',
    'Audit',
    'Treasury',
    'Financial Planning',
  ]),
  'Business & Finance': Object.freeze([
    'Accounting',
    'Finance',
    'Consulting',
    'Operations Management',
    'General Business',
  ]),
  'Human Resources & Recruiting': Object.freeze([
    'Recruiting',
    'HR Operations',
    'People Operations',
    'Learning & Development',
  ]),
  'Human Resources': Object.freeze([
    'Recruiting',
    'HR Operations',
    'People Operations',
  ]),
  'Operations & Supply Chain': Object.freeze([
    'Operations',
    'Supply Chain',
    'Logistics',
    'Procurement',
  ]),
  'Operations & Support': Object.freeze([
    'Customer Support',
    'Operations',
    'Supply Chain',
    'Facilities',
    'Administrative Support',
  ]),
  'Customer Support & Success': Object.freeze([
    'Customer Support',
    'Customer Success',
    'Technical Support',
  ]),
  'Legal, Compliance & Risk': Object.freeze([
    'Legal',
    'Compliance',
    'Risk & Audit',
  ]),
  'Legal & Compliance': Object.freeze([
    'Legal',
    'Compliance',
    'Risk & Audit',
  ]),
  'Education & Training': Object.freeze([
    'Teaching',
    'Academic Administration',
    'Training & Development',
    'Curriculum Design',
  ]),
  Education: Object.freeze([
    'Teaching',
    'Academic Administration',
    'Training & Development',
    'Curriculum Design',
  ]),
  'Healthcare & Life Sciences': Object.freeze([
    'Nursing',
    'Clinical',
    'Pharmacy',
    'Allied Health',
    'Healthcare Administration',
    'Life Sciences',
  ]),
  Healthcare: Object.freeze([
    'Nursing',
    'Clinical',
    'Pharmacy',
    'Allied Health',
    'Healthcare Administration',
  ]),
  'Research & Academia': Object.freeze([
    'Research',
    'Academic Research',
    'Laboratory Science',
  ]),
  'Research & Science': Object.freeze([
    'Research',
    'Laboratory Science',
    'Environmental Science',
  ]),
  'Construction, Trades & Manufacturing': Object.freeze([
    'Construction',
    'Trades',
    'Manufacturing',
    'Quality Control',
  ]),
  'Hospitality & Travel': Object.freeze([
    'Hospitality',
    'Travel',
    'Food & Beverage',
    'Events',
  ]),
  'Media & Content': Object.freeze([
    'Journalism',
    'Content Production',
    'Broadcast',
    'Social Media',
  ]),
  'Public Sector & Nonprofit': Object.freeze([
    'Public Administration',
    'Nonprofit',
    'Policy',
    'Community Programs',
  ]),
  Other: Object.freeze(['General', 'Uncategorized']),
});

const FAMILY_SET = new Set(JOB_FAMILIES);

/** Deterministic legacy flat category → family/specialization (only unambiguous mappings). */
const LEGACY_CATEGORY_MAP = Object.freeze({
  Software: { jobFamily: 'Software & IT', specialization: 'Software Development' },
  IT: { jobFamily: 'Software & IT', specialization: 'IT Support' },
  Frontend: { jobFamily: 'Software & IT', specialization: 'Frontend' },
  Backend: { jobFamily: 'Software & IT', specialization: 'Backend' },
  'Data Science': { jobFamily: 'Data, AI & Analytics', specialization: 'Data Science' },
  Marketing: { jobFamily: 'Marketing & Communications', specialization: 'Marketing' },
  Content: { jobFamily: 'Media & Content', specialization: 'Content Production' },
  HR: { jobFamily: 'Human Resources & Recruiting', specialization: 'HR Operations' },
  Design: { jobFamily: 'Design & Creative', specialization: 'Graphic Design' },
  Finance: { jobFamily: 'Finance & Accounting', specialization: 'Finance' },
  Education: { jobFamily: 'Education & Training', specialization: 'Teaching' },
  Sales: { jobFamily: 'Sales & Business Development', specialization: 'Sales' },
  Research: { jobFamily: 'Research & Academia', specialization: 'Research' },
  Support: { jobFamily: 'Customer Support & Success', specialization: 'Customer Support' },
  Product: { jobFamily: 'Product & Project Management', specialization: 'Product Management' },
  Business: { jobFamily: 'Finance & Accounting', specialization: 'Financial Planning' },
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
