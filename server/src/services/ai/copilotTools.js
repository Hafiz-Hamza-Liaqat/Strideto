/**
 * COPILOT-P1 — Platform tool implementations.
 *
 * Tools call existing models/services — never direct arbitrary queries from model JSON.
 * Public projections only; user-specific tools enforce requester ownership.
 */
import mongoose from 'mongoose';
import { Job } from '../../models/Job.js';
import { Internship } from '../../models/Internship.js';
import { User } from '../../models/User.js';
import { Application } from '../../models/Application.js';
import { InternshipApplication } from '../../models/InternshipApplication.js';
import { OpportunityApplication } from '../../models/career/OpportunityApplication.js';
import { buildPublicJobFilter } from '../../controllers/jobsController.js';
import {
  projectPublicJobListItem,
  projectPublicInternship,
  projectPublicCmsScholarship,
} from '../../../../shared/publicDiscovery/projectPublicDiscovery.js';
import {
  isPubliclyListableJob,
  deriveJobAvailability,
  deriveJobWorkMode,
  JOB_AVAILABILITY,
} from '../../../../shared/publicDiscovery/publicTruth.js';
import { resolveSeoEntityPath, SEO_ENTITY_TYPES } from '../../../../shared/seo/freshnessPolicy.js';
import { COPILOT_P1_TOOLS, COPILOT_P1_BOUNDS } from '../../../../shared/ai/copilotP1.js';
import { buildUserCopilotContext } from './copilotUserContextBuilder.js';
import {
  scoreJobMatch,
  scoreInternshipMatch,
  deriveScholarshipEligibility,
  compareOpportunities,
} from './copilotMatchScoring.js';
import {
  retrievePrograms,
  retrieveScholarships,
  retrieveInstitutions,
} from './copilotRetrieval.js';
import { Scholarship } from '../../models/Scholarship.js';
import { IntlScholarship } from '../../models/IntlScholarship.js';
import { createDefaultToolRegistry } from './copilotToolRegistry.js';
import { SCHOLARSHIP_SYSTEM } from '../../../../shared/ai/copilotP1.js';
import { withFixtureExclusion } from '../../../../shared/publicDiscovery/fixtureExclusion.js';
import { fetchEmployerLogoMap, collectEmployerIdsForLogoFallback } from '../../utils/employerLogoProjection.js';

function safeSearchRe(value) {
  const s = String(value || '').trim().slice(0, 200);
  if (!s) return null;
  return new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}

function buildCanonicalLink(entityType, doc) {
  const path = resolveSeoEntityPath(entityType, doc);
  return path ? { path, label: 'View on Strideto' } : null;
}

function normalizeToolResult(items, total, page, pageSize, filtersApplied = {}, limitations = []) {
  return {
    items,
    total,
    page,
    pageSize,
    filtersApplied,
    limitations,
  };
}

async function searchJobsTool(args, ctx) {
  const filter = buildPublicJobFilter();
  const extraAnd = [];
  if (args.search) {
    const re = safeSearchRe(args.search);
    if (re) extraAnd.push({ $or: [{ title: re }, { company: re }, { description: re }, { skillsRequired: re }] });
  }
  if (args.country) filter.countryCode = String(args.country).toUpperCase().slice(0, 2);
  if (args.workMode === 'remote') extraAnd.push({ remote: true });
  else if (args.workMode === 'hybrid') extraAnd.push({ hybrid: true });
  if (extraAnd.length) filter.$and = [...(filter.$and || []), ...extraAnd];

  const skip = (args.page - 1) * args.pageSize;
  const [rows, total] = await Promise.all([
    Job.find(filter).sort({ createdAt: -1 }).skip(skip).limit(args.pageSize).lean(),
    Job.countDocuments(filter),
  ]);

  const now = new Date();
  const eligible = rows.filter((j) => {
    const avail = deriveJobAvailability(j, now);
    return isPubliclyListableJob(j, now) && avail !== JOB_AVAILABILITY.EXPIRED && avail !== JOB_AVAILABILITY.UNAVAILABLE;
  });

  const logoMap = await fetchEmployerLogoMap(collectEmployerIdsForLogoFallback(eligible));
  const items = eligible.map((job) => {
    const projected = projectPublicJobListItem(job, logoMap.get(String(job.employerId)));
    const match = scoreJobMatch({ ...job, workMode: deriveJobWorkMode(job) }, ctx.userContext);
    const link = buildCanonicalLink(SEO_ENTITY_TYPES.JOB, job);
    return {
      ...projected,
      salaryRange: job.salaryRange || null,
      skillsRequired: job.skillsRequired || [],
      experience: job.experience || null,
      workMode: deriveJobWorkMode(job),
      matchLabel: match.matchLabel,
      matchReasons: match.reasons,
      matchGaps: match.gaps,
      canonicalLink: link,
      _sortScore: match.sortScore,
    };
  }).sort((a, b) => (b._sortScore ?? 0) - (a._sortScore ?? 0));

  return {
    data: normalizeToolResult(
      items.slice(0, COPILOT_P1_BOUNDS.MAX_RESULTS_HARD).map(({ _sortScore, ...rest }) => rest),
      total,
      args.page,
      args.pageSize,
      { search: args.search, country: args.country, workMode: args.workMode },
      eligible.length < rows.length ? ['Some expired or unpublished jobs were excluded'] : []
    ),
  };
}

