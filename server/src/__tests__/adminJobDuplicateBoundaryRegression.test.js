/**
 * Admin job-duplication regression correction tests (STRIDETO-SEC-1).
 * Run: node src/__tests__/adminJobDuplicateBoundaryRegression.test.js
 *
 * Regression under test: commit f460f1e replaced the admin duplicate() endpoint's
 * blacklist-copy (copy everything except _id/createdAt/updatedAt/slug) with a
 * whitelist projection (buildJobDuplicateProjection) that silently dropped
 * isFeatured/isSponsored/planId/planType/expiresAt/paidUntil/priority/urgent/
 * boostLevel/source/scrapedAt/sourceUrl/sourceWebsite with no error, no warning,
 * and no dedicated test coverage of the controller endpoint itself.
 *
 * This suite verifies the corrected, explicitly-documented field contract in
 * server/src/services/jobWriteBoundary.js (JOB_DUPLICATE_PRESERVE_FIELDS /
 * JOB_DUPLICATE_RESET_FIELDS / JOB_DUPLICATE_FORBIDDEN_FIELDS) end to end,
 * without requiring a live database connection (schema validation only, no
 * .save()). See docs/STRIDETO_ADMIN_JOB_DUPLICATION_REGRESSION_CORRECTION_REPORT.md
 * for the full field-by-field rationale.
 */
import assert from 'assert';
import { readFileSync } from 'fs';
import mongoose from 'mongoose';
import { Job } from '../models/Job.js';
import {
  CANONICAL_JOB_PUBLICATION_FIELDS,
  JOB_DUPLICATE_PRESERVE_FIELDS,
  JOB_DUPLICATE_RESET_FIELDS,
  JOB_DUPLICATE_FORBIDDEN_FIELDS,
  buildJobDuplicateProjection,
} from '../services/jobWriteBoundary.js';

let assertions = 0;

function equal(actual, expected, message) {
  assert.strictEqual(actual, expected, message);
  assertions += 1;
}

function deepEqual(actual, expected, message) {
  assert.deepStrictEqual(actual, expected, message);
  assertions += 1;
}

function ok(value, message) {
  assert.ok(value, message);
  assertions += 1;
}

function throws(fn, message) {
  assert.throws(fn, message);
  assertions += 1;
}

equal(
  mongoose.connection.readyState,
  0,
  'no live database connection is used by this suite'
);

// ---------------------------------------------------------------------------
// 1. Exact preserve/reset/forbid inventory — canary against future schema drift.
// ---------------------------------------------------------------------------
const schemaTopLevelPaths = Object.keys(Job.schema.paths)
  .filter((path) => !path.includes('.'))
  .sort();
const classifiedPaths = [
  ...JOB_DUPLICATE_PRESERVE_FIELDS,
  ...JOB_DUPLICATE_RESET_FIELDS,
  ...JOB_DUPLICATE_FORBIDDEN_FIELDS,
].sort();

deepEqual(
  classifiedPaths,
  schemaTopLevelPaths,
  'every Job schema field is classified into exactly one of PRESERVE/RESET/FORBID, with no gaps and no overlaps'
);
equal(
  new Set(classifiedPaths).size,
  classifiedPaths.length,
  'no field is double-classified across the three groups'
);
equal(
  JOB_DUPLICATE_PRESERVE_FIELDS.length,
  34,
  'expected PRESERVE field count'
);
equal(JOB_DUPLICATE_RESET_FIELDS.length, 22, 'expected RESET field count');
equal(JOB_DUPLICATE_FORBIDDEN_FIELDS.length, 19, 'expected FORBID field count');
for (const field of CANONICAL_JOB_PUBLICATION_FIELDS) {
  ok(
    JOB_DUPLICATE_FORBIDDEN_FIELDS.includes(field),
    `canonical publication field "${field}" is classified FORBID`
  );
}

