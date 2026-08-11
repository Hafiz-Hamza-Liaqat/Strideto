import { CmsHomepage } from '../models/CmsHomepage.js';
import { CmsNavigation } from '../models/CmsNavigation.js';
import { CmsStaticPage } from '../models/CmsStaticPage.js';

/** Detect C.6.1 verify-script markers left in published CMS. */
export function isC61TestMarker(value) {
  return typeof value === 'string' && /^c61-test-/i.test(value);
}

/** Default header nav mirroring client Navbar.jsx */
export function defaultHeaderItems() {
  return [
    { label: 'Home', path: '/', visible: true, order: 0 },
    { label: 'Jobs', path: '/jobs', visible: true, order: 1 },
    { label: 'Scholarships & Funding', path: '/scholarships', visible: true, order: 2 },
    { label: 'Admissions & Intakes', path: '/admissions', visible: true, order: 3 },
    { label: 'Internships', path: '/internships', visible: true, order: 4 },
    {
      label: 'Study & Institutions',
      path: '/program-explorer',
      visible: true,
      order: 5,
      children: [
        { label: 'Program explorer', path: '/program-explorer', visible: true, order: 0 },
        { label: 'Schools & Colleges', path: '/schools-and-colleges', visible: true, order: 1 },
        { label: 'Foreign Studies', path: '/foreign-studies', visible: true, order: 2 },
        { label: 'International Scholarships', path: '/intl-scholarships', visible: true, order: 3 },
      ],
    },
    {
      label: 'Tests & Prep',
      path: '/tests',
      visible: true,
      order: 6,
      children: [
        { label: 'Test hub', path: '/tests', visible: true, order: 0 },
        { label: 'Exam Prep', path: '/exam-prep', visible: true, order: 1 },
      ],
    },
    {
      label: 'Services',
      path: '/services',
      visible: true,
      order: 7,
      children: [
        { label: 'Agents & agencies', path: '/agents', visible: true, order: 0 },
        { label: 'Professional services', path: '/agents/marketplace', visible: true, order: 1 },
        { label: 'Career Guidance', path: '/career-guidance', visible: true, order: 2 },
        { label: 'Resume Builder', path: '/resume-builder', visible: true, order: 3 },
        { label: 'Help Center', path: '/help-center', visible: true, order: 4 },
      ],
    },
  ];
}

function defaultFooterColumns() {
  return [
    {
      title: 'Discover',
      links: [
        { label: 'Jobs', path: '/jobs' },
        { label: 'Internships', path: '/internships' },
        { label: 'Scholarships & Funding', path: '/scholarships' },
        { label: 'Admissions & Intakes', path: '/admissions' },
        { label: 'Study & Institutions', path: '/program-explorer' },
        { label: 'Tests & Prep', path: '/tests' },
      ],
    },
    {
      title: 'Services',
      links: [
        { label: 'Agents / Professional Services', path: '/agents' },
        { label: 'Professional marketplace', path: '/agents/marketplace' },
        { label: 'Career Guidance', path: '/career-guidance' },
        { label: 'Resume Builder', path: '/resume-builder' },
      ],
    },
    {
      title: 'For organizations',
      links: [
        { label: 'Employer', path: '/employer/login' },
        { label: 'Agent / Agency', path: '/agent/login' },
        { label: 'Institution', path: '/institution/login' },
      ],
    },
    {
      title: 'Support',
      links: [
        { label: 'Help', path: '/help-center' },
        { label: 'Contact / Support', path: '/support' },
        { label: 'Sitemap', path: '/sitemap' },
      ],
    },
    {
      title: 'Legal',
      links: [
        { label: 'Privacy Policy', path: '/privacy-policy' },
        { label: 'Terms of Service', path: '/terms' },
        { label: 'Refund / Payment Policy', path: '/refund-policy' },
        { label: 'Cookie Policy', path: '/cookies' },
      ],
    },
  ];
}

const STATIC_PAGE_SEEDS = [
  { slug: 'about', pageType: 'about', title: 'About Us', heading: 'About Strideto' },
  { slug: 'contact', pageType: 'contact', title: 'Contact', heading: 'Contact Us' },
  { slug: 'faq', pageType: 'faq', title: 'FAQ', heading: 'Frequently Asked Questions' },
  { slug: 'privacy-policy', pageType: 'privacy', title: 'Privacy Policy', heading: 'Privacy Policy' },
  { slug: 'terms', pageType: 'terms', title: 'Terms of Service', heading: 'Terms of Service' },
  { slug: 'cookies', pageType: 'cookies', title: 'Cookie Policy', heading: 'Cookie Policy' },
  { slug: 'disclaimer', pageType: 'disclaimer', title: 'Disclaimer', heading: 'Disclaimer' },
  { slug: 'refund-policy', pageType: 'refund', title: 'Refund Policy', heading: 'Refund Policy' },
  { slug: 'careers', pageType: 'careers', title: 'Careers', heading: 'Careers at Strideto' },
  { slug: 'advertise', pageType: 'advertise', title: 'Advertise', heading: 'Advertise With Us' },
  { slug: 'help-center', pageType: 'help', title: 'Help Center', heading: 'Help Center' },
  { slug: 'support', pageType: 'support', title: 'Support', heading: 'Support' },
  { slug: 'services', pageType: 'services', title: 'Services', heading: 'Our Services' },
];

/**
 * Insert CMS defaults only when a document does not exist.
 * Never updates status, content, or admin edits on existing documents.
 */
async function insertIfMissing(Model, filter, defaults) {
  const existing = await Model.findOne(filter).select('_id').lean();
  if (existing) return 'skipped';
  await Model.create({ ...defaults, ...filter });
  return 'inserted';
}

