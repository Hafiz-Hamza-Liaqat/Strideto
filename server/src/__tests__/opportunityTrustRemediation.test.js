/**
 * Opportunity trust remediation tests.
 * Run: node src/__tests__/opportunityTrustRemediation.test.js
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  applyExplicitTargets,
  buildTrustAuditReport,
  formatRemediationSummary,
  reviewBetaSeedPayload,
} from '../data/opportunityTrustRemediation.js';
import { buildDemoOpportunities } from '../data/betaContent/demoOpportunities.js';
import { buildEditorialContent } from '../data/betaContent/editorial.js';
import { buildReferenceContent } from '../data/betaContent/referenceContent.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const now = new Date('2026-07-27T00:00:00.000Z');
const future = new Date('2026-09-01T00:00:00.000Z');
const past = new Date('2026-01-01T00:00:00.000Z');

const datasets = {
  jobs: [
    {
      _id: 'job-launch',
      externalId: 'launch-v1-job-1',
      status: 'active',
      title: 'Launch Synthetic Job',
      company: 'Demo Org',
      organization: 'Demo Org',
      province: 'Punjab',
      applicationLink: 'https://example.gov.pk/post',
      deadline: future,
    },
    {
      _id: 'job-verified',
      status: 'active',
      title: 'Assistant Director',
      company: 'Govt Org',
      organization: 'Govt Org',
      province: 'Punjab',
      sourceUrl: 'https://example.gov.pk/jobs/2',
      applicationLink: 'https://example.gov.pk/jobs/2/apply',
      deadline: future,
    },
    {
      _id: 'job-admin',
      status: 'active',
      title: 'Private Internal Role',
      company: 'Private Org',
      organization: 'Private Org',
      province: 'Sindh',
      deadline: future,
    },
  ],
  scholarships: [
    {
      _id: 'sch-legacy',
      status: 'active',
      title: 'DAAD PhD Scholarship 2026 – Canada (#150)',
      provider: 'DAAD',
      country: 'Canada',
      link: 'https://edurozgaar.pk/scholarships',
      deadline: future,
    },
    {
      _id: 'sch-hec',
      status: 'active',
      title: 'HEC Undergraduate Scholarship 2024 – Pakistan',
      provider: 'HEC',
      country: 'Pakistan',
      link: 'https://www.hec.gov.pk',
      deadline: future,
    },
    {
      _id: 'sch-qa',
      status: 'active',
      title: 'QA Scholarship 010012',
      provider: 'Germany',
      country: 'Germany',
      link: '',
      deadline: future,
    },
  ],
  admissions: [
    {
      _id: 'adm-launch',
      status: 'active',
      program: 'BS Computer Science',
      institution: 'GC University Lahore',
      province: 'Punjab',
      city: 'Lahore',
      session: 'Fall 2024',
      applyLink: 'https://www.gcu.edu.pk',
      source: 'manual',
      deadline: future,
    },
    {
      _id: 'adm-invalid',
      status: 'active',
      program: 'BS QA Testing',
      institution: 'QA University',
      session: 'Fall 2026',
      deadline: future,
    },
  ],
  internships: [
    {
      _id: 'int-expired',
      status: 'active',
      title: 'Project Qality Assurance',
      organization: 'Deveops Engineer',
      province: 'Punjab',
      applicationLink: 'https://www.lums.edu.pk/',
      deadline: past,
    },
  ],
  intlScholarships: [
    {
      _id: 'intl-invalid',
      status: 'active',
      title: 'Study Visa',
      country: 'Germany',
      provider: 'Office Admin Aurthorities',
      link: 'https://www.lums.edu.pk/',
    },
  ],
};

const audit = buildTrustAuditReport(datasets, now);
assert.strictEqual(audit.summaries.jobs.classifications.synthetic_launch_demo, 1);
assert.strictEqual(audit.summaries.jobs.classifications.verified_public, 1);
assert.strictEqual(audit.summaries.jobs.classifications.admin_manual_review, 1);
assert.strictEqual(audit.summaries.scholarships.classifications.synthetic_launch_demo, 1);
assert.strictEqual(audit.summaries.scholarships.classifications.potentially_valid_missing_metadata, 1);
assert.strictEqual(audit.summaries.scholarships.classifications.invalid_incomplete, 1);
assert.strictEqual(audit.summaries.admissions.classifications.synthetic_launch_demo, 1);
assert.strictEqual(audit.summaries.admissions.classifications.invalid_incomplete, 1);
assert.strictEqual(audit.summaries.internships.classifications.expired, 1);
assert.strictEqual(audit.summaries.intlScholarships.classifications.invalid_incomplete, 1);

const summary = formatRemediationSummary(audit);
assert.strictEqual(summary.examinedCount, 10);
assert.strictEqual(summary.wouldDraftCount, 6);
assert.strictEqual(summary.wouldCloseCount, 1);
assert.strictEqual(summary.rejectedAmbiguousCount, 2);

let updates = [];
const modelStub = () => ({
  updateOne: async (filter, update) => {
    updates.push({ filter, update });
    return { modifiedCount: 1 };
  },
});

const applyResult = await applyExplicitTargets(
  {
    Job: modelStub(),
    Scholarship: modelStub(),
    Admission: modelStub(),
    Internship: modelStub(),
    IntlScholarship: modelStub(),
  },
  audit.targets
);
assert.strictEqual(applyResult.drafted, 6);
assert.strictEqual(applyResult.closed, 1);
assert.strictEqual(updates.length, 7);
assert.ok(updates.every((u) => u.filter._id));
assert.ok(updates.every((u) => u.filter.status === 'active'));

// Idempotent second run: nothing changes.
const noChangeModel = () => ({
  updateOne: async () => ({ modifiedCount: 0 }),
});
const second = await applyExplicitTargets(
  {
    Job: noChangeModel(),
    Scholarship: noChangeModel(),
    Admission: noChangeModel(),
    Internship: noChangeModel(),
    IntlScholarship: noChangeModel(),
  },
  audit.targets
);
assert.strictEqual(second.drafted, 0);
assert.strictEqual(second.closed, 0);
assert.strictEqual(second.unchanged, 7);

// Beta seed review.
const betaReview = reviewBetaSeedPayload({
  demo: buildDemoOpportunities(),
  editorial: buildEditorialContent(),
  reference: buildReferenceContent(),
});
assert.strictEqual(betaReview.safeToRun.demoOpportunitiesRemainDraft, true);
assert.strictEqual(betaReview.safeToRun.blogsOriginalAndPublished, true);
assert.strictEqual(betaReview.safeToRun.careerArticlesOriginalAndPublished, true);
assert.strictEqual(betaReview.safeToRun.referenceProfilesClearlyLabeled, true);
assert.strictEqual(betaReview.safeToRun.webinarsFutureDated, true);
assert.strictEqual(betaReview.safeToRun.noEduRozgaarBranding, true);
assert.strictEqual(betaReview.insertionList.publicOpportunities.length, 0);

// Static safety checks.
const script = fs.readFileSync(path.join(__dirname, '../scripts/remediateProductionOpportunityTrust.js'), 'utf8');
assert.ok(!script.includes('deleteMany'));
assert.ok(!script.includes('dropDatabase'));
assert.ok(!script.includes('console.log(process.env.MONGO_URI'));
assert.ok(script.includes('--audit-target'));
assert.ok(script.includes('--dry-run-target-safe'));

console.log('opportunityTrustRemediation tests passed.');