// ---------------------------------------------------------------------------
// Shared fixture builder
// ---------------------------------------------------------------------------
function baseSource(overrides = {}) {
  return {
    _id: new mongoose.Types.ObjectId(),
    title: 'Software Engineer',
    slug: 'software-engineer-punjab',
    company: 'Acme Corp',
    organization: 'Acme Corp Pvt Ltd',
    location: 'Lahore',
    province: 'Punjab',
    city: 'Lahore',
    category: 'IT',
    type: 'full-time',
    jobType: 'Private',
    educationRequirement: 'BSCS',
    experience: '2+ years',
    applyType: 'external',
    applicationLink: 'https://example.com/apply',
    description: 'Build things.',
    requirements: ['Node.js', 'React'],
    applicationInstructions: 'Apply online.',
    postedBy: new mongoose.Types.ObjectId(),
    employerId: new mongoose.Types.ObjectId(),
    status: 'active',
    deadline: new Date('2026-12-01T00:00:00.000Z'),
    logoUrl: 'https://example.com/logo.png',
    salaryRange: '100k-150k',
    skillsRequired: ['Node.js'],
    applyEmail: 'jobs@example.com',
    approvalStatus: 'approved',
    remote: true,
    hybrid: false,
    responsibilities: ['Ship features'],
    benefits: ['Health insurance'],
    gender: 'any',
    salaryCurrency: 'PKR',
    gallery: ['https://example.com/img1.png'],
    seoTitle: 'SEO title',
    metaDescription: 'SEO description',
    totalSeats: 3,
    autoCloseWhenFilled: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    ...overrides,
  };
}

function assertPreservedContentFields(projection, source) {
  for (const field of JOB_DUPLICATE_PRESERVE_FIELDS) {
    if (field === 'employerId' || field === 'postedBy') {
      equal(
        projection[field],
        source[field].toHexString(),
        `${field} is preserved as an equivalent canonical identifier string`
      );
    } else if (Object.prototype.hasOwnProperty.call(source, field)) {
      deepEqual(
        projection[field],
        source[field],
        `${field} is preserved verbatim`
      );
    }
  }
}

function assertResetAndForbiddenFieldsAbsent(projection) {
  for (const field of [
    ...JOB_DUPLICATE_RESET_FIELDS,
    ...JOB_DUPLICATE_FORBIDDEN_FIELDS,
  ]) {
    equal(
      Object.hasOwn(projection, field),
      false,
      `${field} is absent from the duplicate projection`
    );
  }
}

// ---------------------------------------------------------------------------
// 2. Ordinary manually-created Job
// ---------------------------------------------------------------------------
{
  const source = baseSource({ source: 'manual' });
  const projection = buildJobDuplicateProjection(source);
  assertPreservedContentFields(projection, source);
  assertResetAndForbiddenFieldsAbsent(projection);
}

// ---------------------------------------------------------------------------
// 3. Featured Job
// ---------------------------------------------------------------------------
{
  const source = baseSource({ isFeatured: true });
  const projection = buildJobDuplicateProjection(source);
  equal(
    Object.hasOwn(projection, 'isFeatured'),
    false,
    'isFeatured is reset, not carried over as a free promotion'
  );
}

// ---------------------------------------------------------------------------
// 4. Sponsored Job
// ---------------------------------------------------------------------------
{
  const source = baseSource({ isSponsored: true });
  const projection = buildJobDuplicateProjection(source);
  equal(
    Object.hasOwn(projection, 'isSponsored'),
    false,
    'isSponsored is reset, not carried over'
  );
}

// ---------------------------------------------------------------------------
// 5. Urgent / priority / boosted Job
// ---------------------------------------------------------------------------
{
  const source = baseSource({ urgent: true, priority: 7, boostLevel: 4 });
  const projection = buildJobDuplicateProjection(source);
  equal(Object.hasOwn(projection, 'urgent'), false, 'urgent is reset');
  equal(Object.hasOwn(projection, 'priority'), false, 'priority is reset');
  equal(Object.hasOwn(projection, 'boostLevel'), false, 'boostLevel is reset');
}

