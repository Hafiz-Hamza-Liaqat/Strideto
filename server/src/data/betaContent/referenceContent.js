import { BETA_SLUG_PREFIX } from './constants.js';

function futureDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

/** Factual reference content with official website links (not job postings). */
export function buildReferenceContent() {
  const institutions = [
    {
      slug: `${BETA_SLUG_PREFIX}inst-school`,
      name: 'Strideto Reference — Model Secondary School (Beta)',
      type: 'school',
      city: 'Lahore',
      province: 'Punjab',
      website: 'https://www.punjab.gov.pk/',
      description: 'Reference institution profile for beta UI testing. Verify programs on official school or board sites.',
      status: 'active',
    },
    {
      slug: `${BETA_SLUG_PREFIX}inst-college`,
      name: 'Strideto Reference — Model Degree College (Beta)',
      type: 'college',
      city: 'Karachi',
      province: 'Sindh',
      website: 'https://www.sindh.gov.pk/',
      status: 'active',
    },
    {
      slug: `${BETA_SLUG_PREFIX}inst-technical`,
      name: 'Strideto Reference — Technical Institute (Beta)',
      type: 'technical_institute',
      city: 'Islamabad',
      province: 'Islamabad',
      website: 'https://www.navttc.gov.pk/',
      status: 'active',
    },
    {
      slug: `${BETA_SLUG_PREFIX}inst-training`,
      name: 'Strideto Reference — Training Center (Beta)',
      type: 'training_center',
      city: 'Peshawar',
      province: 'Khyber Pakhtunkhwa',
      website: 'https://www.kp.gov.pk/',
      status: 'active',
    },
  ];

  const universities = [
    {
      slug: `${BETA_SLUG_PREFIX}uni-public`,
      name: 'Reference Public University (Beta profile)',
      type: 'public',
      country: 'Pakistan',
      city: 'Lahore',
      province: 'Punjab',
      website: 'https://www.hec.gov.pk/',
      description: 'Beta profile for university pages. Program details must be confirmed on the official university site.',
      status: 'active',
    },
    {
      slug: `${BETA_SLUG_PREFIX}uni-private`,
      name: 'Reference Private University (Beta profile)',
      type: 'private',
      country: 'Pakistan',
      city: 'Karachi',
      province: 'Sindh',
      website: 'https://www.hec.gov.pk/',
      status: 'active',
    },
    {
      slug: `${BETA_SLUG_PREFIX}uni-semi`,
      name: 'Reference Semi-Government University (Beta profile)',
      type: 'semi-government',
      country: 'Pakistan',
      city: 'Islamabad',
      province: 'Islamabad',
      website: 'https://www.hec.gov.pk/',
      status: 'active',
    },
    {
      slug: `${BETA_SLUG_PREFIX}uni-other`,
      name: 'Reference University — Other category (Beta)',
      type: 'other',
      country: 'Pakistan',
      city: 'Multan',
      province: 'Punjab',
      website: 'https://www.hec.gov.pk/',
      status: 'active',
    },
  ];

  const foreignStudies = [
    {
      slug: `${BETA_SLUG_PREFIX}fs-germany`,
      country: 'Germany',
      level: 'Graduate',
      program: 'Study in Germany (official resources)',
      link: 'https://www.make-it-in-germany.com/en/study-training/study-in-germany',
      description: 'Orientation to official German study information. Not a specific admission offer.',
      status: 'active',
      deadline: futureDays(365),
    },
    {
      slug: `${BETA_SLUG_PREFIX}fs-uk`,
      country: 'UK',
      level: 'Undergraduate',
      program: 'UK student route overview',
      link: 'https://www.gov.uk/browse/visas-immigration/student-visas',
      status: 'active',
      deadline: futureDays(300),
    },
    {
      slug: `${BETA_SLUG_PREFIX}fs-australia`,
      country: 'Australia',
      level: 'Graduate',
      program: 'Study Australia portal',
      link: 'https://www.studyaustralia.gov.au/',
      status: 'active',
      deadline: futureDays(280),
    },
    {
      slug: `${BETA_SLUG_PREFIX}fs-canada`,
      country: 'Canada',
      level: 'PhD',
      program: 'Immigration study permits overview',
      link: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada.html',
      status: 'active',
      deadline: futureDays(260),
    },
    {
      slug: `${BETA_SLUG_PREFIX}fs-malaysia`,
      country: 'Malaysia',
      level: 'Undergraduate',
      program: 'Education Malaysia global',
      link: 'https://www.educationmalaysia.gov.my/',
      status: 'active',
      deadline: futureDays(240),
    },
    {
      slug: `${BETA_SLUG_PREFIX}fs-turkey`,
      country: 'Turkey',
      level: 'Other',
      program: 'Study in Turkey official portal',
      link: 'https://www.studyinturkey.gov.tr/',
      status: 'active',
      deadline: futureDays(220),
    },
  ];

  const webinars = [
    {
      slug: `${BETA_SLUG_PREFIX}webinar-profile`,
      title: 'Strideto Beta: Build your talent profile',
      description: 'Walkthrough of Strideto profile, resume upload, and application tracker (beta cohort).',
      scheduledAt: futureDays(14),
      durationMinutes: 45,
      status: 'scheduled',
      speakerName: 'Strideto Team',
      registrationUrl: 'https://strideto.com/contact',
    },
    {
      slug: `${BETA_SLUG_PREFIX}webinar-safety`,
      title: 'Strideto Beta: Spotting job scams',
      description: 'Safety practices when applying online in Pakistan (beta session).',
      scheduledAt: futureDays(21),
      durationMinutes: 40,
      status: 'scheduled',
      speakerName: 'Strideto Trust & Safety',
      registrationUrl: 'https://strideto.com/contact',
    },
  ];

  const companies = [
    {
      slug: `${BETA_SLUG_PREFIX}company-demo-a`,
      name: 'Strideto Beta Company A (Demo)',
      website: 'https://strideto.com/',
      industry: 'Technology',
      city: 'Lahore',
      province: 'Punjab',
      verified: true,
      verificationLevel: 'verified',
      status: 'active',
      description: 'Demo company shell for employer workflows—not a hiring guarantee.',
    },
    {
      slug: `${BETA_SLUG_PREFIX}company-demo-b`,
      name: 'Strideto Beta Company B (Demo)',
      website: 'https://strideto.com/',
      industry: 'Education',
      city: 'Karachi',
      province: 'Sindh',
      verified: true,
      verificationLevel: 'verified',
      status: 'active',
    },
  ];

  return { institutions, universities, foreignStudies, webinars, companies };
}
