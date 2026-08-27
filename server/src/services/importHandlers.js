import { Job } from '../models/Job.js';
import { Scholarship } from '../models/Scholarship.js';
import { Admission } from '../models/Admission.js';
import { Blog } from '../models/Blog.js';
import { Mcq } from '../models/Mcq.js';
import { CareerArticle } from '../models/CareerArticle.js';
import { ForeignStudy } from '../models/ForeignStudy.js';
import { Exam } from '../models/Exam.js';
import {
  jobSlug, scholarshipSlug, admissionSlug, blogSlug,
  foreignStudySlug, careerArticleSlug,
} from '../utils/slugify.js';
import { ensureSlugUnique } from '../utils/bulkUpsert.js';
import { createImportReport, recordError, pickField } from './importParserService.js';
import { sanitizeHtml, stripAllHtml } from '../utils/htmlSanitize.js';
import { validateApplicationLink } from '../utils/jobApplicationDestination.js';
import { onContentSaved } from '../utils/contentIntegration.js';
import {
  deriveImportLaunchEligible,
  resolveImportCmsStatus,
  resolveImportCountryCode,
} from './cmsImportPublication.js';

/** Redact destination-URL fields before echoing a rejected row back in an import report. */
function redactDestinationFields(row) {
  if (!row || typeof row !== 'object') return row;
  const redacted = { ...row };
  if (redacted.applicationLink !== undefined) redacted.applicationLink = '[redacted]';
  if (redacted.link !== undefined) redacted.link = '[redacted]';
  return redacted;
}

const IMPORT_HANDLERS = {
  jobs: importJobs,
  scholarships: importScholarships,
  admissions: importAdmissions,
  blogs: importBlogs,
  mcqs: importMcqs,
  'career-guidance': importCareerGuidance,
  'foreign-studies': importForeignStudies,
};

export function getImportableResources() {
  return Object.keys(IMPORT_HANDLERS);
}

export async function runImport(resource, rows) {
  const handler = IMPORT_HANDLERS[resource];
  if (!handler) throw new Error(`Unknown import resource: ${resource}`);
  return handler(rows);
}

async function importJobs(rows) {
  const report = createImportReport();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const title = pickField(row, 'title', 'job_title', 'jobtitle', 'position', 'role', 'name');
      const company = pickField(row, 'company', 'company_name', 'companyname', 'employer', 'organization', 'organisation', 'org');
      if (!title || !company) {
        throw new Error(
          'title and company are required (accepted columns: title, company, organization, employer, job title, company name)',
        );
      }

      const filter = { title, company };
      if (await Job.findOne(filter)) {
        report.skipped++;
        continue;
      }

      const rawLink = row.applicationLink || row.link || '';
      const linkResult = validateApplicationLink(rawLink);
      if (!linkResult.ok) {
        recordError(report, i, `${linkResult.field}: ${linkResult.message}`, redactDestinationFields(row));
        continue;
      }

      const baseSlug = jobSlug(title, row.province || row.location || '');
      const slug = await ensureSlugUnique(Job, baseSlug);
      const orgField = pickField(row, 'organization', 'organisation');

      await Job.create({
        title,
        slug,
        company,
        organization: orgField || company,
        location: row.location || '',
        province: row.province || '',
        city: row.city || '',
        category: row.category || 'General',
        type: row.type || 'full-time',
        jobType: row.jobType || 'Private',
        description: stripAllHtml(row.description),
        requirements: parseArray(row.requirements),
        deadline: row.deadline ? new Date(row.deadline) : undefined,
        status: row.status || 'active',
        source: 'manual',
        applicationLink: linkResult.value || '',
        approvalStatus: 'approved',
      });
      report.imported++;
    } catch (err) {
      recordError(report, i, err.message, row);
    }
  }
  return report;
}

async function importScholarships(rows) {
  const report = createImportReport();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const title = pickField(row, 'title', 'name', 'scholarship_title');
      const provider = pickField(row, 'provider', 'organization', 'organisation', 'sponsor', 'institution', 'company');
      if (!title || !provider) {
        throw new Error('title and provider are required (accepted columns: title, provider, organization)');
      }

      if (await Scholarship.findOne({ title, provider })) {
        report.skipped++;
        continue;
      }

      const baseSlug = scholarshipSlug(title, row.country || '');
      const slug = await ensureSlugUnique(Scholarship, baseSlug);
      const status = resolveImportCmsStatus(row);

      const doc = await Scholarship.create({
        title,
        slug,
        provider,
        level: row.level || 'Other',
        country: row.country || '',
        description: stripAllHtml(row.description),
        eligibility: parseArray(row.eligibility),
        deadline: row.deadline ? new Date(row.deadline) : undefined,
        link: row.link || '',
        status,
        launchEligible: false,
      });
      doc.launchEligible = deriveImportLaunchEligible(
        { ...doc.toObject(), launchEligible: row.launchEligible === true },
        status,
      );
      await doc.save();
      onContentSaved('scholarships', doc);
      report.imported++;
    } catch (err) {
      recordError(report, i, err.message, row);
    }
  }
  return report;
}

