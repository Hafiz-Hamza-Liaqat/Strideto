/**
 * Insert-only beta seed runner (testable).
 */
import { buildDemoOpportunities } from './demoOpportunities.js';
import { buildEditorialContent } from './editorial.js';
import { buildReferenceContent } from './referenceContent.js';
import { verifiedPublicOpportunities } from './verifiedPublic.opportunities.js';
import {
  validatePublicOpportunity,
  validateDemoRecord,
} from './validatePublicOpportunity.js';
import { BETA_EXTERNAL_ID_PREFIX } from './constants.js';

export const DESTRUCTIVE_PATTERNS = ['deleteMany', 'dropDatabase', 'drop()'];

/**
 * @param {object} Model - mongoose model with findOne, create
 * @param {object} filter
 * @param {object} doc
 * @param {boolean} dryRun
 */
export async function insertIfMissing(Model, filter, doc, dryRun) {
  const existing = await Model.findOne(filter);
  if (existing) {
    return { action: 'skipped', reason: 'exists' };
  }
  if (dryRun) {
    return { action: 'would_insert' };
  }
  await Model.create(doc);
  return { action: 'inserted' };
}

function tally(result, stats, key) {
  if (!stats[key]) stats[key] = { inserted: 0, skipped: 0, rejected: 0 };
  if (result.action === 'inserted' || result.action === 'would_insert') {
    stats[key].inserted += 1;
  } else {
    stats[key].skipped += 1;
  }
}

/**
 * @param {object} deps - mongoose models
 * @param {{ dryRun?: boolean, now?: Date }} options
 */
export async function runBetaSeed(deps, options = {}) {
  const dryRun = Boolean(options.dryRun);
  const now = options.now || new Date();
  const stats = {};

  const bump = (name) => {
    if (!stats[name]) stats[name] = { inserted: 0, skipped: 0, rejected: 0 };
    return stats[name];
  };

  const demo = buildDemoOpportunities();
  const editorial = buildEditorialContent();
  const reference = buildReferenceContent();

  for (const job of demo.jobs) {
    const v = validateDemoRecord(job);
    if (!v.ok) {
      bump('jobs').rejected += 1;
      continue;
    }
    const r = await insertIfMissing(deps.Job, { externalId: job.externalId }, job, dryRun);
    tally(r, stats, 'jobs');
  }

  for (const s of demo.scholarships) {
    const v = validateDemoRecord(s);
    if (!v.ok) {
      bump('scholarships').rejected += 1;
      continue;
    }
    const r = await insertIfMissing(deps.Scholarship, { slug: s.slug }, s, dryRun);
    tally(r, stats, 'scholarships');
  }

  for (const a of demo.admissions) {
    const v = validateDemoRecord(a);
    if (!v.ok) {
      bump('admissions').rejected += 1;
      continue;
    }
    const r = await insertIfMissing(deps.Admission, { slug: a.slug }, a, dryRun);
    tally(r, stats, 'admissions');
  }

  for (const i of demo.internships) {
    const v = validateDemoRecord(i);
    if (!v.ok) {
      bump('internships').rejected += 1;
      continue;
    }
    const r = await insertIfMissing(deps.Internship, { slug: i.slug }, i, dryRun);
    tally(r, stats, 'internships');
  }

  for (const i of demo.intlScholarships) {
    const v = validateDemoRecord(i);
    if (!v.ok) {
      bump('intlScholarships').rejected += 1;
      continue;
    }
    const r = await insertIfMissing(deps.IntlScholarship, { slug: i.slug }, i, dryRun);
    tally(r, stats, 'intlScholarships');
  }

  const publicBuckets = [
    { bucket: 'jobs', kind: 'job', Model: deps.Job, filter: (r) => ({ externalId: r.externalId }) },
    { bucket: 'scholarships', kind: 'scholarship', Model: deps.Scholarship, filter: (r) => ({ slug: r.slug }) },
    { bucket: 'admissions', kind: 'admission', Model: deps.Admission, filter: (r) => ({ slug: r.slug }) },
    { bucket: 'internships', kind: 'internship', Model: deps.Internship, filter: (r) => ({ slug: r.slug }) },
    { bucket: 'intlScholarships', kind: 'intlScholarship', Model: deps.IntlScholarship, filter: (r) => ({ slug: r.slug }) },
  ];

  for (const { bucket, kind, Model, filter } of publicBuckets) {
    const list = verifiedPublicOpportunities[bucket] || [];
    for (const record of list) {
      const withId = {
        ...record,
        externalId:
          record.externalId ||
          (kind === 'job'
            ? `${BETA_EXTERNAL_ID_PREFIX}public-${kind}-${record.slug || record.title}`
            : undefined),
        slug:
          record.slug ||
          (kind !== 'job' ? `${BETA_EXTERNAL_ID_PREFIX}public-${kind}-${record.title}` : record.slug),
      };
      const validation = validatePublicOpportunity(withId, kind, now);
      if (!validation.ok) {
        bump(bucket).rejected += 1;
        continue;
      }
      const filterDoc = filter(withId);
      const r = await insertIfMissing(Model, filterDoc, withId, dryRun);
      tally(r, stats, bucket);
    }
  }

  for (const b of editorial.blogs) {
    const r = await insertIfMissing(deps.Blog, { slug: b.slug }, b, dryRun);
    tally(r, stats, 'blogs');
  }

  for (const c of editorial.careerArticles) {
    const r = await insertIfMissing(deps.CareerArticle, { slug: c.slug }, c, dryRun);
    tally(r, stats, 'careerArticles');
  }

  for (const inst of reference.institutions) {
    const r = await insertIfMissing(deps.Institution, { slug: inst.slug }, inst, dryRun);
    tally(r, stats, 'institutions');
  }

  for (const u of reference.universities) {
    const r = await insertIfMissing(deps.University, { slug: u.slug }, u, dryRun);
    tally(r, stats, 'universities');
  }

  for (const fs of reference.foreignStudies) {
    const r = await insertIfMissing(deps.ForeignStudy, { slug: fs.slug }, fs, dryRun);
    tally(r, stats, 'foreignStudies');
  }

  for (const w of reference.webinars) {
    const r = await insertIfMissing(deps.Webinar, { slug: w.slug }, w, dryRun);
    tally(r, stats, 'webinars');
  }

  for (const co of reference.companies) {
    const r = await insertIfMissing(deps.Company, { slug: co.slug }, co, dryRun);
    tally(r, stats, 'companies');
  }

  return { dryRun, stats };
}

export function assertNoDestructiveOps(source) {
  const text = typeof source === 'string' ? source : String(source);
  for (const p of DESTRUCTIVE_PATTERNS) {
    if (text.includes(p)) {
      throw new Error(`Destructive operation not allowed: ${p}`);
    }
  }
}
