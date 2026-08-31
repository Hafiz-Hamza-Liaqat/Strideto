/**
 * P7-B international Test launch pack.
 *
 * This is a non-destructive, idempotent catalog seed. Existing records keyed
 * by stableId/slug are preserved so reviewed editorial changes are never
 * overwritten by a rerun.
 */
import { TestProvider } from '../models/education/TestProvider.js';
import { Test } from '../models/education/Test.js';
import { TestPrepGuide } from '../models/education/TestPrepGuide.js';
import { ExternalTestResource } from '../models/education/ExternalTestResource.js';
import { TEST_CATEGORIES, DELIVERY_MODES, PUB_STATUSES, RESOURCE_TYPES, TRUST_LEVELS } from '../../../shared/education/taxonomy.js';
import { isTestPubliclyPromotable } from '../../../shared/education/testPublicationPolicy.js';

export const INTERNATIONAL_TEST_VERIFIED_AT = '2026-08-31T00:00:00.000Z';

const evidence = (sourceUrl, publisher, sourceTitle) => ({
  sourceType: 'official_test_org',
  sourceUrl,
  publisher,
  verifiedAt: INTERNATIONAL_TEST_VERIFIED_AT,
  retrievedAt: INTERNATIONAL_TEST_VERIFIED_AT,
  evidenceRef: sourceTitle,
});