// ---------------------------------------------------------------------------
// 6. Plan-linked Job
// ---------------------------------------------------------------------------
{
  const source = baseSource({
    planId: new mongoose.Types.ObjectId(),
    planType: 'premium',
  });
  const projection = buildJobDuplicateProjection(source);
  equal(
    Object.hasOwn(projection, 'planId'),
    false,
    'planId is reset — a duplicate has not been purchased/assigned a plan'
  );
  equal(Object.hasOwn(projection, 'planType'), false, 'planType is reset');
}

// ---------------------------------------------------------------------------
// 7. Job with expiry / paid-until fields
// ---------------------------------------------------------------------------
{
  const source = baseSource({
    expiresAt: new Date('2026-12-31T00:00:00.000Z'),
    paidUntil: new Date('2026-11-30T00:00:00.000Z'),
  });
  const projection = buildJobDuplicateProjection(source);
  equal(
    Object.hasOwn(projection, 'expiresAt'),
    false,
    'expiresAt is reset — tied to the original paid listing window'
  );
  equal(
    Object.hasOwn(projection, 'paidUntil'),
    false,
    'paidUntil is reset — must not duplicate a paid transaction window'
  );
}

// ---------------------------------------------------------------------------
// 8. Scraped/imported Job with source attribution
// ---------------------------------------------------------------------------
{
  const source = baseSource({
    source: 'scraper',
    scrapedAt: new Date('2026-06-01T00:00:00.000Z'),
    sourceUrl: 'https://ppsc.gop.pk/job/123',
    sourceWebsite: 'PPSC',
    externalId: 'ppsc_123',
  });
  const projection = buildJobDuplicateProjection(source);
  equal(
    Object.hasOwn(projection, 'source'),
    false,
    'source is reset — the duplicate is an admin-originated draft, not a live tracked scrape'
  );
  equal(Object.hasOwn(projection, 'scrapedAt'), false, 'scrapedAt is reset');
  equal(Object.hasOwn(projection, 'sourceUrl'), false, 'sourceUrl is reset');
  equal(
    Object.hasOwn(projection, 'sourceWebsite'),
    false,
    'sourceWebsite is reset'
  );
  equal(
    Object.hasOwn(projection, 'externalId'),
    false,
    'externalId is forbidden — unique+sparse index, copying risks E11000'
  );
}

// ---------------------------------------------------------------------------
// 9. Job with analytics counters
// ---------------------------------------------------------------------------
{
  const source = baseSource({ views: 4820, applicationsCount: 96 });
  const projection = buildJobDuplicateProjection(source);
  equal(
    Object.hasOwn(projection, 'views'),
    false,
    'views is reset to the schema default of 0'
  );
  equal(
    Object.hasOwn(projection, 'applicationsCount'),
    false,
    'applicationsCount is reset to the schema default of 0'
  );
}

// ---------------------------------------------------------------------------
// 10. Job with applications (relationship lives on a separate Application
//     collection keyed by jobId — a duplicate Job document carries no
//     application-linkage field on Job itself, so no explicit application
//     data can leak through the projection by construction).
// ---------------------------------------------------------------------------
{
  const source = baseSource({ applicationsCount: 12 });
  const projection = buildJobDuplicateProjection(source);
  const hasAnyApplicationField = Object.keys(projection).some(
    (key) =>
      key.toLowerCase().includes('application') &&
      key !== 'applicationLink' &&
      key !== 'applicationInstructions'
  );
  equal(
    hasAnyApplicationField,
    false,
    'no application-relationship data is present on the duplicate projection'
  );
}