async function getJobDetailTool(args) {
  const job = await Job.findOne({ _id: args.id, ...buildPublicJobFilter() }).lean();
  if (!job || !isPubliclyListableJob(job)) {
    return { data: null, error: 'not_found' };
  }
  const projected = projectPublicJobListItem(job);
  return {
    data: {
      ...projected,
      skillsRequired: job.skillsRequired || [],
      experience: job.experience || null,
      description: (job.description || '').slice(0, 500),
      salaryRange: job.salaryRange || null,
      workMode: deriveJobWorkMode(job),
      canonicalLink: buildCanonicalLink(SEO_ENTITY_TYPES.JOB, job),
    },
  };
}

async function searchInternshipsTool(args, ctx) {
  const filter = withFixtureExclusion({ status: 'active' });
  const extraAnd = [];
  if (args.search) {
    const re = safeSearchRe(args.search);
    if (re) extraAnd.push({ $or: [{ title: re }, { organization: re }, { description: re }] });
  }
  if (args.country) filter.countryCode = String(args.country).toUpperCase().slice(0, 2);
  if (args.workMode && ['remote', 'hybrid', 'on_site'].includes(args.workMode)) filter.workMode = args.workMode;
  if (extraAnd.length) filter.$and = [...(filter.$and || []), ...extraAnd];

  const skip = (args.page - 1) * args.pageSize;
  const [rows, total] = await Promise.all([
    Internship.find(filter).sort({ createdAt: -1 }).skip(skip).limit(args.pageSize).lean(),
    Internship.countDocuments(filter),
  ]);

  const now = new Date();
  const items = rows
    .filter((i) => {
      if (i.deadline) {
        const d = new Date(i.deadline);
        if (!Number.isNaN(d.getTime()) && d < now) return false;
      }
      return true;
    })
    .map((doc) => {
      const projected = projectPublicInternship(doc);
      const match = scoreInternshipMatch(doc, ctx.userContext);
      return {
        ...projected,
        matchLabel: match.matchLabel,
        matchReasons: match.reasons,
        matchGaps: match.gaps,
        canonicalLink: buildCanonicalLink(SEO_ENTITY_TYPES.INTERNSHIP, doc),
        _sortScore: match.sortScore,
      };
    })
    .sort((a, b) => (b._sortScore ?? 0) - (a._sortScore ?? 0))
    .map(({ _sortScore, ...rest }) => rest);

  return { data: normalizeToolResult(items, total, args.page, args.pageSize) };
}

async function getInternshipDetailTool(args) {
  const doc = await Internship.findOne({ _id: args.id, status: 'active' }).lean();
  if (!doc) return { data: null, error: 'not_found' };
  return {
    data: {
      ...projectPublicInternship(doc),
      canonicalLink: buildCanonicalLink(SEO_ENTITY_TYPES.INTERNSHIP, doc),
    },
  };
}

function projectIntlScholarshipForCopilot(doc) {
  if (!doc) return null;
  return {
    _id: doc._id,
    entityId: String(doc._id),
    name: doc.title,
    title: doc.title,
    provider: doc.provider || doc.university || null,
    country: doc.country ?? null,
    fundingType: doc.fundingType ?? null,
    deadline: doc.deadline || doc.applicationDeadline || null,
    slug: doc.slug ?? null,
    degreeLevel: doc.degreeLevel ?? null,
    amount: doc.amount ?? null,
    scholarshipSystem: SCHOLARSHIP_SYSTEM.INTL,
  };
}