const providerPacks = [
  {
    stableId: 'ielts',
    name: 'IELTS',
    slug: 'ielts',
    provider: {
      name: 'IELTS Partners',
      slug: 'ielts-partners',
      organizationType: 'official_test_provider',
      officialWebsite: 'https://ielts.org/',
      helpUrl: 'https://ielts.org/take-a-test/prepare-for-your-test',
      countryCode: 'GB',
      region: 'International',
      sources: [evidence('https://ielts.org/', 'IELTS', 'IELTS official website')],
    },
    test: {
      stableId: 'ielts', name: 'International English Language Testing System', shortName: 'IELTS',
      slug: 'ielts', category: TEST_CATEGORIES.ENGLISH_PROFICIENCY,
      description: 'An English proficiency test commonly used for study, work and migration applications. Requirements vary by institution and pathway.',
      overview: 'Choose the IELTS test type that matches the receiving institution or authority, then confirm its current requirements directly.',
      purposes: ['English proficiency', 'study admissions', 'professional and migration pathways'], countryCodes: [],
      deliveryModes: [DELIVERY_MODES.COMPUTER_BASED, DELIVERY_MODES.IN_PERSON, DELIVERY_MODES.ONLINE],
      sections: ['Listening', 'Reading', 'Writing', 'Speaking'].map((name) => ({ name })),
      totalDurationMinutes: 165, scoreScale: 'Band score from 0 to 9; IELTS recommends results be considered valid for two years, subject to the receiving organization\'s policy', validityMonths: null,
      officialWebsite: 'https://ielts.org/take-a-test/test-types', registrationUrl: 'https://ielts.org/take-a-test/book-a-test',
      sources: [evidence('https://ielts.org/take-a-test/test-types', 'IELTS', 'IELTS test types'), evidence('https://ielts.org/take-a-test/your-results/ielts-scoring-in-detail', 'IELTS', 'IELTS scoring in detail')], displayOrder: 10,
    },
    resource: { provider: 'IELTS', title: 'Prepare for your IELTS test', url: 'https://ielts.org/take-a-test/prepare-for-your-test', resourceType: RESOURCE_TYPES.OFFICIAL_GUIDE },
  },
  {
    stableId: 'toefl-ibt',
    name: 'TOEFL iBT',
    slug: 'ets',
    provider: {
      name: 'ETS', slug: 'ets', organizationType: 'official_test_provider', officialWebsite: 'https://www.ets.org/',
      helpUrl: 'https://www.ets.org/toefl/test-takers/ibt/prepare.html', countryCode: 'US', region: 'International',
      sources: [evidence('https://www.ets.org/toefl/test-takers/ibt/about.html', 'ETS', 'TOEFL iBT official overview')],
    },
    test: {
      stableId: 'toefl-ibt', name: 'TOEFL iBT', shortName: 'TOEFL', slug: 'toefl-ibt', category: TEST_CATEGORIES.ENGLISH_PROFICIENCY,
      description: 'An academic English test designed to measure communication skills used in higher-education settings. Institutions set their own requirements.',
      overview: 'Review the current TOEFL iBT format and score reporting information, then check each institution before registering.',
      purposes: ['English proficiency', 'study admissions'], countryCodes: [],
      deliveryModes: [DELIVERY_MODES.COMPUTER_BASED, DELIVERY_MODES.AT_HOME, DELIVERY_MODES.IN_PERSON],
      sections: ['Reading', 'Listening', 'Speaking', 'Writing'].map((name) => ({ name })),
      totalDurationMinutes: 120, scoreScale: 'Overall and section scores use the 1-6 ETS scale in half-point increments; a comparable 0-120 overall score is also provided during the two-year transition after January 21, 2026', validityMonths: 24,
      officialWebsite: 'https://www.ets.org/toefl/test-takers/ibt/about.html', registrationUrl: 'https://www.ets.org/toefl/test-takers/ibt/register.html',
      sources: [evidence('https://www.ets.org/toefl/test-takers/ibt/scores/understand-scores.html', 'ETS', 'TOEFL iBT scores')], displayOrder: 20,
    },
    resource: { provider: 'ETS', title: 'TOEFL iBT preparation resources', url: 'https://www.ets.org/toefl/test-takers/ibt/prepare.html', resourceType: RESOURCE_TYPES.OFFICIAL_GUIDE },
  },
  {
    stableId: 'pte-academic', name: 'Pearson', slug: 'pearson',
    provider: {
      name: 'Pearson', slug: 'pearson', organizationType: 'official_test_provider', officialWebsite: 'https://www.pearsonpte.com/',
      helpUrl: 'https://www.pearsonpte.com/pte-academic/preparation/', countryCode: 'GB', region: 'International',
      sources: [evidence('https://www.pearsonpte.com/pte-academic/', 'Pearson', 'PTE Academic official website')],
    },
    test: {
      stableId: 'pte-academic', name: 'PTE Academic', shortName: 'PTE', slug: 'pte-academic', category: TEST_CATEGORIES.ENGLISH_PROFICIENCY,
      description: 'A computer-based English test used for university, professional and migration applications. Acceptance depends on the receiving organization.',
      overview: 'Confirm whether PTE Academic is accepted for the exact course, institution or pathway before booking.',
      purposes: ['English proficiency', 'study admissions', 'professional and migration pathways'], countryCodes: [],
      deliveryModes: [DELIVERY_MODES.COMPUTER_BASED, DELIVERY_MODES.IN_PERSON],
      sections: ['Speaking', 'Writing', 'Reading', 'Listening'].map((name) => ({ name })),
      totalDurationMinutes: 120, scoreScale: 'Overall and communicative skills scores on a 10–90 scale', validityMonths: 24,
      officialWebsite: 'https://www.pearsonpte.com/pte-academic/', registrationUrl: 'https://www.pearsonpte.com/book-a-test/',
      sources: [evidence('https://www.pearsonpte.com/help-center/general-faqs/pte-academic/', 'Pearson', 'PTE Academic general FAQs')], displayOrder: 30,
    },
    resource: { provider: 'Pearson PTE', title: 'PTE Academic preparation', url: 'https://www.pearsonpte.com/pte-academic/preparation/', resourceType: RESOURCE_TYPES.OFFICIAL_GUIDE },
  },
  {
    stableId: 'duolingo-english-test', name: 'Duolingo', slug: 'duolingo',
    provider: {
      name: 'Duolingo English Test', slug: 'duolingo-english-test', organizationType: 'official_test_provider', officialWebsite: 'https://englishtest.duolingo.com/',
      helpUrl: 'https://englishtest.duolingo.com/applicants/prepare', countryCode: 'US', region: 'International',
      sources: [evidence('https://englishtest.duolingo.com/', 'Duolingo English Test', 'Duolingo English Test official website')],
    },
    test: {
      stableId: 'duolingo-english-test', name: 'Duolingo English Test', shortName: 'DET', slug: 'duolingo-english-test', category: TEST_CATEGORIES.ENGLISH_PROFICIENCY,
      description: 'An online English proficiency test for applicants whose receiving institution or pathway accepts it. Acceptance must be checked directly.',
      overview: 'Use the official preparation and testing information, and verify acceptance with every intended institution or authority.',
      purposes: ['English proficiency', 'study admissions'], countryCodes: [],
      deliveryModes: [DELIVERY_MODES.ONLINE, DELIVERY_MODES.AT_HOME],
      sections: ['Reading', 'Writing', 'Listening', 'Speaking'].map((name) => ({ name })),
      totalDurationMinutes: 60, scoreScale: 'Score scale from 10 to 160', validityMonths: null,
      officialWebsite: 'https://englishtest.duolingo.com/', registrationUrl: 'https://englishtest.duolingo.com/applicants',
      sources: [evidence('https://englishtest.duolingo.com/applicants/prepare', 'Duolingo English Test', 'DET preparation')], displayOrder: 40,
    },
    resource: { provider: 'Duolingo English Test', title: 'Prepare for the Duolingo English Test', url: 'https://englishtest.duolingo.com/applicants/prepare', resourceType: RESOURCE_TYPES.OFFICIAL_GUIDE },
  },
  {
    stableId: 'gre', name: 'ETS', slug: 'ets-gre',
    provider: {
      name: 'ETS', slug: 'ets', organizationType: 'official_test_provider', officialWebsite: 'https://www.ets.org/',
      helpUrl: 'https://www.ets.org/gre/test-takers/general-test/prepare.html', countryCode: 'US', region: 'International',
      sources: [evidence('https://www.ets.org/gre/test-takers/general-test/about.html', 'ETS', 'GRE General Test official overview')],
    },
    test: {
      stableId: 'gre', name: 'GRE General Test', shortName: 'GRE', slug: 'gre', category: TEST_CATEGORIES.ADMISSIONS,
      description: 'A graduate admissions test measuring verbal reasoning, quantitative reasoning and analytical writing. Programs decide whether and how to use scores.',
      overview: 'Check the target graduate, business or law programs for current test requirements before preparing or registering.',
      purposes: ['graduate admissions', 'business and law admissions'], countryCodes: [],
      deliveryModes: [DELIVERY_MODES.COMPUTER_BASED, DELIVERY_MODES.AT_HOME, DELIVERY_MODES.IN_PERSON],
      sections: ['Analytical Writing', 'Verbal Reasoning', 'Quantitative Reasoning'].map((name) => ({ name })),
      totalDurationMinutes: 118, scoreScale: 'Verbal Reasoning and Quantitative Reasoning scores on 130-170 scales; Analytical Writing on 0-6', validityMonths: 60,
      officialWebsite: 'https://www.ets.org/gre/test-takers/general-test/about.html', registrationUrl: 'https://ereg.ets.org/ereg/public/jump/gre',
      sources: [evidence('https://www.ets.org/gre/score-users/about/general-test/content-structure.html', 'ETS', 'GRE General Test content and structure')], displayOrder: 50,
    },
    resource: { provider: 'ETS', title: 'GRE strategies and tips', url: 'https://www.ets.org/gre/test-takers/general-test/prepare/strategies-tips.html', resourceType: RESOURCE_TYPES.OFFICIAL_GUIDE },
  },
  {
    stableId: 'gmat', name: 'Graduate Management Admission Council', slug: 'gmac',
    provider: {
      name: 'Graduate Management Admission Council', slug: 'gmac', organizationType: 'official_test_provider', officialWebsite: 'https://www.mba.com/',
      helpUrl: 'https://www.mba.com/exams/gmat-exam/prepare', countryCode: 'US', region: 'International',
      sources: [evidence('https://www.mba.com/exams/gmat-exam/faqs', 'GMAC', 'GMAT official FAQs')],
    },
    test: {
      stableId: 'gmat', name: 'GMAT Exam', shortName: 'GMAT', slug: 'gmat', category: TEST_CATEGORIES.ADMISSIONS,
      description: 'A graduate business admissions exam measuring quantitative reasoning, verbal reasoning and data insights. Business programs set their own requirements.',
      overview: 'Use the GMAT when a target business or management program requires or accepts it, and confirm the current policy directly.',
      purposes: ['graduate business admissions', 'MBA and business master’s admissions'], countryCodes: [],
      deliveryModes: [DELIVERY_MODES.COMPUTER_BASED, DELIVERY_MODES.AT_HOME, DELIVERY_MODES.IN_PERSON],
      sections: ['Quantitative Reasoning', 'Verbal Reasoning', 'Data Insights'].map((name) => ({ name, durationMinutes: 45 })),
      totalDurationMinutes: 135, scoreScale: 'Total score from 205 to 805', validityMonths: 60,
      officialWebsite: 'https://www.mba.com/exams/gmat-exam', registrationUrl: 'https://www.mba.com/exams/gmat-exam/register',
      sources: [evidence('https://www.mba.com/exams/gmat-exam/about/exam-structure', 'GMAC', 'GMAT exam structure')], displayOrder: 60,
    },
    resource: { provider: 'GMAT', title: 'GMAT exam preparation', url: 'https://www.mba.com/exams/gmat-exam/prepare', resourceType: RESOURCE_TYPES.OFFICIAL_GUIDE },
  },
];

