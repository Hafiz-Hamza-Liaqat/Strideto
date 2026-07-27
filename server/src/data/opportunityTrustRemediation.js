const PLACEHOLDER_RE = /\b(qa|test|demo|placeholder)\b/i;
const LEGACY_BRAND_RE = /edurozgaar/i;
const LEGACY_LINK_RE = /edurozgaar\.pk|strideto\.com\/scholarships/i;
const HASH_TITLE_RE = /\(#\d+\)$/;
const JOB_LIKE_SCHOLARSHIP_RE = /engineer|developer|remote|wallets|job/i;
const SCHOLARSHIP_TITLE_RE = /scholarship|fellowship|bursary|grant/i;
const GENERIC_INTL_TITLE_RE = /study visa|visa/i;

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeText(value) {
  return hasText(value) ? value.trim() : '';
}

function isFutureDate(value, now = new Date()) {
  if (!value) return false;
  const d = value instanceof Date ? value : new Date(value);
  return !Number.isNaN(d.getTime()) && d.getTime() > now.getTime();
}

function isPastDate(value, now = new Date()) {
  if (!value) return false;
  const d = value instanceof Date ? value : new Date(value);
  return !Number.isNaN(d.getTime()) && d.getTime() < now.getTime();
}

function firstPresentDate(...values) {
  for (const value of values) {
    if (!value) continue;
    const d = value instanceof Date ? value : new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

function placeholderSignal(...values) {
  return values.some((value) => PLACEHOLDER_RE.test(normalizeText(value)));
}

function legacyBrandSignal(...values) {
  return values.some((value) => LEGACY_BRAND_RE.test(normalizeText(value)));
}

function legacyLinkSignal(value) {
  return LEGACY_LINK_RE.test(normalizeText(value));
}

export const TRUSTED_CONTENT_MINIMUMS = {
  jobs: 10,
  scholarships: 8,
  admissions: 6,
  internships: 4,
  intlScholarships: 4,
};

/** Active public record eligible for deferred-remediation replacement gate. */
export function isTrustedActiveOpportunity(metrics) {
  if (metrics.status !== 'active') return false;
  if (metrics.isLaunch || metrics.isBeta || metrics.hasPlaceholder) return false;
  if (!metrics.hasSourceUrl && !metrics.hasApplicationLink) return false;
  if (legacyLinkSignal(metrics.applicationLink) || legacyLinkSignal(metrics.sourceUrl)) return false;
  if (metrics.hasPastDeadline) return false;
  if (metrics.deadline && !metrics.hasFutureDeadline) return false;
  return true;
}

export function countTrustedActiveOpportunities(classified) {
  return {
    jobs: classified.jobs.filter((m) => isTrustedActiveOpportunity(m)).length,
    scholarships: classified.scholarships.filter((m) => isTrustedActiveOpportunity(m)).length,
    admissions: classified.admissions.filter((m) => isTrustedActiveOpportunity(m)).length,
    internships: classified.internships.filter((m) => isTrustedActiveOpportunity(m)).length,
    intlScholarships: classified.intlScholarships.filter((m) => isTrustedActiveOpportunity(m)).length,
  };
}

export function evaluateTrustedContentGate(classified) {
  const counts = countTrustedActiveOpportunities(classified);
  const deficits = {};
  for (const [key, minimum] of Object.entries(TRUSTED_CONTENT_MINIMUMS)) {
    if (counts[key] < minimum) {
      deficits[key] = { required: minimum, actual: counts[key], shortfall: minimum - counts[key] };
    }
  }
  return {
    counts,
    minimums: { ...TRUSTED_CONTENT_MINIMUMS },
    passed: Object.keys(deficits).length === 0,
    deficits,
  };
}

function makeBaseMetrics(doc, type, now) {
  const externalId = normalizeText(doc.externalId);
  const slug = normalizeText(doc.slug);
  const sourceUrl = normalizeText(doc.sourceUrl);
  const applicationLink = normalizeText(doc.applicationLink || doc.applyLink || doc.link);
  const deadline = firstPresentDate(doc.deadline, doc.applicationDeadline, doc.lastDate, doc.expiresAt);
  const title = normalizeText(doc.title || doc.program);
  const organization = normalizeText(doc.company || doc.organization || doc.provider || doc.institution || doc.university);
  const location = normalizeText(doc.location || [doc.city, doc.province, doc.country].filter(Boolean).join(', '));
  const requirementsCount = Array.isArray(doc.requirements) ? doc.requirements.length : 0;
  const eligibilityCount = Array.isArray(doc.eligibility) ? doc.eligibility.length : 0;

  return {
    type,
    id: String(doc._id),
    slug,
    externalId,
    status: normalizeText(doc.status),
    title,
    organization,
    location,
    sourceUrl,
    applicationLink,
    hasSourceUrl: hasText(sourceUrl),
    hasApplicationLink: hasText(applicationLink),
    hasFutureDeadline: isFutureDate(deadline, now),
    hasPastDeadline: isPastDate(deadline, now),
    isLaunch: /^launch-v1-/i.test(externalId),
    isBeta: /^beta-v1-/i.test(externalId) || /^beta-v1-/i.test(slug),
    hasPlaceholder: placeholderSignal(title, organization, slug),
    hasLegacyBrand: legacyBrandSignal(title, organization, sourceUrl, applicationLink, slug),
    missingOrganization: !hasText(organization),
    missingLocation: !hasText(location),
    missingRequirements: requirementsCount === 0 && eligibilityCount === 0,
    deadline,
  };
}

export function classifyJob(doc, now = new Date()) {
  const m = makeBaseMetrics(doc, 'jobs', now);
  const notes = [];
  let classification = 'verified_public';
  let proposedAction = null;
  let proposedStatus = null;

  if (m.hasPastDeadline && m.status === 'active') {
    classification = 'expired';
    proposedAction = 'close';
    proposedStatus = 'closed';
    notes.push('past_deadline');
  } else if (m.isLaunch) {
    classification = 'synthetic_launch_demo';
    proposedAction = 'draft';
    proposedStatus = 'draft';
    notes.push('launch_v1');
  } else if (m.isBeta || m.hasPlaceholder || m.hasLegacyBrand) {
    classification = 'invalid_incomplete';
    proposedAction = m.status === 'active' ? 'draft' : null;
    proposedStatus = proposedAction ? 'draft' : null;
    notes.push('placeholder_or_beta');
  } else if (m.missingOrganization || !m.title || (!m.hasSourceUrl && !m.hasApplicationLink)) {
    classification = 'admin_manual_review';
    notes.push('missing_trust_metadata');
  } else if (!m.hasSourceUrl && m.hasApplicationLink) {
    classification = 'potentially_valid_missing_metadata';
    notes.push('apply_link_without_source_url');
  }

  return { ...m, classification, proposedAction, proposedStatus, notes };
}

export function classifyScholarship(doc, now = new Date()) {
  const m = makeBaseMetrics(doc, 'scholarships', now);
  const notes = [];
  let classification = 'verified_public';
  let proposedAction = null;
  let proposedStatus = null;

  if (m.hasPastDeadline && m.status === 'active') {
    classification = 'expired';
    proposedAction = 'close';
    proposedStatus = 'closed';
    notes.push('past_deadline');
  } else if (m.isBeta || m.hasPlaceholder || JOB_LIKE_SCHOLARSHIP_RE.test(m.title) || m.missingOrganization || !m.hasApplicationLink) {
    classification = 'invalid_incomplete';
    proposedAction = m.status === 'active' ? 'draft' : null;
    proposedStatus = proposedAction ? 'draft' : null;
    notes.push('invalid_or_non_scholarship');
  } else if (legacyLinkSignal(m.applicationLink)) {
    classification = 'synthetic_launch_demo';
    proposedAction = m.status === 'active' ? 'draft' : null;
    proposedStatus = proposedAction ? 'draft' : null;
    notes.push('legacy_domain_link');
  } else if (HASH_TITLE_RE.test(m.title)) {
    classification = 'admin_manual_review';
    notes.push('seed_title_pattern');
  } else if (!m.hasSourceUrl && m.hasApplicationLink) {
    classification = 'potentially_valid_missing_metadata';
    notes.push('official_link_only');
  }

  return { ...m, classification, proposedAction, proposedStatus, notes };
}

export function classifyAdmission(doc, now = new Date()) {
  const m = makeBaseMetrics(doc, 'admissions', now);
  const notes = [];
  let classification = 'verified_public';
  let proposedAction = null;
  let proposedStatus = null;
  const session = normalizeText(doc.session);

  if (m.hasPastDeadline && m.status === 'active') {
    classification = 'expired';
    proposedAction = 'close';
    proposedStatus = 'closed';
    notes.push('past_deadline');
  } else if ((!m.hasSourceUrl && !m.hasApplicationLink) || m.hasPlaceholder || m.isBeta || m.missingOrganization) {
    classification = 'invalid_incomplete';
    proposedAction = m.status === 'active' ? 'draft' : null;
    proposedStatus = proposedAction ? 'draft' : null;
    notes.push('missing_core_metadata');
  } else if (/^Fall 202[45]$/i.test(session) && !m.hasSourceUrl && normalizeText(doc.source) === 'manual') {
    classification = 'synthetic_launch_demo';
    proposedAction = m.status === 'active' ? 'draft' : null;
    proposedStatus = proposedAction ? 'draft' : null;
    notes.push('launch_session_pattern');
  } else if (!m.hasSourceUrl && m.hasApplicationLink) {
    classification = 'potentially_valid_missing_metadata';
    notes.push('apply_link_without_source_url');
  }

  return { ...m, classification, proposedAction, proposedStatus, notes, session };
}

export function classifyInternship(doc, now = new Date()) {
  const m = makeBaseMetrics(doc, 'internships', now);
  const notes = [];
  let classification = 'verified_public';
  let proposedAction = null;
  let proposedStatus = null;

  if (m.hasPastDeadline && m.status === 'active') {
    classification = 'expired';
    proposedAction = 'close';
    proposedStatus = 'closed';
    notes.push('past_deadline');
  } else if (m.hasPlaceholder || m.isBeta || m.missingOrganization || !m.hasApplicationLink) {
    classification = 'invalid_incomplete';
    proposedAction = m.status === 'active' ? 'draft' : null;
    proposedStatus = proposedAction ? 'draft' : null;
    notes.push('missing_core_metadata');
  }

  return { ...m, classification, proposedAction, proposedStatus, notes };
}

export function classifyIntlScholarship(doc, now = new Date()) {
  const m = makeBaseMetrics(doc, 'intlScholarships', now);
  const notes = [];
  let classification = 'verified_public';
  let proposedAction = null;
  let proposedStatus = null;
  const hasScholarshipShape = hasText(doc.degreeLevel) || hasText(doc.fundingType) || (Array.isArray(doc.eligibility) && doc.eligibility.length > 0);

  if (m.hasPastDeadline && m.status === 'active') {
    classification = 'expired';
    proposedAction = 'close';
    proposedStatus = 'closed';
    notes.push('past_deadline');
  } else if (!m.hasApplicationLink || m.hasPlaceholder || m.isBeta || GENERIC_INTL_TITLE_RE.test(m.title) || !SCHOLARSHIP_TITLE_RE.test(m.title) || !hasScholarshipShape) {
    classification = 'invalid_incomplete';
    proposedAction = m.status === 'active' ? 'draft' : null;
    proposedStatus = proposedAction ? 'draft' : null;
    notes.push('not_scholarship_like');
  }

  return { ...m, classification, proposedAction, proposedStatus, notes };
}

function summarize(items) {
  const summary = {
    total: items.length,
    active: 0,
    draft: 0,
    closed: 0,
    expired: 0,
    sourceUrlPresent: 0,
    applicationLinkPresent: 0,
    launchV1: 0,
    betaV1: 0,
    adminCreatedNoSeedMarker: 0,
    futureDeadline: 0,
    pastDeadline: 0,
    missingOrganization: 0,
    missingLocation: 0,
    missingEligibilityOrRequirements: 0,
    classifications: {
      verified_public: 0,
      potentially_valid_missing_metadata: 0,
      synthetic_launch_demo: 0,
      expired: 0,
      invalid_incomplete: 0,
      admin_manual_review: 0,
    },
    proposedChanges: {
      draft: 0,
      close: 0,
      unchanged: 0,
      ambiguous: 0,
    },
  };

  for (const item of items) {
    if (item.status === 'active') summary.active += 1;
    if (item.status === 'draft') summary.draft += 1;
    if (item.status === 'closed') summary.closed += 1;
    if (item.hasPastDeadline) summary.expired += 1;
    if (item.hasSourceUrl) summary.sourceUrlPresent += 1;
    if (item.hasApplicationLink) summary.applicationLinkPresent += 1;
    if (item.isLaunch) summary.launchV1 += 1;
    if (item.isBeta) summary.betaV1 += 1;
    if (!item.isLaunch && !item.isBeta) summary.adminCreatedNoSeedMarker += 1;
    if (item.hasFutureDeadline) summary.futureDeadline += 1;
    if (item.hasPastDeadline) summary.pastDeadline += 1;
    if (item.missingOrganization) summary.missingOrganization += 1;
    if (item.missingLocation) summary.missingLocation += 1;
    if (item.missingRequirements) summary.missingEligibilityOrRequirements += 1;
    summary.classifications[item.classification] += 1;

    if (item.proposedAction === 'draft') summary.proposedChanges.draft += 1;
    else if (item.proposedAction === 'close') summary.proposedChanges.close += 1;
    else if (item.classification === 'admin_manual_review') summary.proposedChanges.ambiguous += 1;
    else summary.proposedChanges.unchanged += 1;
  }

  return summary;
}

export function buildTrustAuditReport(datasets, now = new Date()) {
  const classified = {
    jobs: datasets.jobs.map((doc) => classifyJob(doc, now)),
    scholarships: datasets.scholarships.map((doc) => classifyScholarship(doc, now)),
    admissions: datasets.admissions.map((doc) => classifyAdmission(doc, now)),
    internships: datasets.internships.map((doc) => classifyInternship(doc, now)),
    intlScholarships: datasets.intlScholarships.map((doc) => classifyIntlScholarship(doc, now)),
  };

  const summaries = {
    jobs: summarize(classified.jobs),
    scholarships: summarize(classified.scholarships),
    admissions: summarize(classified.admissions),
    internships: summarize(classified.internships),
    intlScholarships: summarize(classified.intlScholarships),
  };

  const targets = {
    draft: [],
    close: [],
    ambiguous: [],
  };

  for (const [type, items] of Object.entries(classified)) {
    for (const item of items) {
      const target = {
        type,
        id: item.id,
        externalId: item.externalId || null,
        slug: item.slug || null,
        classification: item.classification,
        proposedStatus: item.proposedStatus,
        notes: item.notes,
      };
      if (item.proposedAction === 'draft') targets.draft.push(target);
      else if (item.proposedAction === 'close') targets.close.push(target);
      else if (item.classification === 'admin_manual_review' || item.classification === 'potentially_valid_missing_metadata') targets.ambiguous.push(target);
    }
  }

  return { classified, summaries, targets };
}

export async function applyExplicitTargets(models, targets) {
  const applied = { drafted: 0, closed: 0, unchanged: 0 };
  const byType = {
    jobs: models.Job,
    scholarships: models.Scholarship,
    admissions: models.Admission,
    internships: models.Internship,
    intlScholarships: models.IntlScholarship,
  };

  for (const target of targets.draft) {
    const Model = byType[target.type];
    const result = await Model.updateOne(
      { _id: target.id, status: 'active' },
      { $set: { status: 'draft' } }
    );
    if (result.modifiedCount) applied.drafted += 1;
    else applied.unchanged += 1;
  }

  for (const target of targets.close) {
    const Model = byType[target.type];
    const result = await Model.updateOne(
      { _id: target.id, status: 'active' },
      { $set: { status: 'closed' } }
    );
    if (result.modifiedCount) applied.closed += 1;
    else applied.unchanged += 1;
  }

  return applied;
}

export function formatRemediationSummary(audit) {
  return {
    examinedCount:
      audit.summaries.jobs.total +
      audit.summaries.scholarships.total +
      audit.summaries.admissions.total +
      audit.summaries.internships.total +
      audit.summaries.intlScholarships.total,
    unchangedCount:
      audit.summaries.jobs.proposedChanges.unchanged +
      audit.summaries.scholarships.proposedChanges.unchanged +
      audit.summaries.admissions.proposedChanges.unchanged +
      audit.summaries.internships.proposedChanges.unchanged +
      audit.summaries.intlScholarships.proposedChanges.unchanged,
    wouldDraftCount: audit.targets.draft.length,
    wouldCloseCount: audit.targets.close.length,
    rejectedAmbiguousCount: audit.targets.ambiguous.length,
  };
}

export function reviewBetaSeedPayload({ demo, editorial, reference }) {
  return {
    safeToRun: {
      demoOpportunitiesRemainDraft: demo.jobs.every((x) => x.status === 'draft')
        && demo.scholarships.every((x) => x.status === 'draft')
        && demo.admissions.every((x) => x.status === 'draft')
        && demo.internships.every((x) => x.status === 'draft')
        && demo.intlScholarships.every((x) => x.status === 'draft'),
      blogsOriginalAndPublished: editorial.blogs.every((x) => x.status === 'published' && hasText(x.content) && !legacyBrandSignal(x.title, x.content)),
      careerArticlesOriginalAndPublished: editorial.careerArticles.every((x) => x.status === 'published' && hasText(x.content) && !legacyBrandSignal(x.title, x.content)),
      referenceProfilesClearlyLabeled:
        reference.institutions.every((x) => /\(Beta\)|Reference/i.test(x.name))
        && reference.universities.every((x) => /Beta|Reference/i.test(x.name)),
      webinarsFutureDated: reference.webinars.every((x) => isFutureDate(x.scheduledAt)),
      officialLinksLookValid:
        reference.foreignStudies.every((x) => hasText(x.link) && /^https?:\/\//i.test(x.link))
        && reference.webinars.every((x) => hasText(x.registrationUrl)),
      noEduRozgaarBranding:
        !JSON.stringify({ demo, editorial, reference }).match(/edurozgaar/i),
    },
    insertionList: {
      draftJobs: demo.jobs.map((x) => x.externalId),
      draftScholarships: demo.scholarships.map((x) => x.slug),
      draftAdmissions: demo.admissions.map((x) => x.slug),
      draftInternships: demo.internships.map((x) => x.slug),
      draftIntlScholarships: demo.intlScholarships.map((x) => x.slug),
      publishedBlogs: editorial.blogs.map((x) => x.slug),
      publishedCareerArticles: editorial.careerArticles.map((x) => x.slug),
      activeInstitutions: reference.institutions.map((x) => x.slug),
      activeUniversities: reference.universities.map((x) => x.slug),
      activeForeignStudies: reference.foreignStudies.map((x) => x.slug),
      scheduledWebinars: reference.webinars.map((x) => x.slug),
      activeCompanies: reference.companies.map((x) => x.slug),
      publicOpportunities: [],
    },
  };
}
