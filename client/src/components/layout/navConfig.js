/** Shared public navbar hierarchy (E.1F-A). Paths match client/src/constants ROUTES. */

/** Core destinations shown in the wide-desktop primary nav. */
export const PRIMARY_NAV_ITEMS = [
  { labelKey: 'navbar:home', path: '/' },
  { labelKey: 'navbar:jobs', path: '/jobs' },
  { labelKey: 'navbar:scholarships', path: '/scholarships' },
  { labelKey: 'navbar:admissions', path: '/admissions' },
  { labelKey: 'navbar:internships', path: '/internships' },
  {
    labelKey: 'navbar:education',
    mega: [
      { labelKey: 'navbar:schoolsAndColleges', path: '/schools-and-colleges' },
      { labelKey: 'navbar:universities', path: '/intl-scholarships' },
      { labelKey: 'navbar:foreign', path: '/foreign-studies' },
    ],
  },
  { labelKey: 'navbar:examPrep', path: '/exam-prep' },
];

/** Lower-priority destinations relocated into “More” / mobile drawer. */
export const SECONDARY_NAV_ITEMS = [
  { labelKey: 'navbar:blog', path: '/blog' },
  { labelKey: 'navbar:contact', path: '/contact' },
  { labelKey: 'navbar:resume', path: '/resume-builder', tour: 'resume-builder' },
  { labelKey: 'navbar:careerGuidance', path: '/career-guidance', tour: 'career-guidance' },
];

/** Full public destinations for the mobile drawer (primary + secondary). */
export const DRAWER_NAV_ITEMS = [...PRIMARY_NAV_ITEMS, ...SECONDARY_NAV_ITEMS];

/**
 * When CMS supplies a full header list, treat Blog/Contact as secondary if present;
 * otherwise keep CMS order as primary and attach fixed tool links in More.
 */
export function splitNavForDesktop(resolvedItems) {
  if (!resolvedItems?.length) {
    return { primary: null, secondaryPaths: new Set(SECONDARY_NAV_ITEMS.map((i) => i.path)) };
  }

  const secondaryPaths = new Set(['/blog', '/contact']);

  const primary = [];
  const fromCmsSecondary = [];

  for (const item of resolvedItems) {
    if (item.path && secondaryPaths.has(item.path) && !item.mega) {
      fromCmsSecondary.push(item);
    } else {
      primary.push(item);
    }
  }

  return { primary, fromCmsSecondary, secondaryPaths };
}