const guideFor = (pack) => ({
  title: `${pack.test.name} preparation guide`,
  overview: 'Start with the official format and requirements, establish a target based on the programs or pathways you are considering, and build a realistic study schedule. Requirements and test policies can change, so verify them before booking.',
  prepSequence: [
    ['Understand the current format', 'Read the official test information and note sections, timing, delivery requirements and score reporting.'],
    ['Assess your starting level', 'Use an official diagnostic or practice resource where available, then record strengths and gaps.'],
    ['Set a pathway-based target', 'Check the current requirements of each intended institution or program; do not assume one universal passing score.'],
    ['Build a weekly schedule', 'Plan regular sessions for each tested skill and reserve time for review and timed practice.'],
    ['Review weak areas', 'Use official explanations and feedback where available, and adjust the plan based on evidence.'],
  ].map(([title, description], index) => ({ order: index + 1, title, description })),
  recommendedDurationMinWeeks: 4,
  recommendedDurationMaxWeeks: 16,
  sectionPrep: pack.test.sections.map((section) => ({ sectionName: section.name, tips: ['Learn the task format from the official guide.', 'Practise the tested skill under the published time conditions.', 'Review errors and revisit the weakest skill area.'] })),
  testDayGuidance: 'Follow the provider’s current identity, device, environment and test-centre or at-home requirements. Confirm these requirements again before test day.',
  registrationGuidance: 'Register only through the official provider route and verify the receiving institution or pathway requirements before paying or selecting a date.',
  copyrightPolicyAcknowledged: true,
  status: PUB_STATUSES.PUBLISHED,
  sources: pack.test.sources,
});