/**
 * Production-safe CMS bootstrap: insert-only defaults for empty collections.
 * Set CMS_SEED_ON_START=0 to skip entirely at startup.
 */
export async function seedCmsSiteContent() {
  const locales = ['en'];
  const stats = {
    mode: 'insert_only',
    homepage: { inserted: 0, skipped: 0 },
    headerNav: { inserted: 0, skipped: 0 },
    footerNav: { inserted: 0, skipped: 0 },
    staticPages: { inserted: 0, skipped: 0 },
  };

  for (const locale of locales) {
    const homepageResult = await insertIfMissing(
      CmsHomepage,
      { locale },
      {
        status: 'draft',
        hero: {
          headline: 'Find Jobs, Scholarships & Admissions in Pakistan',
          subheadline: 'Find jobs, scholarships, admissions, and study abroad opportunities — all in one place.',
          ctas: [
            { label: 'Government Jobs', url: '/jobs', style: 'secondary' },
            { label: 'Scholarships', url: '/scholarships', style: 'secondary' },
            { label: 'Start Exploring', url: '/jobs', style: 'primary' },
          ],
        },
        stats: [
          { label: 'Jobs', value: '1000+', icon: 'briefcase' },
          { label: 'Scholarships', value: '500+', icon: 'graduation-cap' },
          { label: 'Admissions', value: '200+', icon: 'university' },
        ],
        sections: {
          featuredJobs: { enabled: true, title: 'Trending Jobs', limit: 8 },
          featuredScholarships: { enabled: true, title: 'Latest Scholarships', limit: 6 },
          featuredAdmissions: { enabled: true, title: 'Upcoming Admissions', limit: 6 },
          testimonials: { enabled: false, title: 'What Students Say', items: [] },
          partners: { enabled: false, title: 'Our Partners', logos: [] },
          newsletter: { enabled: true, title: 'Get Daily Job & Scholarship Alerts', subtitle: 'Subscribe and we\'ll send you the latest opportunities.' },
        },
        seoTitle: 'Strideto – Jobs & Education Portal Pakistan',
        metaDescription: 'Pakistan\'s job and education portal. Find jobs, scholarships, admissions, internships, and study abroad opportunities.',
      }
    );
    stats.homepage[homepageResult] += 1;

    const headerResult = await insertIfMissing(
      CmsNavigation,
      { locale, placement: 'header' },
      { status: 'draft', items: defaultHeaderItems() }
    );
    stats.headerNav[headerResult] += 1;

    const footerResult = await insertIfMissing(
      CmsNavigation,
      { locale, placement: 'footer' },
      {
        status: 'draft',
        columns: defaultFooterColumns(),
        socialLinks: [
          { platform: 'twitter', url: 'https://twitter.com/strideto', icon: 'twitter' },
          { platform: 'linkedin', url: 'https://linkedin.com/company/strideto', icon: 'linkedin' },
          { platform: 'telegram', url: 'https://t.me/strideto', icon: 'telegram' },
        ],
        contact: { email: '', phone: '', address: '' },
        newsletterText: 'Get jobs, scholarships & admission alerts.',
        copyrightText: '© 2026 Strideto',
      }
    );
    stats.footerNav[footerResult] += 1;
  }

  for (const page of STATIC_PAGE_SEEDS) {
    for (const locale of locales) {
      const pageResult = await insertIfMissing(
        CmsStaticPage,
        { slug: page.slug, locale },
        {
          ...page,
          status: 'draft',
          content: '',
          sections: [],
          lastUpdatedManually: new Date(),
        }
      );
      stats.staticPages[pageResult] += 1;
    }
  }

  return stats;
}

const DEFAULT_HERO = {
  headline: 'Find Jobs, Scholarships & Admissions in Pakistan',
  subheadline: 'Find jobs, scholarships, admissions, and study abroad opportunities — all in one place.',
  ctas: [
    { label: 'Government Jobs', url: '/jobs', style: 'secondary' },
    { label: 'Scholarships', url: '/scholarships', style: 'secondary' },
    { label: 'Start Exploring', url: '/jobs', style: 'primary' },
  ],
};

/**
 * Reset published CMS docs corrupted by verify-sprint-c6-1 markers or truncated nav.
 * Safe to run repeatedly; only updates when corruption is detected.
 */
export async function restorePublishedCmsDefaults(locale = 'en') {
  const restored = { homepage: false, header: false, footer: false, about: false };

  const homepage = await CmsHomepage.findOne({ locale });
  if (homepage?.status === 'published' && isC61TestMarker(homepage.hero?.headline)) {
    homepage.hero = { ...(homepage.hero?.toObject?.() || homepage.hero || {}), ...DEFAULT_HERO };
    await homepage.save();
    restored.homepage = true;
  }

  const header = await CmsNavigation.findOne({ locale, placement: 'header' });
  const headerCorrupt = header?.status === 'published' && (
    (header.items?.length ?? 0) < 3
    || header.items?.some((i) => isC61TestMarker(i.label))
  );
  if (headerCorrupt) {
    header.items = defaultHeaderItems();
    await header.save();
    restored.header = true;
  }

  const footer = await CmsNavigation.findOne({ locale, placement: 'footer' });
  if (footer?.status === 'published' && isC61TestMarker(footer.copyrightText)) {
    footer.copyrightText = '© 2026 Strideto';
    await footer.save();
    restored.footer = true;
  }

  const about = await CmsStaticPage.findOne({ slug: 'about', locale });
  if (about?.status === 'published' && isC61TestMarker(about.content)) {
    about.content = '';
    await about.save();
    restored.about = true;
  }

  return restored;
}
