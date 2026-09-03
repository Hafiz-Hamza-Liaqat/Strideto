import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {
  projectPublicIntlScholarship,
  projectPublicIntlScholarshipListItem,
  projectPublicCareerArticle,
  projectPublicCareerArticleListItem,
} from '../../../shared/publicDiscovery/projectPublicDiscovery.js';

const root = path.resolve(process.cwd());
const intlController = fs.readFileSync(path.join(root, 'server/src/controllers/intlScholarshipsController.js'), 'utf8');
const careerController = fs.readFileSync(path.join(root, 'server/src/controllers/careerArticlesController.js'), 'utf8');

const internalSentinels = {
  __v: 7,
  adminNotes: 'private admin note',
  internalNotes: 'private internal note',
  launchEligible: true,
  fixture: true,
  createdBy: 'internal-user-id',
  updatedBy: 'internal-user-id-2',
  scheduledAt: new Date('2030-01-01'),
  views: 99,
  relatedArticleIds: ['internal-related-id'],
  sourceId: 'internal-source-id',
};

function assertNoInternalFields(value) {
  const json = JSON.stringify(value);
  for (const key of Object.keys(internalSentinels)) {
    assert.equal(json.includes(`"${key}"`), false, `public DTO must not expose ${key}`);
  }
}

test('IS1/IS3/IS8: international scholarship detail is positive, safe, and source-backed', () => {
  const scholarship = {
    _id: 'scholarship-id',
    slug: 'fulbright-intl',
    title: 'Fulbright International Scholarship',
    country: 'United States',
    university: 'Public University',
    provider: 'Official Provider',
    degreeLevel: 'Masters',
    fundingType: 'Fully funded',
    amount: 'Tuition and stipend',
    deadline: '2027-01-15',
    applicationDeadline: '2027-01-15',
    visaRequirements: 'Student visa required',
    description: 'Public scholarship description',
    eligibility: ['Eligible applicants'],
    link: 'https://official.example/apply',
    seoTitle: 'Fulbright scholarship',
    metaDescription: 'Official scholarship information',
    universityId: {
      _id: 'private-university-id',
      name: 'Public University',
      country: 'United States',
      website: 'https://university.example',
      description: 'Public university description',
    },
    status: 'active',
    ...internalSentinels,
  };
  const result = projectPublicIntlScholarship(scholarship, {
    related: [{ ...scholarship, _id: 'related-id', title: 'Related' }],
    relatedResources: [{ title: 'Study resource', href: '/study' }],
  });

  assert.equal(result.slug, scholarship.slug);
  assert.equal(result.title, scholarship.title);
  assert.equal(result.description, scholarship.description);
  assert.equal(result.link, scholarship.link);
  assert.equal(result.universityDetails.name, scholarship.universityId.name);
  assert.equal(result.universityDetails._id, undefined);
  assert.equal(result.related[0].title, 'Related');
  assertNoInternalFields(result);
});

test('IS4/IS5: international scholarship list and related records are bounded', () => {
  const scholarship = {
    _id: 'scholarship-id',
    slug: 'fulbright-intl',
    title: 'Fulbright',
    country: 'United States',
    description: 'Do not send full list description',
    eligibility: ['Do not send list eligibility'],
    link: 'https://official.example/apply',
    ...internalSentinels,
  };
  const list = projectPublicIntlScholarshipListItem(scholarship);
  assert.deepEqual(Object.keys(list).sort(), [
    '_id', 'amount', 'applicationDeadline', 'country', 'deadline', 'degreeLevel',
    'fundingType', 'isFeatured', 'link', 'provider', 'slug', 'title',
    'university', 'visaRequirements',
  ].sort());
  assert.equal(list.description, undefined);
  assertNoInternalFields(list);
});

test('IS6/IS7: slug remains public identity when Mongo-ID compatibility metadata is present', () => {
  const result = projectPublicIntlScholarship({ _id: 'mongo-id', slug: 'canonical-slug', title: 'Title' }, { canonicalSlug: 'canonical-slug' });
  assert.equal(result.slug, 'canonical-slug');
  assert.equal(result.canonicalSlug, 'canonical-slug');
  assert.equal(result._id, 'mongo-id');
  assert.equal(result.canonicalSlug.includes('mongo-id'), false);
});

test('IS2/IS7: international scholarship controller preserves active policy and ID-or-slug lookup', () => {
  assert.match(intlController, /const PUBLIC_STATUS = 'active'/);
  assert.match(intlController, /isObjectIdParam\(idOrSlug\)/);
  assert.match(intlController, /slug: idOrSlug/);
  assert.match(intlController, /projectPublicIntlScholarshipListItem/);
  assert.match(intlController, /projectPublicIntlScholarship\(doc/);
  assert.doesNotMatch(intlController, /res\.json\(\{ \.\.\.doc/);
});

test('CA1/CA3/CA6/CA7: career article detail preserves editorial content and excludes internals', () => {
  const article = {
    _id: 'article-id',
    slug: 'career-planning',
    title: 'Career Planning',
    excerpt: 'A useful summary',
    content: '<p>Editorial body remains unchanged.</p>',
    category: 'Planning',
    tags: ['career'],
    publishedAt: '2026-01-01',
    imageUrl: 'https://cdn.example/article.jpg',
    status: 'published',
    ...internalSentinels,
  };
  const result = projectPublicCareerArticle(article);
  assert.equal(result.slug, article.slug);
  assert.equal(result.title, article.title);
  assert.equal(result.excerpt, article.excerpt);
  assert.equal(result.summary, article.excerpt);
  assert.equal(result.content, article.content);
  assert.equal(result.imageUrl, article.imageUrl);
  assert.equal(result.views, undefined);
  assertNoInternalFields(result);
  assert.equal(result.author, undefined);
});

test('CA4/CA5: career article list projection is bounded and future-field safe', () => {
  const list = projectPublicCareerArticleListItem({
    _id: 'article-id',
    title: 'Career Planning',
    slug: 'career-planning',
    excerpt: 'Summary',
    content: 'Do not send detail content',
    relatedArticleIds: ['private-related-id'],
    ...internalSentinels,
  });
  assert.equal(list.content, undefined);
  assert.equal(list.relatedArticleIds, undefined);
  assert.equal(list.summary, 'Summary');
  assertNoInternalFields(list);
});

test('CA2: career article controller preserves published eligibility and uses projections', () => {
  assert.match(careerController, /const filter = \{ status: 'published' \}/);
  assert.match(careerController, /projectPublicCareerArticleListItem/);
  assert.match(careerController, /projectPublicCareerArticle\(article\)/);
  assert.match(careerController, /findLocalizedBySlug\(CareerArticle, slug, baseFilter/);
  assert.match(careerController, /\$inc: \{ views: 1 \}/);
  assert.doesNotMatch(careerController, /res\.json\(\{ \.\.\.article/);
});
