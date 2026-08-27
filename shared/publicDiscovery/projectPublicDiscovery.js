/**
 * Server-derived public projections for discovery surfaces (Phase 7).
 * Privacy boundary is this allowlist — never client field filtering.
 */
import { publicHttpUrlOrNull } from './safePublicUrl.js';
import {
  AUTHORITY_KINDS,
  applicationsTrackedForPublic,
  deriveJobAuthority,
  deriveJobAvailability,
  deriveJobWorkMode,
  formatPublicDateOnly,
  formatPublicOpenings,
  authorityLabel,
} from './publicTruth.js';

const JOB_PUBLIC_KEYS = [
  '_id',
  'title',
  'slug',
  'company',
  'organization',
  'location',
  'province',
  'city',
  'countryCode',
  'region',
  'category',
  'jobFamily',
  'specialization',
  'type',
  'jobType',
  'educationRequirement',
  'experience',
  'applyType',
  'description',
  'requirements',
  'responsibilities',
  'applicationInstructions',
  'deadline',
  'logoUrl',
  'skillsRequired',
  'salaryRange',
  'salaryCurrency',
  'createdAt',
  'publishedAt',
  'updatedAt',
  'source',
  'sourceWebsite',
  'remote',
  'hybrid',
  'openingsCount',
  'locale',
  // SEO-P0B — read by the job detail page to decide whether JobPosting markup
  // may be emitted. Server-derived only; the client never infers it.
  'jobsGraphEligible',
];

function pick(doc, keys) {
  const out = {};
  for (const key of keys) {
    if (doc[key] !== undefined) out[key] = doc[key];
  }
  return out;
}

function stripPrivateEvidence(sources) {
  if (!Array.isArray(sources)) return [];
  return sources.map((s) => ({
    sourceType: s.sourceType || '',
    sourceUrl: publicHttpUrlOrNull(s.sourceUrl),
    publisher: s.publisher || '',
    retrievedAt: s.retrievedAt || null,
    verifiedAt: s.verifiedAt || null,
  }));
}

export function projectPublicJob(job, extras = {}) {
  if (!job) return null;
  const applyType = job.applyType === 'internal' ? 'internal' : 'external';
  const applicationLink = applyType === 'external'
    ? publicHttpUrlOrNull(job.applicationLink || job.sourceUrl)
    : publicHttpUrlOrNull(job.applicationLink);
  const openings = formatPublicOpenings(job.openingsCount);
  const workMode = deriveJobWorkMode(job);
  const authorityKind = deriveJobAuthority(job);
  const availability = deriveJobAvailability(job);
  const related = Array.isArray(extras.related)
    ? extras.related.map((r) => projectPublicJobListItem(r)).filter(Boolean)
    : undefined;

  return {
    ...pick(job, JOB_PUBLIC_KEYS),
    // Absent/legacy documents are unauthorized, never "unknown".
    jobsGraphEligible: job.jobsGraphEligible === true,
    applyType,
    applicationLink,
    applyEmail: applyType === 'external' && job.applyEmail ? String(job.applyEmail) : null,
    sourceUrl: publicHttpUrlOrNull(job.sourceUrl),
    logoUrl: publicHttpUrlOrNull(job.logoUrl),
    openingsCount: openings.specified ? openings.count : null,
    openingsLabel: openings.phrase,
    workMode,
    workModeLabel: workMode === 'unspecified' ? 'Not specified' : workMode,
    applicationsTracked: applicationsTrackedForPublic({ applyType }),
    authorityKind,
    authorityLabel: authorityLabel(authorityKind),
    availability,
    acceptingApplications: availability === 'open',
    employerVerification: extras.employerVerification || null,
    related,
  };
}

