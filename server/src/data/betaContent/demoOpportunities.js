import { BETA_EXTERNAL_ID_PREFIX, BETA_SLUG_PREFIX, BETA_DEMO_NOTE } from './constants.js';

function futureDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

/** Draft-only opportunity fixtures for admin QA (not public listings). */
export function buildDemoOpportunities() {
  const jobs = [
    {
      externalId: `${BETA_EXTERNAL_ID_PREFIX}demo-job-government`,
      slug: `${BETA_SLUG_PREFIX}demo-job-government`,
      title: `${BETA_DEMO_NOTE} Sample government job workflow`,
      company: 'Demo Public Sector Org',
      organization: 'Demo Public Sector Org',
      province: 'Punjab',
      city: 'Lahore',
      category: 'Government',
      type: 'full-time',
      jobType: 'Government',
      remote: false,
      hybrid: false,
      experience: 'Fresh Graduate',
      description: BETA_DEMO_NOTE,
      status: 'draft',
      applyType: 'external',
      applicationLink: 'https://www.ppsc.gop.pk/',
      sourceUrl: 'https://www.ppsc.gop.pk/',
      sourceWebsite: 'PPSC',
      deadline: futureDays(90),
      approvalStatus: 'approved',
      source: 'manual',
    },
    {
      externalId: `${BETA_EXTERNAL_ID_PREFIX}demo-job-private`,
      slug: `${BETA_SLUG_PREFIX}demo-job-private`,
      title: `${BETA_DEMO_NOTE} Sample private job workflow`,
      company: 'Demo Private Employer',
      organization: 'Demo Private Employer',
      province: 'Sindh',
      city: 'Karachi',
      category: 'IT',
      type: 'full-time',
      jobType: 'Private',
      remote: false,
      hybrid: true,
      experience: '1-2 years',
      description: BETA_DEMO_NOTE,
      status: 'draft',
      applyType: 'internal',
      deadline: futureDays(60),
      approvalStatus: 'approved',
      source: 'manual',
    },
    {
      externalId: `${BETA_EXTERNAL_ID_PREFIX}demo-job-internship`,
      slug: `${BETA_SLUG_PREFIX}demo-job-internship`,
      title: `${BETA_DEMO_NOTE} Sample internship posting`,
      company: 'Demo Private Employer',
      province: 'Islamabad',
      city: 'Islamabad',
      category: 'Education',
      type: 'internship',
      jobType: 'Internship',
      remote: true,
      hybrid: false,
      description: BETA_DEMO_NOTE,
      status: 'draft',
      applyType: 'internal',
      deadline: futureDays(45),
      approvalStatus: 'approved',
      source: 'manual',
    },
  ];

  const scholarships = [
    {
      slug: `${BETA_SLUG_PREFIX}demo-scholarship-ug`,
      title: `${BETA_DEMO_NOTE} Undergraduate scholarship template`,
      provider: 'Demo Provider',
      level: 'Undergraduate',
      fundingType: 'Fully Funded',
      country: 'Pakistan',
      description: BETA_DEMO_NOTE,
      status: 'draft',
      link: 'https://www.hec.gov.pk/',
      deadline: futureDays(120),
    },
    {
      slug: `${BETA_SLUG_PREFIX}demo-scholarship-grad`,
      title: `${BETA_DEMO_NOTE} Graduate scholarship template`,
      provider: 'Demo Provider',
      level: 'Graduate',
      fundingType: 'Partial',
      country: 'Pakistan',
      status: 'draft',
      link: 'https://www.hec.gov.pk/',
      deadline: futureDays(100),
    },
    {
      slug: `${BETA_SLUG_PREFIX}demo-scholarship-phd`,
      title: `${BETA_DEMO_NOTE} PhD scholarship template`,
      provider: 'Demo Provider',
      level: 'PhD',
      fundingType: 'Fully Funded',
      country: 'Pakistan',
      status: 'draft',
      link: 'https://www.hec.gov.pk/',
      deadline: futureDays(150),
    },
  ];

  const admissions = [
    {
      slug: `${BETA_SLUG_PREFIX}demo-admission-1`,
      program: `${BETA_DEMO_NOTE} BS Computer Science template`,
      institution: 'Demo University A',
      province: 'Punjab',
      city: 'Lahore',
      status: 'draft',
      applyLink: 'https://www.hec.gov.pk/',
      sourceUrl: 'https://www.hec.gov.pk/',
      deadline: futureDays(80),
    },
    {
      slug: `${BETA_SLUG_PREFIX}demo-admission-2`,
      program: `${BETA_DEMO_NOTE} MBA template`,
      institution: 'Demo University B',
      province: 'Sindh',
      city: 'Karachi',
      status: 'draft',
      applyLink: 'https://www.hec.gov.pk/',
      deadline: futureDays(70),
    },
  ];

  const internships = [
    {
      slug: `${BETA_SLUG_PREFIX}demo-internship-paid`,
      title: `${BETA_DEMO_NOTE} Paid internship template`,
      organization: 'Demo Org',
      province: 'Punjab',
      isPaid: true,
      status: 'draft',
      applicationLink: 'https://strideto.com/',
      deadline: futureDays(55),
    },
    {
      slug: `${BETA_SLUG_PREFIX}demo-internship-unpaid`,
      title: `${BETA_DEMO_NOTE} Unpaid internship template`,
      organization: 'Demo Org',
      province: 'Islamabad',
      isPaid: false,
      status: 'draft',
      applicationLink: 'https://strideto.com/',
      deadline: futureDays(50),
    },
  ];

  const intlScholarships = [
    {
      slug: `${BETA_SLUG_PREFIX}demo-intl-uk`,
      title: `${BETA_DEMO_NOTE} UK scholarship template`,
      country: 'UK',
      status: 'draft',
      link: 'https://www.gov.uk/browse/visas-immigration/student-visas',
      deadline: futureDays(200),
    },
    {
      slug: `${BETA_SLUG_PREFIX}demo-intl-germany`,
      title: `${BETA_DEMO_NOTE} Germany scholarship template`,
      country: 'Germany',
      status: 'draft',
      link: 'https://www.make-it-in-germany.com/en/study-training/study-in-germany',
      deadline: futureDays(180),
    },
  ];

  return { jobs, scholarships, admissions, internships, intlScholarships };
}
