import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { projectPublicBlog, projectPublicBlogListItem, projectPublicTest, projectPublicTestAlert, projectPublicTestPrepGuide, projectPublicTestResource } from '../../../shared/publicDiscovery/projectPublicDiscovery.js';

const blogController = readFileSync(new URL('../controllers/blogsController.js', import.meta.url), 'utf8');
const testController = readFileSync(new URL('../controllers/education/testController.js', import.meta.url), 'utf8');
const seoController = readFileSync(new URL('../controllers/seoController.js', import.meta.url), 'utf8');

test('Blog projections positively allowlist list and detail facts', () => {
  const source = {
    _id: 'blog-id', __v: 4, title: 'Public title', slug: 'public-title', excerpt: 'Excerpt', content: '<p>Body</p>',
    category: 'Guidance', tags: ['one'], authorName: 'Author', author: { _id: 'user-id', name: 'Ignored fallback' },
    publishedAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z', createdAt: '2025-12-01T00:00:00.000Z',
    imageUrl: 'https://example.com/image.jpg', imageAlt: 'Image', readingTime: 4, canonicalUrl: '/blog/public-title',
    seoTitle: 'SEO title', metaDescription: 'SEO description', ogImageUrl: 'https://example.com/og.jpg', gallery: ['https://example.com/g.jpg'],
    scheduledAt: '2099-01-01T00:00:00.000Z', views: 99, adminNotes: 'private', internalNotes: 'private', relatedArticleIds: ['internal-id'],
  };
  const detail = projectPublicBlog(source);
  const list = projectPublicBlogListItem(source);
  assert.equal(detail.title, source.title);
  assert.equal(detail.content, source.content);
  assert.equal(detail.authorDisplay, 'Author');
  assert.equal(list.excerpt, source.excerpt);
  for (const forbidden of ['__v', 'author', 'scheduledAt', 'views', 'adminNotes', 'internalNotes', 'relatedArticleIds']) {
    assert.equal(Object.hasOwn(detail, forbidden), false, `Blog detail leaked ${forbidden}`);
    assert.equal(Object.hasOwn(list, forbidden), false, `Blog list leaked ${forbidden}`);
  }
});

test('Test projection preserves page facts and removes internal evidence', () => {
  const source = {
    _id: 'test-id', __v: 2, stableId: 'ielts', slug: 'ielts', name: 'IELTS', shortName: 'IELTS', category: 'english_proficiency',
    providerId: { _id: 'provider-id', name: 'Provider', slug: 'provider', officialWebsite: 'https://provider.example', registrationUrl: 'https://provider.example/register', status: 'active' },
    description: 'Description', overview: 'Overview', purposes: ['admission'], countryCodes: ['GB'], deliveryModes: ['computer'],
    sections: [{ name: 'Reading', description: 'Read', durationMinutes: 60, weight: '25%', _id: 'nested-id' }], totalDurationMinutes: 180,
    scoreScale: '0-9', validityMonths: 24, registrationUrl: 'https://provider.example/register', officialWebsite: 'https://provider.example',
    sources: [{ sourceType: 'official', sourceUrl: 'https://provider.example/info', publisher: 'Provider', evidenceRef: 'private-ref', _id: 'source-id' }],
    launchEligible: true, isFixture: true, adminNotes: 'private', moderationNotes: 'private', createdBy: 'user-id', updatedBy: 'user-id',
  };
  const projected = projectPublicTest(source);
  assert.equal(projected.name, 'IELTS');
  assert.equal(projected.providerId.name, 'Provider');
  assert.equal(projected.providerId._id, undefined);
  assert.equal(projected.sections[0]._id, undefined);
  assert.equal(projected.sources[0].sourceUrl, 'https://provider.example/info');
  for (const forbidden of ['__v', 'launchEligible', 'isFixture', 'adminNotes', 'moderationNotes', 'createdBy', 'updatedBy']) {
    assert.equal(Object.hasOwn(projected, forbidden), false, `Test leaked ${forbidden}`);
  }
  assert.equal(Object.hasOwn(projected.sources[0], 'evidenceRef'), false);
});

test('Test nested public records are positively projected', () => {
  const guide = projectPublicTestPrepGuide({ title: 'Guide', testId: 'private', copyrightPolicyAcknowledged: true, nextReviewAt: '2099-01-01', prepSequence: [{ order: 1, title: 'Start', description: 'Step', _id: 'x' }], sources: [{ sourceUrl: 'https://example.com', evidenceRef: 'private' }] });
  const resource = projectPublicTestResource({ _id: 'resource-id', testId: 'private', title: 'Resource', provider: 'Provider', url: 'https://example.com', resourceType: 'guide', trustLevel: 'official', sources: [{ sourceUrl: 'https://example.com', evidenceRef: 'private' }], status: 'published' });
  const alert = projectPublicTestAlert({ _id: 'alert-id', testId: 'private', title: 'Alert', alertType: 'format_change', officialSourceUrl: 'https://example.com', sources: [{ sourceUrl: 'https://example.com', evidenceRef: 'private' }], publicationStatus: 'published', reviewedBy: 'private' });
  assert.equal(guide.prepSequence[0].title, 'Start');
  assert.equal(resource.url, 'https://example.com/');
  assert.equal(alert.officialSourceUrl, 'https://example.com/');
  for (const value of [guide, resource, alert]) {
    assert.equal(Object.hasOwn(value, 'testId'), false);
    assert.equal(Object.hasOwn(value, 'status'), false);
    assert.equal(Object.hasOwn(value, 'publicationStatus'), false);
    assert.equal(Object.hasOwn(value, 'evidenceRef'), false);
  }
});

test('public Blog/Test controllers and SEO use the projection boundary', () => {
  assert.match(blogController, /rows\.map\(projectPublicBlogListItem\)/);
  assert.match(blogController, /\.\.\.projectPublicBlog\(blog\)/);
  assert.match(testController, /\.map\(projectPublicTest\)/);
  assert.match(testController, /projectPublicTestPrepGuide\(prepGuide\)/);
  assert.match(testController, /projectPublicTestResource\)/);
  assert.match(testController, /projectPublicTestAlert\)/);
  assert.match(seoController, /const blog = projectPublicBlog\(doc\)/);
  assert.match(seoController, /const test = projectPublicTest\(doc\)/);
  assert.match(blogController, /status: 'published'/);
  assert.match(testController, /status: 'published'/);
  assert.match(testController, /isTestPubliclyPromotable/);
});