export function projectPublicJobListItem(job) {
  if (!job) return null;
  const applyType = job.applyType === 'internal' ? 'internal' : 'external';
  const openings = formatPublicOpenings(job.openingsCount);
  return {
    _id: job._id,
    title: job.title,
    slug: job.slug,
    company: job.company,
    organization: job.organization,
    location: job.location,
    province: job.province || job.region,
    region: job.region || job.province,
    city: job.city,
    countryCode: job.countryCode,
    category: job.category,
    jobFamily: job.jobFamily,
    specialization: job.specialization,
    type: job.type,
    jobType: job.jobType,
    deadline: job.deadline,
    logoUrl: publicHttpUrlOrNull(job.logoUrl),
    source: job.source,
    scrapedAt: job.source === 'scraper' ? job.scrapedAt : undefined,
    applyType,
    createdAt: job.createdAt,
    openingsCount: openings.specified ? openings.count : null,
    workMode: deriveJobWorkMode(job),
    salaryRange: job.salaryRange || null,
    employerVerification: job.employerVerification || null,
  };
}

export function projectPublicInternship(doc) {
  if (!doc) return null;
  const applyInPlatform = doc.applyInPlatform === true;
  const applicationLink = publicHttpUrlOrNull(doc.applicationLink);
  return {
    _id: doc._id,
    title: doc.title,
    slug: doc.slug,
    organization: doc.organization,
    location: doc.location,
    province: doc.province || doc.region || null,
    region: doc.region || doc.province || null,
    city: doc.city,
    countryCode: doc.countryCode || null,
    workMode: doc.workMode || 'unspecified',
    duration: doc.duration || null,
    skillset: Array.isArray(doc.skillset) ? doc.skillset : [],
    description: doc.description || '',
    eligibility: Array.isArray(doc.eligibility) ? doc.eligibility : [],
    internshipType: doc.internshipType || null,
    isPaid: doc.isPaid === true,
    deadline: doc.deadline || null,
    applyInPlatform,
    applicationLink,
    applyType: applyInPlatform ? 'internal' : 'external',
    authorityKind: AUTHORITY_KINDS.UNKNOWN,
    authorityLabel: authorityLabel(AUTHORITY_KINDS.UNKNOWN),
    createdAt: doc.createdAt,
    status: doc.status,
  };
}

export function projectPublicCmsScholarship(doc, extras = {}) {
  if (!doc) return null;
  const related = Array.isArray(extras.related)
    ? extras.related.map((r) => projectPublicCmsScholarship(r)).filter(Boolean)
    : undefined;
  return {
    _id: doc._id,
    title: doc.title,
    slug: doc.slug,
    provider: doc.provider,
    level: doc.level,
    degreeLevel: doc.degreeLevel,
    university: doc.university || null,
    country: doc.country || null,
    province: doc.province || null,
    city: doc.city || null,
    amount: doc.amount || null,
    fundingType: doc.fundingType || null,
    description: doc.description || '',
    eligibility: Array.isArray(doc.eligibility) ? doc.eligibility : [],
    applicationInstructions: doc.applicationInstructions || '',
    deadline: doc.deadline || null,
    link: publicHttpUrlOrNull(doc.link),
    logoUrl: publicHttpUrlOrNull(doc.logoUrl),
    tags: Array.isArray(doc.tags) ? doc.tags : [],
    authorityKind: AUTHORITY_KINDS.SOURCE_BACKED,
    authorityLabel: authorityLabel(AUTHORITY_KINDS.SOURCE_BACKED),
    freshnessState: 'unknown',
    related,
  };
}

export function projectPublicCmsAdmission(doc, extras = {}) {
  if (!doc) return null;
  const related = Array.isArray(extras.related)
    ? extras.related.map((r) => projectPublicCmsAdmission(r)).filter(Boolean)
    : undefined;
  const applyUrl = publicHttpUrlOrNull(doc.applyLink || doc.link);
  return {
    _id: doc._id,
    program: doc.program,
    slug: doc.slug,
    institution: doc.institution,
    university: doc.university || doc.institution,
    department: doc.department || null,
    countryCode: doc.countryCode || null,
    province: doc.province || null,
    city: doc.city || null,
    session: doc.session || null,
    deadline: doc.deadline || doc.lastDate || null,
    description: doc.description || '',
    eligibility: Array.isArray(doc.eligibility) ? doc.eligibility : [],
    applicationInstructions: doc.applicationInstructions || '',
    link: applyUrl,
    applyLink: applyUrl,
    fee: doc.fee || null,
    duration: doc.duration || null,
    degree: doc.degree || null,
    brochureUrl: publicHttpUrlOrNull(doc.brochureUrl),
    logoUrl: publicHttpUrlOrNull(doc.logoUrl),
    applicationMode: applyUrl ? 'external' : 'not_configured',
    authorityKind: AUTHORITY_KINDS.UNKNOWN,
    authorityLabel: authorityLabel(AUTHORITY_KINDS.UNKNOWN),
    sourceUrl: publicHttpUrlOrNull(doc.sourceUrl),
    related,
  };
}

