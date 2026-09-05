import XLSX from 'xlsx';
import { User } from '../../models/User.js';
import { Employer } from '../../models/Employer.js';
import { Job } from '../../models/Job.js';
import { Application } from '../../models/Application.js';
import { Scholarship } from '../../models/Scholarship.js';
import { Admission } from '../../models/Admission.js';
import { Blog } from '../../models/Blog.js';
import { Company } from '../../models/Company.js';
import { CareerArticle } from '../../models/CareerArticle.js';
import { Internship } from '../../models/Internship.js';
import { IntlScholarship } from '../../models/IntlScholarship.js';
import { University } from '../../models/University.js';
import { ContactMessage } from '../../models/ContactMessage.js';
import { Institution } from '../../models/Institution.js';
import { NewsletterSubscriber } from '../../models/NewsletterSubscriber.js';
import { ForeignStudy } from '../../models/ForeignStudy.js';
import { Payment } from '../../models/Payment.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { logAudit, auditFromRequest } from '../../services/auditService.js';
import { collectExecutiveMetrics } from './executiveDashboardController.js';
import { getPlatformInsightsDashboard } from '../../services/analytics/AnalyticsAggregator.js';
import { flattenDashboardForExport } from '../../../../shared/analytics/exportHelpers.js';
import { employerPrivateDraftExclusion } from '../../services/publishing/employerJobSubmissionState.js';

const EXPORTERS = {
  users: async () => User.find().select('-password -fcmToken').lean(),
  employers: async () => Employer.find().select('-password').lean(),
  jobs: async () => Job.find(employerPrivateDraftExclusion()).lean(),
  scholarships: async () => Scholarship.find().lean(),
  admissions: async () => Admission.find().lean(),
  blogs: async () => Blog.find().lean(),
  companies: async () => Company.find().lean(),
  'career-articles': async () => CareerArticle.find().lean(),
  internships: async () => Internship.find().lean(),
  'intl-scholarships': async () => IntlScholarship.find().lean(),
  universities: async () => University.find().lean(),
  'foreign-studies': async () => ForeignStudy.find().lean(),
  'contact-messages': async () => ContactMessage.find().lean(),
  institutions: async () => Institution.find().lean(),
  'newsletter-subscribers': async () => NewsletterSubscriber.find().lean(),
  applications: async () =>
    Application.find()
      .populate('job', 'title')
      .populate('user', 'email name')
      .lean(),
  payments: async () => Payment.find().lean(),
  analytics: async () => {
    const metrics = await collectExecutiveMetrics();
    return [
      {
        ...metrics.cards,
        generatedAt: metrics.generatedAt,
        dataSource: metrics.dataSource,
      },
    ];
  },
  'content-insights': async () => {
    const dashboard = await getPlatformInsightsDashboard({ range: '30d' });
    return flattenDashboardForExport({
      cards: dashboard.overview?.cards,
      topPages: dashboard.content?.topPages,
      topSearches: dashboard.search?.topSearches,
      topAds: dashboard.ads?.topAds,
    });
  },
};

/**
 * Spreadsheet formula-injection neutralization boundary (STRIDETO-SEC-2).
 *
 * Applied to every row before both CSV serialization and XLSX worksheet
 * construction (and, since it shares toCsv(), the CSV-embedded PDF/HTML
 * export path too). CSV quoting alone is not treated as the security
 * control — quoted cells can still be interpreted as formulas by spreadsheet
 * software, so dangerous values are rewritten as literal text instead.
 */
const DANGEROUS_LEADING_CHARS = new Set(['=', '+', '-', '@', '\t', '\r', '\n']);
const PURE_SIGNED_NUMERIC_STRING = /^[+-]?(\d+\.?\d*|\.\d+)$/;
const DANGEROUS_OBJECT_KEYS = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);
const MAX_NEUTRALIZE_DEPTH = 8;

function isPlainNeutralizableObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Neutralizes a single string against spreadsheet-formula interpretation.
 * Deterministic and idempotent: a string that already starts with a literal
 * apostrophe is treated as already forced to text and returned unchanged, so
 * running this twice never double-prefixes.
 */