// ---------------------------------------------------------------------------
// 11. Job with moderation/publication state
// ---------------------------------------------------------------------------
{
  const source = baseSource({
    publicationState: 'active',
    publicationVersion: 3,
    currentSubmissionId: new mongoose.Types.ObjectId(),
    lastApprovedSubmissionId: new mongoose.Types.ObjectId(),
    publishedAt: new Date('2026-05-01T00:00:00.000Z'),
    visibleUntil: new Date('2026-08-01T00:00:00.000Z'),
    applicationsCloseAt: new Date('2026-07-25T00:00:00.000Z'),
    slugFrozenAt: new Date('2026-05-01T00:00:00.000Z'),
    policyVersion: 'v1',
    publicationUpdatedAt: new Date('2026-05-02T00:00:00.000Z'),
    publicationMigrationStatus: 'canonical_native',
  });
  const projection = buildJobDuplicateProjection(source);
  for (const field of CANONICAL_JOB_PUBLICATION_FIELDS) {
    equal(
      Object.hasOwn(projection, field),
      false,
      `${field} (canonical publication state) is excluded from duplicates`
    );
  }
}

// ---------------------------------------------------------------------------
// 12. Job with Free Beta moderation evidence (rejectionSummary references an
//     immutable JobModerationEvent — must never be duplicated onto a new doc).
// ---------------------------------------------------------------------------
{
  const source = baseSource({
    publicationState: 'rejected',
    rejectionSummary: {
      reasonCode: 'INCOMPLETE_DESCRIPTION',
      ownerMessage: 'Please add more detail.',
      eventId: new mongoose.Types.ObjectId(),
      decidedAt: new Date('2026-05-03T00:00:00.000Z'),
    },
  });
  const projection = buildJobDuplicateProjection(source);
  equal(
    Object.hasOwn(projection, 'rejectionSummary'),
    false,
    'rejectionSummary (moderation evidence) is never duplicated'
  );
}

// ---------------------------------------------------------------------------
// 13. Unknown / unexpected fields on the source object
// ---------------------------------------------------------------------------
{
  const source = baseSource({
    someFutureFieldNotYetInSchema: 'unexpected-value',
    legacyFlag: true,
  });
  const projection = buildJobDuplicateProjection(source);
  equal(
    Object.hasOwn(projection, 'someFutureFieldNotYetInSchema'),
    false,
    'unrecognized fields are never copied — the projection is an allowlist, not a blocklist'
  );
  equal(
    Object.hasOwn(projection, 'legacyFlag'),
    false,
    'unrecognized fields are excluded'
  );

  throws(
    () =>
      buildJobDuplicateProjection(
        baseSource({ gallery: [JSON.parse('{"__proto__":"unsafe"}')] })
      ),
    /Unsupported projection value at gallery\[0\]/,
    'a prototype-pollution key nested inside a preserved field fails safely rather than being silently cloned'
  );
}

// ---------------------------------------------------------------------------
// 14. Source object mutation guard
// ---------------------------------------------------------------------------
{
  const source = baseSource({
    isFeatured: true,
    planId: new mongoose.Types.ObjectId(),
    gallery: ['https://example.com/a.png', 'https://example.com/b.png'],
  });
  const snapshot = JSON.parse(JSON.stringify(source));
  buildJobDuplicateProjection(source);
  deepEqual(
    JSON.parse(JSON.stringify(source)),
    snapshot,
    'buildJobDuplicateProjection never mutates the source object'
  );
}

// ---------------------------------------------------------------------------
// 15. Projection/output aliases (company vs organization) and independent
//     cloning of nested structures.
// ---------------------------------------------------------------------------
{
  const source = baseSource({
    company: 'Acme Corp',
    organization: 'Acme Corp (Legal Name) Pvt Ltd',
    gallery: ['https://example.com/a.png'],
  });
  const projection = buildJobDuplicateProjection(source);
  equal(
    projection.company,
    'Acme Corp',
    'company alias is preserved independently'
  );
  equal(
    projection.organization,
    'Acme Corp (Legal Name) Pvt Ltd',
    'organization alias is preserved independently and not conflated with company'
  );
  ok(
    projection.gallery !== source.gallery,
    'array fields are cloned, not shared by reference'
  );
  deepEqual(
    projection.gallery,
    source.gallery,
    'cloned array contents remain equal'
  );
}