async function importAdmissions(rows) {
  const report = createImportReport();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const program = pickField(row, 'program', 'programme', 'degree', 'course');
      const institution = pickField(row, 'institution', 'university', 'college', 'school');
      if (!program || !institution) {
        throw new Error('program and institution are required (accepted columns: program, institution, university)');
      }

      if (await Admission.findOne({ program, institution })) {
        report.skipped++;
        continue;
      }

      const baseSlug = admissionSlug(program, institution);
      const slug = await ensureSlugUnique(Admission, baseSlug);
      const status = resolveImportCmsStatus(row);
      const countryCode = resolveImportCountryCode(row);
      const linkVal = row.link || row.applyLink || '';

      const doc = await Admission.create({
        program,
        slug,
        institution,
        university: row.university || institution,
        province: row.province || row.region || '',
        city: row.city || '',
        session: row.session || '',
        description: stripAllHtml(row.description),
        deadline: row.deadline ? new Date(row.deadline) : undefined,
        link: linkVal,
        applyLink: linkVal,
        status,
        source: 'manual',
        ...(countryCode ? { countryCode } : {}),
        launchEligible: false,
      });
      doc.launchEligible = deriveImportLaunchEligible(
        { ...doc.toObject(), launchEligible: row.launchEligible === true },
        status,
      );
      await doc.save();
      onContentSaved('admissions', doc);
      report.imported++;
    } catch (err) {
      recordError(report, i, err.message, row);
    }
  }
  return report;
}

async function importBlogs(rows) {
  const report = createImportReport();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const title = row.title?.trim();
      if (!title) throw new Error('title is required');

      if (await Blog.findOne({ title })) {
        report.skipped++;
        continue;
      }

      const baseSlug = blogSlug(title);
      const slug = await ensureSlugUnique(Blog, baseSlug);

      await Blog.create({
        title,
        slug,
        excerpt: row.excerpt || '',
        content: sanitizeHtml(row.content),
        category: row.category || 'General',
        tags: parseArray(row.tags),
        status: row.status || 'published',
        publishedAt: row.publishedAt ? new Date(row.publishedAt) : new Date(),
      });
      report.imported++;
    } catch (err) {
      recordError(report, i, err.message, row);
    }
  }
  return report;
}

async function importCareerGuidance(rows) {
  const report = createImportReport();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const title = row.title?.trim();
      if (!title) throw new Error('title is required');

      if (await CareerArticle.findOne({ title })) {
        report.skipped++;
        continue;
      }

      const baseSlug = careerArticleSlug(title);
      const slug = await ensureSlugUnique(CareerArticle, baseSlug);

      await CareerArticle.create({
        title,
        slug,
        excerpt: row.excerpt || '',
        content: sanitizeHtml(row.content),
        category: row.category || 'General',
        tags: parseArray(row.tags),
        status: row.status || 'published',
        publishedAt: row.publishedAt ? new Date(row.publishedAt) : new Date(),
      });
      report.imported++;
    } catch (err) {
      recordError(report, i, err.message, row);
    }
  }
  return report;
}

async function importForeignStudies(rows) {
  const report = createImportReport();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const country = row.country?.trim();
      if (!country) throw new Error('country is required');

      const program = row.program?.trim() || '';
      if (await ForeignStudy.findOne({ country, program })) {
        report.skipped++;
        continue;
      }

      const baseSlug = foreignStudySlug(country, program);
      const slug = await ensureSlugUnique(ForeignStudy, baseSlug);

      await ForeignStudy.create({
        country,
        program,
        slug,
        level: row.level || 'Other',
        institution: row.institution || '',
        description: stripAllHtml(row.description),
        requirements: parseArray(row.requirements),
        deadline: row.deadline ? new Date(row.deadline) : undefined,
        link: row.link || '',
        status: row.status || 'active',
      });
      report.imported++;
    } catch (err) {
      recordError(report, i, err.message, row);
    }
  }
  return report;
}

async function importMcqs(rows) {
  const report = createImportReport();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const question = row.question?.trim();
      if (!question) throw new Error('question is required');

      const examCode = row.examCode?.trim() || row.exam?.trim();
      let examId = row.examId;
      if (!examId && examCode) {
        const exam = await Exam.findOne({ $or: [{ code: examCode }, { slug: examCode.toLowerCase() }] });
        if (!exam) throw new Error(`Exam not found: ${examCode}`);
        examId = exam._id;
      }
      if (!examId) throw new Error('examId or examCode is required');

      if (await Mcq.findOne({ examId, question })) {
        report.skipped++;
        continue;
      }

      const options = parseArray(row.options);
      if (options.length < 2) throw new Error('options must have at least 2 items');

      await Mcq.create({
        examId,
        quizId: row.quizId || undefined,
        question,
        options,
        correctIndex: Number(row.correctIndex ?? 0),
        subject: row.subject || '',
        status: row.status || 'active',
      });
      report.imported++;
    } catch (err) {
      recordError(report, i, err.message, row);
    }
  }
  return report;
}

function parseArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
    } catch { /* fall through */ }
    return val.split(/[;|]/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}