function isIntlScholarshipPublished(doc, now = new Date()) {
  if (!doc || doc.status !== 'active') return false;
  const closeAt = doc.deadline || doc.applicationDeadline;
  if (closeAt) {
    const d = new Date(closeAt);
    if (!Number.isNaN(d.getTime()) && d < now) return false;
  }
  return true;
}

async function resolveScholarshipBySystem(id, system) {
  if (system === SCHOLARSHIP_SYSTEM.CANONICAL) {
    const rows = await retrieveScholarships({ scholarshipIds: [id] });
    if (!rows.length) return null;
    return {
      ...rows[0],
      scholarshipSystem: SCHOLARSHIP_SYSTEM.CANONICAL,
      canonicalLink: rows[0].slug
        ? { path: `/scholarship-intelligence/${rows[0].slug}`, label: 'View scholarship' }
        : null,
    };
  }
  if (system === SCHOLARSHIP_SYSTEM.CMS) {
    const cms = await Scholarship.findOne({ _id: id, status: 'active' }).lean();
    if (!cms) return null;
    const projected = projectPublicCmsScholarship(cms);
    return {
      ...projected,
      entityId: String(cms._id),
      name: projected?.title || projected?.name,
      scholarshipSystem: SCHOLARSHIP_SYSTEM.CMS,
      canonicalLink: buildCanonicalLink(SEO_ENTITY_TYPES.SCHOLARSHIP, cms),
    };
  }
  if (system === SCHOLARSHIP_SYSTEM.INTL) {
    const intl = await IntlScholarship.findOne({ _id: id, status: 'active' }).lean();
    if (!intl || !isIntlScholarshipPublished(intl)) return null;
    const projected = projectIntlScholarshipForCopilot(intl);
    return {
      ...projected,
      canonicalLink: buildCanonicalLink(SEO_ENTITY_TYPES.INTL_SCHOLARSHIP, intl),
    };
  }
  return null;
}

async function searchScholarshipsTool(args, ctx) {
  const now = new Date();
  const canonical = await retrieveScholarships({
    search: args.search,
    country: args.country,
  });
  const cmsFilter = { status: 'active' };
  if (args.search) {
    const re = safeSearchRe(args.search);
    if (re) cmsFilter.$or = [{ title: re }, { provider: re }, { description: re }];
  }
  const cmsRows = await Scholarship.find(cmsFilter).limit(args.pageSize).lean();
  const cmsItems = cmsRows.map((s) => {
    const projected = projectPublicCmsScholarship(s);
    return {
      ...projected,
      entityId: String(s._id),
      name: projected?.title || projected?.name,
      scholarshipSystem: SCHOLARSHIP_SYSTEM.CMS,
      eligibilityHint: deriveScholarshipEligibility(projected, ctx.userContext),
      canonicalLink: buildCanonicalLink(SEO_ENTITY_TYPES.SCHOLARSHIP, s),
    };
  });

  const intlFilter = { status: 'active' };
  if (args.search) {
    const re = safeSearchRe(args.search);
    if (re) intlFilter.$or = [{ title: re }, { country: re }, { university: re }, { description: re }];
  }
  if (args.country) {
    const re = safeSearchRe(args.country);
    if (re) intlFilter.country = re;
  }
  const intlRows = await IntlScholarship.find(intlFilter).sort({ deadline: 1 }).limit(args.pageSize).lean();
  const intlItems = intlRows
    .filter((d) => isIntlScholarshipPublished(d, now))
    .map((s) => ({
      ...projectIntlScholarshipForCopilot(s),
      eligibilityHint: deriveScholarshipEligibility(s, ctx.userContext),
      canonicalLink: buildCanonicalLink(SEO_ENTITY_TYPES.INTL_SCHOLARSHIP, s),
    }));

  const canonicalItems = canonical.map((s) => ({
    entityId: s.entityId,
    name: s.name,
    provider: s.provider,
    country: s.country,
    fundingType: s.fundingType,
    coverageDetails: s.coverageDetails,
    slug: s.slug,
    scholarshipSystem: SCHOLARSHIP_SYSTEM.CANONICAL,
    eligibilityHint: deriveScholarshipEligibility(s, ctx.userContext),
    activeDeadlines: s.activeDeadlines,
    canonicalLink: s.slug ? { path: `/scholarship-intelligence/${s.slug}`, label: 'View scholarship' } : null,
  }));

  const merged = [...canonicalItems, ...cmsItems, ...intlItems];
  const items = merged.slice(0, args.pageSize);
  return {
    data: normalizeToolResult(items, merged.length, args.page, args.pageSize, { search: args.search }),
  };
}