// ---------------------------------------------------------------------------
// 16. Forbidden-field defense-in-depth guard fires even if bypassed upstream.
// ---------------------------------------------------------------------------
{
  for (const forbiddenField of JOB_DUPLICATE_FORBIDDEN_FIELDS) {
    equal(
      JOB_DUPLICATE_PRESERVE_FIELDS.includes(forbiddenField),
      false,
      `${forbiddenField} is never present in the preserve allowlist`
    );
  }
}

// ---------------------------------------------------------------------------
// 17. Controller wiring — verify duplicate() uses the corrected projection and
//     the field-contract constants, without requiring a live DB or HTTP layer.
// ---------------------------------------------------------------------------
const adminJobSource = readFileSync(
  new URL('../controllers/admin/adminJobsController.js', import.meta.url),
  'utf8'
);
ok(
  adminJobSource.includes('buildJobDuplicateProjection(source)'),
  'duplicate() still uses the write-boundary projection'
);
ok(
  adminJobSource.includes("duplicateInput.status = 'draft'"),
  'duplicate() recomputes status explicitly'
);
ok(
  adminJobSource.includes("duplicateInput.approvalStatus = 'pending'"),
  'duplicate() recomputes approvalStatus explicitly'
);
ok(
  adminJobSource.includes('JOB_DUPLICATE_PRESERVE_FIELDS'),
  'duplicate() audit log references the preserve-field contract for traceability'
);
ok(
  adminJobSource.includes('JOB_DUPLICATE_RESET_FIELDS'),
  'duplicate() audit log references the reset-field contract for traceability'
);
equal(
  adminJobSource.includes('const doc = new Job(source)'),
  false,
  'duplicate() no longer constructs a Job from the complete unfiltered source'
);

// ---------------------------------------------------------------------------
// 18. End-to-end schema validation of a realistic duplicate (no .save(), no DB).
// ---------------------------------------------------------------------------
{
  const source = baseSource({
    isFeatured: true,
    isSponsored: true,
    urgent: true,
    priority: 9,
    boostLevel: 2,
    planId: new mongoose.Types.ObjectId(),
    planType: 'standard',
    expiresAt: new Date('2026-12-31T00:00:00.000Z'),
    paidUntil: new Date('2026-11-30T00:00:00.000Z'),
    source: 'scraper',
    scrapedAt: new Date('2026-06-01T00:00:00.000Z'),
    sourceUrl: 'https://ppsc.gop.pk/job/123',
    sourceWebsite: 'PPSC',
    externalId: 'ppsc_123',
    views: 4820,
    applicationsCount: 96,
    publicationState: 'active',
    publicationVersion: 3,
    currentSubmissionId: new mongoose.Types.ObjectId(),
    lastApprovedSubmissionId: new mongoose.Types.ObjectId(),
    publishedAt: new Date('2026-05-01T00:00:00.000Z'),
  });
  const projection = buildJobDuplicateProjection(source);
  const duplicateInput = {
    ...projection,
    title: `${source.title} (Copy)`,
    status: 'draft',
    approvalStatus: 'pending',
    slug: 'software-engineer-punjab-copy',
  };
  const doc = new Job(duplicateInput);
  await doc.validate();
  assertions += 1;

  equal(
    doc.title,
    'Software Engineer (Copy)',
    'title is recomputed with a Copy suffix'
  );
  equal(doc.status, 'draft', 'status is recomputed to draft');
  equal(
    doc.approvalStatus,
    'pending',
    'approvalStatus is recomputed to pending'
  );
  equal(
    doc.isFeatured,
    false,
    'isFeatured falls back to its schema default of false'
  );
  equal(
    doc.isSponsored,
    false,
    'isSponsored falls back to its schema default of false'
  );
  equal(doc.urgent, false, 'urgent falls back to its schema default of false');
  equal(doc.priority, 0, 'priority falls back to its schema default of 0');
  equal(doc.boostLevel, 0, 'boostLevel falls back to its schema default of 0');
  equal(doc.views, 0, 'views falls back to its schema default of 0');
  equal(
    doc.applicationsCount,
    0,
    'applicationsCount falls back to its schema default of 0'
  );
  equal(doc.planId, undefined, 'planId is not set on the duplicate');
  equal(
    doc.planType,
    null,
    'planType falls back to its schema default of null'
  );
  equal(doc.expiresAt, undefined, 'expiresAt is not set on the duplicate');
  equal(doc.paidUntil, undefined, 'paidUntil is not set on the duplicate');
  equal(
    doc.source,
    'manual',
    'source falls back to its schema default of manual'
  );
  equal(doc.scrapedAt, undefined, 'scrapedAt is not set on the duplicate');
  equal(doc.sourceUrl, undefined, 'sourceUrl is not set on the duplicate');
  equal(
    doc.sourceWebsite,
    undefined,
    'sourceWebsite is not set on the duplicate'
  );
  equal(
    doc.externalId,
    undefined,
    'externalId is not set on the duplicate (avoids unique-index collision)'
  );
  equal(
    doc.publicationState,
    undefined,
    'publicationState is not set on the duplicate'
  );
  equal(
    doc.currentSubmissionId,
    undefined,
    'currentSubmissionId is not set on the duplicate'
  );
  equal(
    doc.lastApprovedSubmissionId,
    undefined,
    'lastApprovedSubmissionId is not set on the duplicate'
  );
  equal(doc.company, source.company, 'company content is preserved end to end');
  equal(
    doc.employerId.toHexString(),
    source.employerId.toHexString(),
    'employerId ownership is preserved end to end'
  );
}

