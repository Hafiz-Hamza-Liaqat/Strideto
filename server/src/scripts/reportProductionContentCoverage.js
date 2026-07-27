/**
 * Read-only production content coverage report (counts only).
 * Run: node src/scripts/reportProductionContentCoverage.js
 * Optional: --write-docs=../../docs/PRODUCTION_CONTENT_COVERAGE_SNAPSHOT.md
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { Job } from '../models/Job.js';
import { Scholarship } from '../models/Scholarship.js';
import { Admission } from '../models/Admission.js';
import { Internship } from '../models/Internship.js';
import { IntlScholarship } from '../models/IntlScholarship.js';
import { Blog } from '../models/Blog.js';
import { CareerArticle } from '../models/CareerArticle.js';
import { Institution } from '../models/Institution.js';
import { University } from '../models/University.js';
import { ForeignStudy } from '../models/ForeignStudy.js';
import { Webinar } from '../models/Webinar.js';
import { Company } from '../models/Company.js';
import { Employer } from '../models/Employer.js';
import { Exam } from '../models/Exam.js';
import { Quiz } from '../models/Quiz.js';
import { Mcq } from '../models/Mcq.js';
import { Assessment } from '../models/career/Assessment.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NOW = new Date();

function assertMongoUri() {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is not set. Refusing to connect.');
    process.exit(1);
  }
}

async function count(Model, filter = {}) {
  return Model.countDocuments(filter);
}

async function distinct(Model, field, filter = {}) {
  return Model.distinct(field, filter);
}

async function aggregatePastDeadlines(Model, deadlineField = 'deadline') {
  const q = { [deadlineField]: { $lt: NOW, $ne: null } };
  return count(Model, q);
}

async function jobCoverage() {
  const total = await count(Job);
  const active = await count(Job, { status: 'active' });
  const draft = await count(Job, { status: 'draft' });
  const closed = await count(Job, { status: 'closed' });
  const categories = await distinct(Job, 'category', { status: 'active' });
  const jobTypes = await distinct(Job, 'jobType', { status: 'active' });
  const missingSourceUrl = await count(Job, {
    status: 'active',
    $or: [{ sourceUrl: { $in: [null, ''] } }, { sourceUrl: { $exists: false } }],
  });
  const pastDeadline = await aggregatePastDeadlines(Job);
  const launchMarkers = await count(Job, { externalId: { $regex: /^launch-v1-/ } });
  const betaMarkers = await count(Job, { externalId: { $regex: /^beta-v1-/ } });
  return {
    collection: 'jobs',
    total,
    active,
    draft,
    closed,
    categories: categories.filter(Boolean).length,
    categoryValues: categories.filter(Boolean).slice(0, 25),
    jobTypes: jobTypes.filter(Boolean),
    missingSourceUrlActive: missingSourceUrl,
    pastDeadline,
    launchV1Count: launchMarkers,
    betaV1Count: betaMarkers,
  };
}

async function scholarshipCoverage() {
  const total = await count(Scholarship);
  const active = await count(Scholarship, { status: 'active' });
  const draft = await count(Scholarship, { status: 'draft' });
  const closed = await count(Scholarship, { status: 'closed' });
  const levels = await distinct(Scholarship, 'level', { status: 'active' });
  const funding = await distinct(Scholarship, 'fundingType', { status: 'active' });
  const missingLink = await count(Scholarship, {
    status: 'active',
    $or: [{ link: { $in: [null, ''] } }, { link: { $exists: false } }],
  });
  const pastDeadline = await aggregatePastDeadlines(Scholarship);
  const betaSlugs = await count(Scholarship, { slug: { $regex: /^beta-v1-/ } });
  return {
    collection: 'scholarships',
    total,
    active,
    draft,
    closed,
    levels,
    fundingTypes: funding,
    missingOfficialLinkActive: missingLink,
    pastDeadline,
    betaSlugCount: betaSlugs,
  };
}

async function admissionCoverage() {
  const total = await count(Admission);
  const active = await count(Admission, { status: 'active' });
  const draft = await count(Admission, { status: 'draft' });
  const closed = await count(Admission, { status: 'closed' });
  const institutions = await distinct(Admission, 'institution', { status: 'active' });
  const provinces = await distinct(Admission, 'province', { status: 'active' });
  const missingSourceUrl = await count(Admission, {
    status: 'active',
    $or: [{ sourceUrl: { $in: [null, ''] } }, { applyLink: { $in: [null, ''] } }],
  });
  const pastDeadline = await aggregatePastDeadlines(Admission);
  const betaSlugs = await count(Admission, { slug: { $regex: /^beta-v1-/ } });
  return {
    collection: 'admissions',
    total,
    active,
    draft,
    closed,
    institutionCount: institutions.filter(Boolean).length,
    provinces: provinces.filter(Boolean),
    missingSourceOrApplyActive: missingSourceUrl,
    pastDeadline,
    betaSlugCount: betaSlugs,
  };
}

async function internshipCoverage() {
  const total = await count(Internship);
  const active = await count(Internship, { status: 'active' });
  const draft = await count(Internship, { status: 'draft' });
  const closed = await count(Internship, { status: 'closed' });
  const pastDeadline = await aggregatePastDeadlines(Internship);
  const betaSlugs = await count(Internship, { slug: { $regex: /^beta-v1-/ } });
  return { collection: 'internships', total, active, draft, closed, pastDeadline, betaSlugCount: betaSlugs };
}

async function intlScholarshipCoverage() {
  const total = await count(IntlScholarship);
  const active = await count(IntlScholarship, { status: 'active' });
  const draft = await count(IntlScholarship, { status: 'draft' });
  const closed = await count(IntlScholarship, { status: 'closed' });
  const countries = await distinct(IntlScholarship, 'country', { status: 'active' });
  const missingLink = await count(IntlScholarship, {
    status: 'active',
    $or: [{ link: { $in: [null, ''] } }],
  });
  const pastDeadline = await count(IntlScholarship, {
    $or: [{ deadline: { $lt: NOW, $ne: null } }, { applicationDeadline: { $lt: NOW, $ne: null } }],
  });
  const betaSlugs = await count(IntlScholarship, { slug: { $regex: /^beta-v1-/ } });
  return {
    collection: 'intlscholarships',
    total,
    active,
    draft,
    closed,
    countries: countries.filter(Boolean),
    missingLinkActive: missingLink,
    pastDeadline,
    betaSlugCount: betaSlugs,
  };
}

async function blogCoverage() {
  const total = await count(Blog);
  const published = await count(Blog, { status: 'published' });
  const draft = await count(Blog, { status: 'draft' });
  const archived = await count(Blog, { status: 'archived' });
  const categories = await distinct(Blog, 'category', { status: 'published' });
  const betaSlugs = await count(Blog, { slug: { $regex: /^beta-v1-/ } });
  return {
    collection: 'blogs',
    total,
    published,
    draft,
    archived,
    categories: categories.filter(Boolean),
    betaSlugCount: betaSlugs,
  };
}

async function careerArticleCoverage() {
  const total = await count(CareerArticle);
  const published = await count(CareerArticle, { status: 'published' });
  const draft = await count(CareerArticle, { status: 'draft' });
  const archived = await count(CareerArticle, { status: 'archived' });
  const categories = await distinct(CareerArticle, 'category', { status: 'published' });
  const betaSlugs = await count(CareerArticle, { slug: { $regex: /^beta-v1-/ } });
  return {
    collection: 'careerarticles',
    total,
    published,
    draft,
    archived,
    categories: categories.filter(Boolean),
    betaSlugCount: betaSlugs,
  };
}

async function institutionCoverage() {
  const total = await count(Institution);
  const active = await count(Institution, { status: 'active' });
  const draft = await count(Institution, { status: 'draft' });
  const types = await distinct(Institution, 'type', { status: 'active' });
  const betaSlugs = await count(Institution, { slug: { $regex: /^beta-v1-/ } });
  return { collection: 'institutions', total, active, draft, types, betaSlugCount: betaSlugs };
}

async function universityCoverage() {
  const total = await count(University);
  const active = await count(University, { status: 'active' });
  const draft = await count(University, { status: 'draft' });
  const types = await distinct(University, 'type', { status: 'active' });
  const betaSlugs = await count(University, { slug: { $regex: /^beta-v1-/ } });
  return { collection: 'universities', total, active, draft, types, betaSlugCount: betaSlugs };
}

async function foreignStudyCoverage() {
  const total = await count(ForeignStudy);
  const active = await count(ForeignStudy, { status: 'active' });
  const draft = await count(ForeignStudy, { status: 'draft' });
  const countries = await distinct(ForeignStudy, 'country', { status: 'active' });
  const levels = await distinct(ForeignStudy, 'level', { status: 'active' });
  const betaSlugs = await count(ForeignStudy, { slug: { $regex: /^beta-v1-/ } });
  return {
    collection: 'foreignstudies',
    total,
    active,
    draft,
    countries: countries.filter(Boolean),
    levels: levels.filter(Boolean),
    betaSlugCount: betaSlugs,
  };
}

async function webinarCoverage() {
  const total = await count(Webinar);
  const upcoming = await count(Webinar, { scheduledAt: { $gte: NOW }, status: { $in: ['scheduled', 'live'] } });
  const draft = await count(Webinar, { status: 'draft' });
  const betaSlugs = await count(Webinar, { slug: { $regex: /^beta-v1-/ } });
  return { collection: 'webinars', total, upcoming, draft, betaSlugCount: betaSlugs };
}

async function companyCoverage() {
  const total = await count(Company);
  const active = await count(Company, { status: 'active' });
  const verified = await count(Company, { verified: true });
  const betaSlugs = await count(Company, { slug: { $regex: /^beta-v1-/ } });
  return { collection: 'companies', total, active, verified, betaSlugCount: betaSlugs };
}

async function employerCoverage() {
  const total = await count(Employer);
  const verified = await count(Employer, { verified: true });
  const betaSlugs = await count(Employer, { slug: { $regex: /^beta-v1-/ } });
  return { collection: 'employers', total, verified, betaSlugCount: betaSlugs };
}

async function examCoverage() {
  const total = await count(Exam);
  const active = await count(Exam, { status: 'active' });
  const draft = await count(Exam, { status: 'draft' });
  const betaSlugs = await count(Exam, { slug: { $regex: /^beta-v1-/ } });
  return { collection: 'exams', total, active, draft, betaSlugCount: betaSlugs };
}

async function quizCoverage() {
  const total = await count(Quiz);
  const active = await count(Quiz, { status: 'active' });
  const draft = await count(Quiz, { status: 'draft' });
  return { collection: 'quizzes', total, active, draft };
}

async function mcqCoverage() {
  const total = await count(Mcq);
  const active = await count(Mcq, { status: 'active' });
  const draft = await count(Mcq, { status: 'draft' });
  const subjects = await distinct(Mcq, 'subject', { status: 'active' });
  return { collection: 'mcqs', total, active, draft, subjects: subjects.filter(Boolean).slice(0, 20) };
}

async function assessmentCoverage() {
  const total = await count(Assessment);
  const published = await count(Assessment, { status: 'published' });
  const draft = await count(Assessment, { status: 'draft' });
  const archived = await count(Assessment, { status: 'archived' });
  const betaSlugs = await count(Assessment, { slug: { $regex: /^beta-v1-/ } });
  return { collection: 'assessments', total, published, draft, archived, betaSlugCount: betaSlugs };
}

function formatMarkdown(report) {
  const lines = [
    '# Production content coverage snapshot',
    '',
    `**Generated:** ${report.generatedAt}`,
    `**Mode:** Read-only (counts only; no PII)`,
    `**Database:** Connected via MONGO_URI (value not logged)`,
    '',
    '---',
    '',
  ];
  for (const section of report.sections) {
    lines.push(`## ${section.collection}`);
    lines.push('');
    for (const [k, v] of Object.entries(section)) {
      if (k === 'collection') continue;
      lines.push(`- **${k}:** ${Array.isArray(v) ? v.join(', ') || '(none)' : v}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

async function main() {
  assertMongoUri();
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 20000 });

  const sections = await Promise.all([
    jobCoverage(),
    scholarshipCoverage(),
    admissionCoverage(),
    internshipCoverage(),
    intlScholarshipCoverage(),
    blogCoverage(),
    careerArticleCoverage(),
    institutionCoverage(),
    universityCoverage(),
    foreignStudyCoverage(),
    webinarCoverage(),
    companyCoverage(),
    employerCoverage(),
    examCoverage(),
    quizCoverage(),
    mcqCoverage(),
    assessmentCoverage(),
  ]);

  const report = {
    generatedAt: NOW.toISOString(),
    sections,
  };

  console.log(JSON.stringify(report, null, 2));

  const writeArg = process.argv.find((a) => a.startsWith('--write-docs='));
  if (writeArg) {
    const rel = writeArg.split('=')[1];
    const outPath = path.isAbsolute(rel)
      ? rel
      : path.resolve(__dirname, '../../..', rel);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, formatMarkdown(report), 'utf8');
    console.error(`Wrote ${outPath}`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
