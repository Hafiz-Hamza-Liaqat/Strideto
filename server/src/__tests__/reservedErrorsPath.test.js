/**
 * Focused ScraperRun / NewsletterLog reserved-path rename tests (no DB).
 * Run: node src/__tests__/reservedErrorsPath.test.js
 */
import assert from 'assert';
import { resolveScraperErrorDetails } from '../models/ScraperRun.js';
import { resolveNewsletterErrorDetails } from '../models/NewsletterLog.js';
import { ScraperRun } from '../models/ScraperRun.js';
import { NewsletterLog } from '../models/NewsletterLog.js';

// Schema must not declare reserved path `errors`
assert.strictEqual(ScraperRun.schema.path('errors'), undefined);
assert.ok(ScraperRun.schema.path('errorDetails'));
assert.strictEqual(NewsletterLog.schema.path('errors'), undefined);
assert.ok(NewsletterLog.schema.path('errorDetails'));

// Prefer new field
assert.deepStrictEqual(
  resolveScraperErrorDetails({ errorDetails: ['a'], errors: ['legacy'] }),
  ['a']
);
assert.deepStrictEqual(
  resolveNewsletterErrorDetails({ errorDetails: ['n1'] }),
  ['n1']
);

// Legacy documents still readable
assert.deepStrictEqual(
  resolveScraperErrorDetails({ errors: ['old-scraper'] }),
  ['old-scraper']
);
assert.deepStrictEqual(
  resolveNewsletterErrorDetails({ errors: ['old-news'] }),
  ['old-news']
);

// Empty / missing
assert.deepStrictEqual(resolveScraperErrorDetails({}), []);
assert.deepStrictEqual(resolveNewsletterErrorDetails(null), []);

console.log('reservedErrorsPath tests passed.');