// ---------------------------------------------------------------------------
// 19. Behavioral controller test — invokes the real, exported duplicate() handler
// (not source inspection) with Job and AuditLog mocked at the Mongoose-model
// boundary. This is safe without a live database: Job and AuditLog are the same
// singleton objects the controller and auditService.js already import (mongoose.model()
// returns one shared object per process), so patching their static/prototype methods here
// is visible to the controller's own calls without modifying any file outside this suite.
// mongoose.connect() is never called anywhere in this process, so no network connection to
// MongoDB is ever attempted regardless of what runs — unmocked Mongoose calls only ever
// buffer in-process and eventually time out internally; they can never reach a real server.
//
// onContentSaved('jobs', doc), called by duplicate() but not awaited, fires a background
// editorial-workflow sync (services/workflow/workflowIntegration.js's syncWorkflowAfterSave)
// that independently calls Job.findById(doc._id) — a SECOND, legitimate call with the new
// duplicate's own id, not the source id — and search-index scheduling this suite does not
// trace further. Because of that background call, findById/save/AuditLog.create calls are
// captured as arrays and matched by content (the specific id/document/payload this test
// caused), not by call count or position, so this test does not depend on how many
// background calls that unrelated, pre-existing workflow-sync plumbing happens to make.
// ---------------------------------------------------------------------------
{
  const { AuditLog } = await import('../models/AuditLog.js');
  const { duplicate } =
    await import('../controllers/admin/adminJobsController.js');

  const originalFindById = Job.findById;
  const originalFindOne = Job.findOne;
  const originalSave = Job.prototype.save;
  const originalAuditCreate = AuditLog.create;

  const fakeRes = () => {
    const calls = { status: [], json: [] };
    const res = {
      status(code) {
        calls.status.push(code);
        return res;
      },
      json(payload) {
        calls.json.push(payload);
        return res;
      },
    };
    res.__calls = calls;
    return res;
  };

  try {
    // --- Success path: a fully-loaded source (paid, featured, scraped, moderated) ---
    const sourceId = new mongoose.Types.ObjectId();
    const source = baseSource({
      _id: sourceId,
      isFeatured: true,
      isSponsored: true,
      urgent: true,
      priority: 3,
      boostLevel: 2,
      planId: new mongoose.Types.ObjectId(),
      planType: 'premium',
      expiresAt: new Date('2026-12-31T00:00:00.000Z'),
      paidUntil: new Date('2026-11-30T00:00:00.000Z'),
      source: 'scraper',
      scrapedAt: new Date('2026-06-01T00:00:00.000Z'),
      sourceUrl: 'https://ppsc.gop.pk/job/123',
      sourceWebsite: 'PPSC',
      externalId: 'ppsc_123',
      views: 500,
      applicationsCount: 40,
      publicationState: 'active',
      currentSubmissionId: new mongoose.Types.ObjectId(),
    });
    const sourceSnapshot = JSON.parse(JSON.stringify(source));

    const findByIdCalls = [];
    const findOneCalls = [];
    const saveCalls = [];
    const auditCalls = [];

    Job.findById = (id) => {
      findByIdCalls.push(id);
      // Any id queried in the background (e.g. the new duplicate's own id, via the
      // unrelated workflow-sync hook) safely resolves to the same fixture; only the
      // source-id lookup below is asserted on.
      return { lean: () => Promise.resolve(source) };
    };
    Job.findOne = (...args) => {
      findOneCalls.push(args);
      return Promise.resolve(null); // slug always available — no collision loop
    };
    Job.prototype.save = async function realSaveReplacement() {
      saveCalls.push(this);
      return this;
    };
    AuditLog.create = async (payload) => {
      auditCalls.push(payload);
      return { _id: new mongoose.Types.ObjectId(), ...payload };
    };

    const req = {
      params: { id: String(sourceId) },
      user: { userId: 'admin-1', role: 'admin', email: 'admin@example.com' },
      headers: {},
      socket: {},
    };
    const res = fakeRes();

    await duplicate(req, res);

    ok(
      findByIdCalls.includes(String(sourceId)),
      'duplicate() looks up the source Job by the requested id'
    );
    deepEqual(
      JSON.parse(JSON.stringify(source)),
      sourceSnapshot,
      'the source object is not mutated by the request'
    );
    ok(
      findOneCalls.length >= 1,
      'slug resolution checks uniqueness against Job.findOne'
    );

    const savedInstance = saveCalls.find(
      (doc) => doc.title === 'Software Engineer (Copy)'
    );
    ok(
      savedInstance,
      'the controller-driven save() call was captured (title recomputed with Copy suffix)'
    );
    equal(
      savedInstance.status,
      'draft',
      'behavioral: status is recomputed to draft'
    );
    equal(
      savedInstance.approvalStatus,
      'pending',
      'behavioral: approvalStatus is recomputed to pending'
    );
    ok(!!savedInstance.slug, 'behavioral: slug is recomputed (non-empty)');
    equal(
      savedInstance.company,
      source.company,
      'behavioral: preserved field survives (company)'
    );
    equal(
      savedInstance.employerId.toHexString(),
      source.employerId.toHexString(),
      'behavioral: preserved field survives (employerId)'
    );
    equal(
      savedInstance.isFeatured,
      false,
      'behavioral: isFeatured resets to schema default'
    );
    equal(
      savedInstance.isSponsored,
      false,
      'behavioral: isSponsored resets to schema default'
    );
    equal(
      savedInstance.priority,
      0,
      'behavioral: priority resets to schema default'
    );
    equal(
      savedInstance.urgent,
      false,
      'behavioral: urgent resets to schema default'
    );
    equal(
      savedInstance.boostLevel,
      0,
      'behavioral: boostLevel resets to schema default'
    );
    equal(savedInstance.planId, undefined, 'behavioral: planId is not set');
    equal(
      savedInstance.expiresAt,
      undefined,
      'behavioral: expiresAt is not set'
    );
    equal(
      savedInstance.paidUntil,
      undefined,
      'behavioral: paidUntil is not set'
    );
    equal(
      savedInstance.source,
      'manual',
      'behavioral: source resets to schema default'
    );
    equal(
      savedInstance.scrapedAt,
      undefined,
      'behavioral: scrapedAt is not set'
    );
    equal(
      savedInstance.sourceUrl,
      undefined,
      'behavioral: sourceUrl is not set'
    );
    equal(
      savedInstance.sourceWebsite,
      undefined,
      'behavioral: sourceWebsite is not set'
    );
    equal(
      savedInstance.externalId,
      undefined,
      'behavioral: externalId is not set (forbidden field)'
    );
    equal(
      savedInstance.publicationState,
      undefined,
      'behavioral: publicationState is not set (forbidden field)'
    );
    equal(
      savedInstance.currentSubmissionId,
      undefined,
      'behavioral: currentSubmissionId is not set (forbidden field)'
    );
    equal(savedInstance.views, 0, 'behavioral: views resets to schema default');
    equal(
      savedInstance.applicationsCount,
      0,
      'behavioral: applicationsCount resets to schema default'
    );

    const auditEntry = auditCalls.find((a) => a.action === 'job.duplicate');
    ok(auditEntry, 'the controller-driven audit-log call was captured');
    equal(
      auditEntry.targetType,
      'job',
      'audit log records the correct targetType'
    );
    deepEqual(
      Object.keys(auditEntry.metadata).sort(),
      ['preservedFieldCount', 'resetFieldCount', 'sourceId'],
      'audit metadata contains only the three expected keys — no field values are logged'
    );
    equal(
      auditEntry.metadata.sourceId,
      String(sourceId),
      'audit metadata sourceId matches the request'
    );
    equal(
      auditEntry.metadata.preservedFieldCount,
      JOB_DUPLICATE_PRESERVE_FIELDS.length,
      'audit metadata preservedFieldCount is exact'
    );
    equal(
      auditEntry.metadata.resetFieldCount,
      JOB_DUPLICATE_RESET_FIELDS.length,
      'audit metadata resetFieldCount is exact'
    );
    ok(
      !JSON.stringify(auditEntry.metadata).includes('PPSC') &&
        !JSON.stringify(auditEntry.metadata).includes('premium'),
      'no sensitive/reset field values leak into the audit metadata'
    );

    deepEqual(res.__calls.status, [201], 'response status is 201 exactly once');
    equal(res.__calls.json.length, 1, 'response body is sent exactly once');
    equal(
      res.__calls.json[0],
      savedInstance,
      'response body is the saved document'
    );

    // --- Bounded failure path: source Job not found ---
    Job.findById = () => ({ lean: () => Promise.resolve(null) });
    const saveCallCountBeforeMissing = saveCalls.length;
    const auditCallCountBeforeMissing = auditCalls.length;
    const missingReq = {
      params: { id: String(new mongoose.Types.ObjectId()) },
      user: {},
      headers: {},
      socket: {},
    };
    const missingRes = fakeRes();
    await duplicate(missingReq, missingRes);
    deepEqual(
      missingRes.__calls.status,
      [404],
      'missing source Job yields a 404, not a crash'
    );
    equal(
      saveCalls.length,
      saveCallCountBeforeMissing,
      'save() is never called when the source Job is missing'
    );
    equal(
      auditCalls.length,
      auditCallCountBeforeMissing,
      'audit log is never called when the source Job is missing'
    );
  } finally {
    Job.findById = originalFindById;
    Job.findOne = originalFindOne;
    Job.prototype.save = originalSave;
    AuditLog.create = originalAuditCreate;
  }
}

console.log(
  `adminJobDuplicateBoundaryRegression.test.js: ${assertions} assertions passed`
);

// onContentSaved() (contentIntegration.js) fires fire-and-forget search-index/workflow-sync
// hooks that are not mocked here (out of scope for this narrow field-contract correction) and
// may leave harmless pending Mongoose query-buffer timers since no mongoose.connect() ever runs
// in this process. Exit explicitly so the process does not wait on them.
process.exit(0);
