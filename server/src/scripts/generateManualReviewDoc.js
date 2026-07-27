/**
 * Generate docs/PRODUCTION_OPPORTUNITY_MANUAL_REVIEW.md from production (read-only).
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Job } from '../models/Job.js';
import { Scholarship } from '../models/Scholarship.js';
import {
  classifyJob,
  classifyScholarship,
} from '../data/opportunityTrustRemediation.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const now = new Date();

function fmtDate(d) {
  if (!d) return '—';
  const x = d instanceof Date ? d : new Date(d);
  return Number.isNaN(x.getTime()) ? '—' : x.toISOString().slice(0, 10);
}

function isManual(item) {
  return item.classification === 'admin_manual_review'
    || item.classification === 'potentially_valid_missing_metadata';
}

function recommendJob(item) {
  if (item.classification === 'admin_manual_review') {
    return 'Add official source URL or application URL, then keep active; otherwise move to draft.';
  }
  return 'Review metadata.';
}

function recommendScholarship(item) {
  if (item.notes.includes('seed_title_pattern')) {
    return 'Verify against HEC official program page; update title/link or move to draft if synthetic.';
  }
  if (item.notes.includes('official_link_only')) {
    return 'Replace homepage-only link with program-specific official URL or move to draft.';
  }
  return 'Human verification required.';
}

async function main() {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI not set');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 20000 });

  const jobs = await Job.find({}).lean();
  const scholarships = await Scholarship.find({}).lean();

  const manualJobs = [];
  const manualScholarships = [];

  for (const doc of jobs) {
    const item = classifyJob(doc, now);
    if (!isManual(item)) continue;
    manualJobs.push({
      collection: 'jobs',
      title: doc.title || '—',
      organization: doc.company || doc.organization || '—',
      slug: doc.slug || '—',
      externalId: doc.externalId || '—',
      sourceUrl: doc.sourceUrl || '—',
      applicationUrl: doc.applicationLink || '—',
      deadline: fmtDate(doc.deadline),
      status: doc.status,
      auditReason: item.notes.join(', '),
      recommendation: recommendJob(item),
    });
  }

  for (const doc of scholarships) {
    const item = classifyScholarship(doc, now);
    if (!isManual(item)) continue;
    manualScholarships.push({
      collection: 'scholarships',
      title: doc.title || '—',
      organization: doc.provider || doc.university || '—',
      slug: doc.slug || '—',
      externalId: doc.externalId || '—',
      sourceUrl: doc.sourceUrl || '—',
      applicationUrl: doc.link || '—',
      deadline: fmtDate(doc.deadline),
      status: doc.status,
      auditReason: item.notes.join(', '),
      recommendation: recommendScholarship(item),
    });
  }

  const hecPattern = manualScholarships.filter((s) => s.auditReason.includes('seed_title_pattern'));
  const hecOfficialOnly = manualScholarships.filter((s) => s.auditReason.includes('official_link_only'));

  const lines = [
    '# Production opportunity manual review',
    '',
    'Records in this document are **not** changed by safe-now or deferred remediation scripts.',
    '',
    `Total manual-review records: **${manualJobs.length + manualScholarships.length}**`,
    '',
    '## Admin-created jobs (1)',
    '',
  ];

  for (const row of manualJobs) {
    lines.push(
      `### ${row.title}`,
      '',
      '| Field | Value |',
      '|-------|-------|',
      `| Collection | ${row.collection} |`,
      `| Title | ${row.title} |`,
      `| Organization | ${row.organization} |`,
      `| Slug | ${row.slug} |`,
      `| External ID | ${row.externalId} |`,
      `| Source URL | ${row.sourceUrl} |`,
      `| Application URL | ${row.applicationUrl} |`,
      `| Deadline | ${row.deadline} |`,
      `| Current status | ${row.status} |`,
      `| Audit reason | ${row.auditReason} |`,
      `| Recommended decision | ${row.recommendation} |`,
      '',
    );
  }

  lines.push('## HEC generated-pattern scholarships (13)', '');
  for (const row of hecPattern) {
    lines.push(
      `### ${row.title}`,
      '',
      '| Field | Value |',
      '|-------|-------|',
      `| Collection | ${row.collection} |`,
      `| Title | ${row.title} |`,
      `| Organization | ${row.organization} |`,
      `| Slug | ${row.slug} |`,
      `| Application URL | ${row.applicationUrl} |`,
      `| Deadline | ${row.deadline} |`,
      `| Current status | ${row.status} |`,
      `| Audit reason | ${row.auditReason} |`,
      `| Recommended decision | ${row.recommendation} |`,
      '',
    );
  }

  lines.push('## HEC official-link-only scholarship (1)', '');
  for (const row of hecOfficialOnly) {
    lines.push(
      `### ${row.title}`,
      '',
      '| Field | Value |',
      '|-------|-------|',
      `| Collection | ${row.collection} |`,
      `| Title | ${row.title} |`,
      `| Organization | ${row.organization} |`,
      `| Slug | ${row.slug} |`,
      `| Application URL | ${row.applicationUrl} |`,
      `| Deadline | ${row.deadline} |`,
      `| Current status | ${row.status} |`,
      `| Audit reason | ${row.auditReason} |`,
      `| Recommended decision | ${row.recommendation} |`,
      '',
    );
  }

  const outPath = path.join(__dirname, '../../../docs/PRODUCTION_OPPORTUNITY_MANUAL_REVIEW.md');
  fs.writeFileSync(outPath, lines.join('\n'));
  console.log(JSON.stringify({
    jobs: manualJobs.length,
    scholarships: manualScholarships.length,
    hecPattern: hecPattern.length,
    hecOfficialOnly: hecOfficialOnly.length,
  }));

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