async function searchProgramsTool(args, _ctx) {
  const programs = await retrievePrograms({
    search: args.search,
    country: args.country,
    field: args.field,
    degreeLevel: args.degreeLevel,
  });
  const items = programs.map((p) => ({
    ...p,
    institutionName: p.institutionId,
    tuitionFee: p.tuitionFee ?? null,
    durationMonths: p.durationMonths ?? null,
    canonicalLink: p.slug ? { path: `/program-explorer/${p.slug}`, label: 'View program' } : null,
  }));
  return { data: normalizeToolResult(items, items.length, args.page, args.pageSize) };
}

async function searchInstitutionsTool(args) {
  const institutions = await retrieveInstitutions({
    institutionIds: args.ids ?? [],
    search: args.search,
  });
  const items = institutions.map((i) => ({
    ...i,
    canonicalLink: i.slug ? { path: `/institutions/${i.slug}`, label: 'View institution' } : null,
  }));
  return { data: normalizeToolResult(items, items.length, args.page, args.pageSize) };
}

async function getSavedItemsTool(_args, ctx) {
  const user = await User.findById(ctx.userId)
    .populate('savedJobs')
    .populate('savedScholarships')
    .populate('savedInternships')
    .populate('savedIntlScholarships')
    .lean();
  if (!user) return { data: normalizeToolResult([], 0, 1, 10) };

  const jobs = (user.savedJobs || []).filter(Boolean).filter((j) => j.status === 'active').map((j) => ({
    type: 'job',
    id: String(j._id),
    title: j.title,
    company: j.company,
    slug: j.slug,
    canonicalLink: buildCanonicalLink(SEO_ENTITY_TYPES.JOB, j),
  }));
  const scholarships = (user.savedScholarships || []).filter(Boolean).map((s) => ({
    type: 'scholarship',
    id: String(s._id),
    title: s.title || s.name,
    provider: s.provider,
    slug: s.slug,
    scholarshipSystem: SCHOLARSHIP_SYSTEM.CMS,
    canonicalLink: buildCanonicalLink(SEO_ENTITY_TYPES.SCHOLARSHIP, s),
  }));
  const intlScholarships = (user.savedIntlScholarships || []).filter(Boolean).filter((s) => s.status === 'active').map((s) => ({
    type: 'scholarship',
    id: String(s._id),
    title: s.title,
    provider: s.provider || s.university,
    slug: s.slug,
    scholarshipSystem: SCHOLARSHIP_SYSTEM.INTL,
    canonicalLink: buildCanonicalLink(SEO_ENTITY_TYPES.INTL_SCHOLARSHIP, s),
  }));
  const internships = (user.savedInternships || []).filter(Boolean).map((i) => ({
    type: 'internship',
    id: String(i._id),
    title: i.title,
    organization: i.organization,
    slug: i.slug,
    canonicalLink: buildCanonicalLink(SEO_ENTITY_TYPES.INTERNSHIP, i),
  }));

  const items = [...jobs, ...scholarships, ...intlScholarships, ...internships];
  return { data: normalizeToolResult(items, items.length, 1, items.length) };
}

async function getApplicationSummaryTool(_args, ctx) {
  const userId = ctx.userId;
  const oid = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : null;
  if (!oid) return { data: normalizeToolResult([], 0, 1, 10) };

  const [legacyJobs, internshipApps, trackerApps] = await Promise.all([
    Application.find({ userId: oid }).select('jobId status appliedDate note').populate('jobId', 'title slug company').lean(),
    InternshipApplication.find({ userId: oid }).select('internshipId status appliedAt').populate('internshipId', 'title slug organization').lean(),
    OpportunityApplication.find({ userId: oid, status: 'active' }).select('title pipelineStage opportunityRef appliedAt companyName').limit(20).lean(),
  ]);

  const items = [];
  for (const a of legacyJobs) {
    if (!a.jobId) continue;
    items.push({
      type: 'job',
      title: a.jobId.title,
      company: a.jobId.company,
      status: a.status,
      appliedAt: a.appliedDate,
      canonicalLink: buildCanonicalLink(SEO_ENTITY_TYPES.JOB, a.jobId),
    });
  }
  for (const a of internshipApps) {
    if (!a.internshipId) continue;
    items.push({
      type: 'internship',
      title: a.internshipId.title,
      organization: a.internshipId.organization,
      status: a.status,
      appliedAt: a.appliedAt,
      canonicalLink: buildCanonicalLink(SEO_ENTITY_TYPES.INTERNSHIP, a.internshipId),
    });
  }
  for (const a of trackerApps) {
    items.push({
      type: a.opportunityRef?.opportunityType || 'opportunity',
      title: a.title,
      company: a.companyName,
      status: a.pipelineStage,
      appliedAt: a.appliedAt,
    });
  }

  return { data: normalizeToolResult(items, items.length, 1, items.length) };
}

