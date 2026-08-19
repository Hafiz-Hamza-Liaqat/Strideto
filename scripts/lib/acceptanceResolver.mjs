import fs from 'node:fs';
import path from 'node:path';

export const ACCEPTANCE_REAL_PARAM_NOT_RESOLVED = 'ACCEPTANCE_REAL_PARAM_NOT_RESOLVED';

export function loadResolver() {
  const dir = process.env.STRIDETO_QA_RESOLVER_DIR || '';
  if (!dir) return null;
  const resolverPath = path.join(dir, 'resolver.json');
  if (!fs.existsSync(resolverPath)) {
    throw new Error(`ACCEPTANCE_RESOLVER_MISSING resolver.json not found at ${resolverPath}`);
  }
  return JSON.parse(fs.readFileSync(resolverPath, 'utf8'));
}

// Substitutes the single :param placeholder in a normalized route pattern.
function sub(pattern, value) {
  return pattern.replace(':param', value);
}

// Returns a resolved path for the given normalized route pattern × persona, or null (fail-closed).
// Keys use normalizePattern() output — all named params collapsed to :param.
export function resolveCanonicalUrl(resolver, routePattern, persona) {
  if (!resolver) return null;

  const r = resolver;
  const key = `${persona}:${routePattern}`;

  const resolverMap = {
    // ── ANONYMOUS / PUBLIC ────────────────────────────────────────────────────

    // Content detail pages — need real seeded records
    'anonymous:/jobs/:param': r.publicContent?.publicJobSlug
      ? sub(routePattern, r.publicContent.publicJobSlug)
      : null,
    'anonymous:/scholarships/:param': r.publicContent?.scholarshipSlug
      ? sub(routePattern, r.publicContent.scholarshipSlug)
      : null,
    'anonymous:/admissions/:param': r.publicContent?.admissionSlug
      ? sub(routePattern, r.publicContent.admissionSlug)
      : null,
    'anonymous:/schools-and-colleges/:param': r.publicContent?.institutionSlug
      ? sub(routePattern, r.publicContent.institutionSlug)
      : null,
    'anonymous:/foreign-studies/:param': r.publicContent?.foreignStudySlug
      ? sub(routePattern, r.publicContent.foreignStudySlug)
      : null,
    'anonymous:/blog/:param': r.publicContent?.blogSlug
      ? sub(routePattern, r.publicContent.blogSlug)
      : null,
    'anonymous:/career-guidance/:param': r.publicContent?.careerArticleSlug
      ? sub(routePattern, r.publicContent.careerArticleSlug)
      : null,
    'anonymous:/exam-prep/:param': r.publicContent?.examSlug
      ? sub(routePattern, r.publicContent.examSlug)
      : null,
    'anonymous:/exam-prep/quiz/:param': r.publicContent?.quizId
      ? sub(routePattern, r.publicContent.quizId)
      : null,
    'anonymous:/tests/:param': r.publicContent?.educationTestSlug
      ? sub(routePattern, r.publicContent.educationTestSlug)
      : null,
    'anonymous:/scholarship-intelligence/:param': r.publicContent?.canonicalScholarshipSlug
      ? sub(routePattern, r.publicContent.canonicalScholarshipSlug)
      : null,
    'anonymous:/program-explorer/:param': r.publicContent?.canonicalProgramSlug
      ? sub(routePattern, r.publicContent.canonicalProgramSlug)
      : null,
    'anonymous:/agents/:param': r.publicContent?.agentProfileSlug
      ? sub(routePattern, r.publicContent.agentProfileSlug)
      : null,
    'anonymous:/agents/marketplace/:param': r.publicContent?.approvedMarketplacePostSlug
      ? sub(routePattern, r.publicContent.approvedMarketplacePostSlug)
      : null,
    'anonymous:/business-services/:param': r.business?.independent?.listingId
      ? sub(routePattern, r.business.independent.listingId)
      : null,
    'anonymous:/internships/:param': r.publicContent?.internshipSlug
      ? sub(routePattern, r.publicContent.internshipSlug)
      : null,
    'anonymous:/intl-scholarships/:param': r.publicContent?.intlScholarshipId
      ? sub(routePattern, r.publicContent.intlScholarshipId)
      : null,
    'anonymous:/employer/:param': r.namespace
      ? sub(routePattern, `${r.namespace}-employer`)
      : null,
    'anonymous:/company/:param': r.publicContent?.companySlug
      ? sub(routePattern, r.publicContent.companySlug)
      : null,
    'anonymous:/university/:param': r.publicContent?.universitySlug
      ? sub(routePattern, r.publicContent.universitySlug)
      : null,

    // SEO landing pages — render search results, no specific record required
    'anonymous:/jobs-in-:param': sub(routePattern, 'pakistan'),
    'anonymous:/jobs/province/:param': sub(routePattern, 'punjab'),
    'anonymous:/jobs/category/:param': sub(routePattern, 'government-jobs'),
    'anonymous:/scholarships-in-:param': sub(routePattern, 'usa'),

    // Urdu locale routes — same records as English counterparts
    'anonymous:/ur/jobs/:param': r.publicContent?.publicJobSlug
      ? sub(routePattern, r.publicContent.publicJobSlug)
      : null,
    'anonymous:/ur/scholarships/:param': r.publicContent?.scholarshipSlug
      ? sub(routePattern, r.publicContent.scholarshipSlug)
      : null,
    'anonymous:/ur/admissions/:param': r.publicContent?.admissionSlug
      ? sub(routePattern, r.publicContent.admissionSlug)
      : null,
    'anonymous:/ur/blog/:param': r.publicContent?.blogSlug
      ? sub(routePattern, r.publicContent.blogSlug)
      : null,
    'anonymous:/ur/career-guidance/:param': r.publicContent?.careerArticleSlug
      ? sub(routePattern, r.publicContent.careerArticleSlug)
      : null,

    // ── STUDENT ───────────────────────────────────────────────────────────────

    'student:/applications/:param': r.studentCase?.applicationId
      ? sub(routePattern, r.studentCase.applicationId)
      : null,
    'student:/cases/:param': r.education?.independent?.professionalCaseId
      ? sub(routePattern, r.education.independent.professionalCaseId)
      : null,
    'student:/consultations/:param': r.education?.independent?.consultationId
      ? sub(routePattern, r.education.independent.consultationId)
      : null,
    'student:/assessments/:param/take': r.publicContent?.examSlug
      ? sub(routePattern, r.publicContent.examSlug)
      : null,
    'student:/assessments/:param': r.publicContent?.examSlug
      ? sub(routePattern, r.publicContent.examSlug)
      : null,
    'student:/vault/:param': r.portalFixtures?.vaultDocumentId
      ? sub(routePattern, r.portalFixtures.vaultDocumentId)
      : null,
    'student:/budget/:param': r.portalFixtures?.costPlanId
      ? sub(routePattern, r.portalFixtures.costPlanId)
      : null,
    'student:/personalization/programs/:param/eligibility': r.portalFixtures?.personalizationProgramId
      ? sub(routePattern, r.portalFixtures.personalizationProgramId)
      : null,
    'student:/personalization/scholarships/:param/eligibility': r.portalFixtures?.personalizationScholarshipId
      ? sub(routePattern, r.portalFixtures.personalizationScholarshipId)
      : null,
    'student:/apply/institution/:param': r.portalFixtures?.institutionProgramId
      ? sub(routePattern, r.portalFixtures.institutionProgramId)
      : null,

    // ── BUSINESS-CLIENT ───────────────────────────────────────────────────────

    'business-client:/business/requests/:param': r.businessClient?.a?.requestPublicRef
      ? sub(routePattern, r.businessClient.a.requestPublicRef)
      : null,
    'business-client:/business/quotes/:param': r.businessClient?.a?.quotePublicRef
      ? sub(routePattern, r.businessClient.a.quotePublicRef)
      : null,
    'business-client:/business/cases/:param': r.businessClient?.a?.casePublicRef
      ? sub(routePattern, r.businessClient.a.casePublicRef)
      : null,

    // ── EMPLOYER ──────────────────────────────────────────────────────────────

    'employer:/employer/jobs/:param/edit': r.portalFixtures?.employerJobId
      ? sub(routePattern, r.portalFixtures.employerJobId)
      : null,
    'employer:/employer/intelligence/candidates/:param': r.portalFixtures?.opportunityApplicationId
      ? sub(routePattern, r.portalFixtures.opportunityApplicationId)
      : null,

    // ── INSTITUTION ───────────────────────────────────────────────────────────

    'institution:/institution/programs/:param/edit': r.portalFixtures?.institutionProgramId
      ? sub(routePattern, r.portalFixtures.institutionProgramId)
      : null,
    'institution:/institution/applications/:param': r.portalFixtures?.institutionAdmissionApplicationId
      ? sub(routePattern, r.portalFixtures.institutionAdmissionApplicationId)
      : null,

    // ── ADMIN ─────────────────────────────────────────────────────────────────

    'admin:/admin/gbs/capabilities/:param': r.business?.independent?.providerCapabilityId
      ? sub(routePattern, r.business.independent.providerCapabilityId)
      : null,
    'admin:/admin/gbs/listings/:param': r.business?.independent?.listingId
      ? sub(routePattern, r.business.independent.listingId)
      : null,
    'admin:/admin/forms/:param': r.portalFixtures?.formDefinitionId
      ? sub(routePattern, r.portalFixtures.formDefinitionId)
      : null,
    'admin:/admin/sc/organizations/:param': r.institution?.organizationId
      ? sub(routePattern, r.institution.organizationId)
      : null,

    // ── EDUCATION PROVIDERS ───────────────────────────────────────────────────

    'education-independent:/agent/education/consultations/:param': r.education?.independent?.consultationId
      ? sub(routePattern, r.education.independent.consultationId)
      : null,
    'education-agency:/agent/education/consultations/:param': r.education?.agency?.consultationId
      ? sub(routePattern, r.education.agency.consultationId)
      : null,
    'education-independent:/agent/education/cases/:param': r.education?.independent?.professionalCaseId
      ? sub(routePattern, r.education.independent.professionalCaseId)
      : null,
    'education-agency:/agent/education/cases/:param': r.education?.agency?.professionalCaseId
      ? sub(routePattern, r.education.agency.professionalCaseId)
      : null,
    'education-independent:/agent/education/marketplace/:param/edit': r.admin?.pendingPostId
      ? sub(routePattern, r.admin.pendingPostId)
      : null,
    'education-agency:/agent/education/marketplace/:param/edit': r.admin?.agencyPostId
      ? sub(routePattern, r.admin.agencyPostId)
      : null,

    // ── BUSINESS PROVIDERS (GBS) ──────────────────────────────────────────────

    'business-independent:/agent/business-services/listings/:param/edit': r.business?.independent?.listingId
      ? sub(routePattern, r.business.independent.listingId)
      : null,
    'business-agency:/agent/business-services/listings/:param/edit': r.business?.agency?.listingId
      ? sub(routePattern, r.business.agency.listingId)
      : null,
    'business-independent:/agent/business-services/requests/:param': r.businessClient?.a?.requestPublicRef
      ? sub(routePattern, r.businessClient.a.requestPublicRef)
      : null,
    'business-agency:/agent/business-services/requests/:param': r.businessClient?.b?.requestPublicRef
      ? sub(routePattern, r.businessClient.b.requestPublicRef)
      : null,
    'business-independent:/agent/business-services/quotes/:param': r.businessClient?.a?.quotePublicRef
      ? sub(routePattern, r.businessClient.a.quotePublicRef)
      : null,
    'business-agency:/agent/business-services/quotes/:param': r.businessClient?.b?.quotePublicRef
      ? sub(routePattern, r.businessClient.b.quotePublicRef)
      : null,
    'business-independent:/agent/business-services/cases/:param': r.businessClient?.a?.casePublicRef
      ? sub(routePattern, r.businessClient.a.casePublicRef)
      : null,
    'business-agency:/agent/business-services/cases/:param': r.businessClient?.b?.casePublicRef
      ? sub(routePattern, r.businessClient.b.casePublicRef)
      : null,
  };

  if (key in resolverMap) return resolverMap[key];
  return null; // fail-closed for all unmapped parametric routes
}