export function projectPublicCanonicalInstitution(doc) {
  if (!doc) return null;
  return {
    _id: doc._id,
    officialName: doc.officialName,
    slug: doc.slug,
    countryCode: doc.countryCode || '',
    city: doc.city || '',
    region: doc.region || '',
    officialWebsite: publicHttpUrlOrNull(doc.officialWebsite),
    officialDomain: doc.officialDomain || '',
    institutionType: doc.institutionType,
    isPublic: doc.isPublic,
    status: doc.status,
    hasOrganizationManagement: !!doc.organizationId,
    sources: stripPrivateEvidence(doc.sources),
    lastVerifiedAt: doc.lastVerifiedAt || null,
    freshnessState: doc.freshnessState || 'unknown',
    authorityKind: AUTHORITY_KINDS.OFFICIAL_INSTITUTION,
    authorityLabel: authorityLabel(AUTHORITY_KINDS.OFFICIAL_INSTITUTION),
  };
}

export function projectPublicIntake(intake) {
  if (!intake) return null;
  const status = intake.status || 'draft';
  if (status === 'draft' || status === 'archived') return null;
  return {
    cycleLabel: intake.cycleLabel || '',
    applicationOpenDate: intake.applicationOpenDate || formatPublicDateOnly(intake.applicationOpenAt),
    deadlineDate: intake.deadlineDate || formatPublicDateOnly(intake.deadlineAt),
    startDate: intake.startDate || null,
    applicationMode: intake.applicationMode || 'not_configured',
    applicationUrl: publicHttpUrlOrNull(intake.applicationUrl),
    requirements: intake.requirements || '',
    fee: intake.fee && intake.fee.amountMinor != null ? intake.fee : null,
    notes: intake.notes || '',
    sourceUrl: publicHttpUrlOrNull(intake.sourceUrl),
    status,
  };
}

export function projectPublicProgram(doc) {
  if (!doc) return null;
  const institution = doc.institutionId && typeof doc.institutionId === 'object'
    ? {
        _id: doc.institutionId._id,
        officialName: doc.institutionId.officialName,
        slug: doc.institutionId.slug,
        countryCode: doc.institutionId.countryCode,
        city: doc.institutionId.city || '',
        region: doc.institutionId.region || '',
        institutionType: doc.institutionId.institutionType,
      }
    : doc.institutionId || null;

  return {
    _id: doc._id,
    name: doc.name,
    slug: doc.slug,
    degreeLevel: doc.degreeLevel || '',
    field: doc.field || '',
    studyMode: doc.studyMode || '',
    durationMonths: doc.durationMonths ?? null,
    country: doc.country || '',
    campus: doc.campus || '',
    language: doc.language || doc.instructionLanguage || '',
    officialProgramUrl: publicHttpUrlOrNull(doc.officialProgramUrl),
    admissionRequirementsUrl: publicHttpUrlOrNull(doc.admissionRequirementsUrl),
    tuition: doc.tuition && doc.tuition.amountMinor != null ? doc.tuition : null,
    intakes: Array.isArray(doc.intakes) ? doc.intakes.map(projectPublicIntake).filter(Boolean) : [],
    lastVerifiedAt: doc.lastVerifiedAt || null,
    freshnessState: doc.freshnessState || 'unknown',
    status: doc.status,
    institutionId: institution,
    authorityKind: AUTHORITY_KINDS.OFFICIAL_INSTITUTION,
    authorityLabel: authorityLabel(AUTHORITY_KINDS.OFFICIAL_INSTITUTION),
  };
}

export function publicSearchMetadata(metadata = {}) {
  if (!metadata || typeof metadata !== 'object') return {};
  const { adminEditUrl: _admin, ...rest } = metadata;
  return rest;
}
