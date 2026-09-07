/** Final public navbar IA (Phase 10). Labels are presentation; paths stay stable. */

export const PRIMARY_NAV_ITEMS = [
  { labelKey: 'navbar:home', path: '/' },
  { labelKey: 'navbar:jobs', path: '/jobs' },
  { labelKey: 'navbar:scholarshipsAndFunding', path: '/scholarships' },
  { labelKey: 'navbar:admissionsAndIntakes', path: '/admissions' },
  {
    labelKey: 'navbar:services',
    path: '/services',
    mega: [
      { labelKey: 'navbar:agentsDirectory', path: '/agents' },
      { labelKey: 'navbar:professionalMarketplace', path: '/agents/marketplace' },
      { labelKey: 'navbar:careerGuidance', path: '/career-guidance' },
      { labelKey: 'navbar:resumeBuilder', path: '/resume-builder' },
    ],
  },
];

/** @deprecated Phase 10 removed the public “More” menu. Kept empty for callers. */
export const SECONDARY_NAV_ITEMS = [];

export const DRAWER_NAV_ITEMS = PRIMARY_NAV_ITEMS;

export const FINAL_NAV_LABELS = [
  'Home',
  'Jobs',
  'Scholarships & Funding',
  'Admissions & Intakes',
  'Services',
];

/**
 * Phase 10: all eight items are primary. CMS Blog/Contact are not promoted into a More menu.
 */
export function splitNavForDesktop(resolvedItems) {
  if (!resolvedItems?.length) {
    return { primary: null, fromCmsSecondary: [] };
  }
  return { primary: resolvedItems, fromCmsSecondary: [] };
}