function neutralizeSpreadsheetString(value) {
  if (value.length === 0 || value.startsWith("'")) return value;

  let i = 0;
  while (i < value.length && value[i] === ' ') i += 1;
  const effective = value.slice(i);
  if (!effective.length) return value;

  const lead = effective[0];
  if (!DANGEROUS_LEADING_CHARS.has(lead)) return value;

  if (
    (lead === '+' || lead === '-') &&
    PURE_SIGNED_NUMERIC_STRING.test(effective)
  ) {
    return value; // legitimate signed numeric string (e.g. "-5"), not a formula
  }

  return `'${value}`;
}

/**
 * Recursively neutralizes a value for safe spreadsheet export. Numbers,
 * booleans, null, undefined, and Date instances pass through unchanged.
 * Plain arrays/objects are walked (own-enumerable keys only, dangerous key
 * names skipped) without ever invoking a getter or method on the source
 * value — class instances other than Date/Array/plain-object are returned
 * as-is rather than traversed. Never mutates its input.
 */
function neutralizeSpreadsheetValue(value, depth = 0) {
  if (typeof value === 'string') return neutralizeSpreadsheetString(value);
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value; // number, boolean
  if (value instanceof Date) return value;
  if (depth >= MAX_NEUTRALIZE_DEPTH) return value;

  if (Array.isArray(value)) {
    return value.map((item) => neutralizeSpreadsheetValue(item, depth + 1));
  }

  if (isPlainNeutralizableObject(value)) {
    const safe = {};
    for (const key of Object.keys(value)) {
      if (DANGEROUS_OBJECT_KEYS.has(key)) continue;
      safe[key] = neutralizeSpreadsheetValue(value[key], depth + 1);
    }
    return safe;
  }

  return value; // e.g. ObjectId or other class instance — left untouched, not traversed
}

/**
 * Neutralizes every row of an export result set. Returns a new array of new
 * row objects; never mutates the input rows.
 */
export function neutralizeExportRows(rows) {
  return rows.map((row) => neutralizeSpreadsheetValue(row, 0));
}

export function toCsv(rows) {
  if (!rows.length) return '';
  const keys = Object.keys(rows[0]);
  const header = keys.join(',');
  const lines = rows.map((row) =>
    keys
      .map((k) => {
        const v = row[k];
        const s =
          v == null
            ? ''
            : typeof v === 'object'
              ? JSON.stringify(v)
              : String(v);
        return `"${s.replace(/"/g, '""')}"`;
      })
      .join(',')
  );
  return [header, ...lines].join('\n');
}

export const exportData = asyncHandler(async (req, res) => {
  const { resource } = req.params;
  const format = (req.query.format || 'csv').toLowerCase();
  const exporter = EXPORTERS[resource];
  if (!exporter)
    return res
      .status(400)
      .json({ error: `Unknown export resource: ${resource}` });

  const rows = await exporter();
  const flatRows = rows.map((r) => {
    const o = { ...r };
    if (o._id) o._id = String(o._id);
    return o;
  });
  // Every user-controlled value is neutralized against spreadsheet-formula
  // injection before it reaches either serialization path below.
  const safeRows = neutralizeExportRows(flatRows);

  await logAudit({
    ...auditFromRequest(req),
    action: 'export.data',
    targetType: resource,
    metadata: { format, count: safeRows.length },
  });

  if (format === 'xlsx' || format === 'excel') {
    const ws = XLSX.utils.json_to_sheet(safeRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, resource);
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${resource}-export.xlsx"`
    );
    return res.send(buf);
  }

  if (format === 'pdf') {
    const html = `<html><head><title>${resource} export</title></head><body><h1>${resource}</h1><pre>${toCsv(safeRows).replace(/</g, '&lt;')}</pre></body></html>`;
    res.setHeader('Content-Type', 'text/html');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${resource}-export.html"`
    );
    return res.send(html);
  }

  const csv = toCsv(safeRows);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${resource}-export.csv"`
  );
  res.send(csv);
});