async function getUserContextTool(_args, ctx) {
  const data = ctx.userContext ?? await buildUserCopilotContext(ctx.userId);
  return { data };
}

async function compareOpportunitiesTool(args, _ctx) {
  let entities = [];
  if (args.type === 'job') {
    const jobs = await Job.find({ _id: { $in: args.ids }, ...buildPublicJobFilter() }).lean();
    entities = jobs.map((j) => ({
      ...projectPublicJobListItem(j),
      workMode: deriveJobWorkMode(j),
      experience: j.experience,
      salaryRange: j.salaryRange || null,
    }));
  } else if (args.type === 'internship') {
    const docs = await Internship.find({ _id: { $in: args.ids }, status: 'active' }).lean();
    entities = docs.map(projectPublicInternship);
  } else if (args.type === 'scholarship') {
    const refs = args.scholarshipRefs ?? [];
    const resolved = [];
    for (const ref of refs) {
      const row = await resolveScholarshipBySystem(ref.id, ref.system);
      if (row) resolved.push(row);
    }
    entities = resolved;
  } else if (args.type === 'program') {
    entities = await retrievePrograms({ programIds: args.ids });
  }

  if (entities.length < 2) {
    return { data: null, error: 'insufficient_entities' };
  }

  return {
    data: {
      type: args.type,
      comparison: compareOpportunities(entities, args.type),
      entities: entities.map((e) => ({
        id: e._id || e.entityId,
        canonicalLink: e.slug ? resolveSeoEntityPath(
          args.type === 'job' ? SEO_ENTITY_TYPES.JOB
            : args.type === 'internship' ? SEO_ENTITY_TYPES.INTERNSHIP
              : args.type === 'program' ? SEO_ENTITY_TYPES.PROGRAM
                : SEO_ENTITY_TYPES.CANONICAL_SCHOLARSHIP,
          e
        ) : null,
      })),
    },
  };
}

export function createCopilotP1ToolHandlers() {
  return {
    [COPILOT_P1_TOOLS.GET_USER_CONTEXT]: getUserContextTool,
    [COPILOT_P1_TOOLS.SEARCH_JOBS]: searchJobsTool,
    [COPILOT_P1_TOOLS.GET_JOB_DETAIL]: getJobDetailTool,
    [COPILOT_P1_TOOLS.SEARCH_INTERNSHIPS]: searchInternshipsTool,
    [COPILOT_P1_TOOLS.GET_INTERNSHIP_DETAIL]: getInternshipDetailTool,
    [COPILOT_P1_TOOLS.SEARCH_SCHOLARSHIPS]: searchScholarshipsTool,
    [COPILOT_P1_TOOLS.GET_SCHOLARSHIP_DETAIL]: async (args) => {
      const data = await resolveScholarshipBySystem(args.id, args.system);
      return data ? { data } : { data: null, error: 'not_found' };
    },
    [COPILOT_P1_TOOLS.SEARCH_INSTITUTIONS]: searchInstitutionsTool,
    [COPILOT_P1_TOOLS.GET_INSTITUTION_DETAIL]: async (args) => {
      const insts = await retrieveInstitutions({ institutionIds: [args.id] });
      return insts.length ? { data: insts[0] } : { data: null, error: 'not_found' };
    },
    [COPILOT_P1_TOOLS.SEARCH_PROGRAMS]: searchProgramsTool,
    [COPILOT_P1_TOOLS.GET_PROGRAM_DETAIL]: async (args) => {
      const progs = await retrievePrograms({ programIds: [args.id] });
      return progs.length ? { data: progs[0] } : { data: null, error: 'not_found' };
    },
    [COPILOT_P1_TOOLS.GET_SAVED_ITEMS]: getSavedItemsTool,
    [COPILOT_P1_TOOLS.GET_APPLICATION_SUMMARY]: getApplicationSummaryTool,
    [COPILOT_P1_TOOLS.COMPARE_OPPORTUNITIES]: compareOpportunitiesTool,
  };
}

export function createCopilotP1ToolRegistry() {
  return createDefaultToolRegistry(createCopilotP1ToolHandlers());
}