const sameId = (left, right) => left != null && right != null && String(left) === String(right);

async function findExistingTest(TestModel, pack) {
  const byStableId = await TestModel.findOne({ stableId: pack.test.stableId });
  const bySlug = await TestModel.findOne({ slug: pack.test.slug });
  if (byStableId && bySlug && !sameId(byStableId._id, bySlug._id)) return { conflict: true };
  if (bySlug && bySlug.stableId && bySlug.stableId !== pack.test.stableId) return { conflict: true };
  if (byStableId && byStableId.slug && byStableId.slug !== pack.test.slug) return { conflict: true };
  return { test: byStableId || bySlug || null };
}

async function providerForTest(models, test) {
  if (!test?.providerId) return null;
  if (typeof test.providerId === 'object' && test.providerId.name) return test.providerId;
  return models.TestProvider.findById(test.providerId);
}

async function classifyExistingTest(models, pack, test, provider) {
  if (!test) return 'inserted';
  if (test.providerId && !sameId(test.providerId, provider?._id) && !sameId(test.providerId?._id, provider?._id)) return 'conflict';
  const populatedProvider = await providerForTest(models, test) || provider;
  return isTestPubliclyPromotable(test, populatedProvider) ? 'existing-eligible' : 'existing-ineligible';
}

export async function seedInternationalTests({ models = { TestProvider, Test, TestPrepGuide, ExternalTestResource } } = {}) {
  const counts = { providersCreated: 0, testsCreated: 0, guidesCreated: 0, resourcesCreated: 0 };
  const tests = [];
  for (const pack of providerPacks) {
    let provider = await models.TestProvider.findOne({ slug: pack.provider.slug });
    if (!provider) {
      provider = await models.TestProvider.findOneAndUpdate(
        { slug: pack.provider.slug },
        { $setOnInsert: { ...pack.provider, status: 'active' } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      counts.providersCreated += 1;
    }

    const existing = await findExistingTest(models.Test, pack);
    let test = existing.test;
    let outcome = existing.conflict ? 'conflict' : null;
    if (!outcome && !test) {
      test = await models.Test.findOneAndUpdate(
        { stableId: pack.test.stableId },
        { $setOnInsert: { ...pack.test, providerId: provider._id, status: PUB_STATUSES.PUBLISHED } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      counts.testsCreated += 1;
      outcome = await classifyExistingTest(models, pack, test, provider);
      outcome = outcome === 'existing-eligible' ? 'inserted' : outcome;
    } else if (!outcome) {
      outcome = await classifyExistingTest(models, pack, test, provider);
    }

    tests.push({ stableId: pack.test.stableId, slug: pack.test.slug, status: outcome });
    if (outcome === 'conflict' || outcome === 'existing-ineligible') continue;

    const guideFilter = { testId: test._id, status: PUB_STATUSES.PUBLISHED };
    if (!await models.TestPrepGuide.findOne(guideFilter)) {
      await models.TestPrepGuide.findOneAndUpdate(
        guideFilter,
        { $setOnInsert: { ...guideFor(pack), testId: test._id } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      counts.guidesCreated += 1;
    }
    const resourceFilter = { testId: test._id, url: pack.resource.url };
    if (!await models.ExternalTestResource.findOne(resourceFilter)) {
      await models.ExternalTestResource.findOneAndUpdate(
        resourceFilter,
        { $setOnInsert: { ...pack.resource, testId: test._id, trustLevel: TRUST_LEVELS.OFFICIAL, status: PUB_STATUSES.PUBLISHED, sources: pack.test.sources } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      counts.resourcesCreated += 1;
    }
  }
  return { ...counts, totalTests: providerPacks.length, tests };
}

export { providerPacks };
