/**
 * Canonical, deterministic acceptance fixtures.
 *
 * The response shapes below mirror the production contracts in:
 * - server/src/services/consultationService.js (agent detail projection)
 * - server/src/services/agentMarketplaceService.js (list/counts)
 * - server/src/controllers/agentController.js (verification summary)
 */

export const FIXTURE = {
  id: '507f1f77bcf86cd799439011',
  caseId: '507f1f77bcf86cd799439011',
  consultationId: '507f1f77bcf86cd799439015',
  requestRef: 'GBSR-QA-REQUEST',
  quoteRef: 'GBSQ-QA-QUOTE',
  caseRef: 'GBSC-QA-CASE',
  listingId: '507f1f77bcf86cd799439013',
  postId: '507f1f77bcf86cd799439013',
  applicationId: '507f1f77bcf86cd799439014',
  programId: '507f1f77bcf86cd799439017',
  jobId: '507f1f77bcf86cd799439012',
  quizId: '507f1f77bcf86cd799439016',
  slug: 'fixture',
  country: 'pakistan',
};

const consultationGraphs = {
  'education-independent': {
    accountId: '507f1f77bcf86cd799439101', organizationId: '507f1f77bcf86cd799439102',
    membershipId: '507f1f77bcf86cd799439103', studentUserId: '507f1f77bcf86cd799439104',
    serviceId: '507f1f77bcf86cd799439105', threadId: '507f1f77bcf86cd799439106',
    agentType: 'agent', accountType: 'professional', professionalName: 'QA Education Independent',
  },
  'education-agency': {
    accountId: '507f1f77bcf86cd799439201', organizationId: '507f1f77bcf86cd799439202',
    membershipId: '507f1f77bcf86cd799439203', studentUserId: '507f1f77bcf86cd799439204',
    serviceId: '507f1f77bcf86cd799439205', threadId: '507f1f77bcf86cd799439206',
    agentType: 'agency', accountType: 'agency', professionalName: 'QA Education Agency',
  },
};

export function consultationFixtureFor(persona) {
  const graph = consultationGraphs[persona];
  if (!graph) throw new Error(`No education consultation fixture for persona ${persona}`);
  const createdAt = '2026-08-18T08:00:00.000Z';
  return {
    consultation: {
      id: FIXTURE.consultationId,
      studentUserId: graph.studentUserId,
      organizationId: graph.organizationId,
      assignedMembershipId: graph.membershipId,
      agentServiceId: graph.serviceId,
      marketplacePostId: null,
      consultationType: 'initial',
      status: 'requested',
      requestedWindow: { start: '2026-08-20T10:00:00.000Z', end: '2026-08-20T11:00:00.000Z' },
      confirmedStart: null,
      durationMinutes: 60,
      timezone: 'Asia/Karachi',
      meetingMode: 'video',
      meetingMetadata: { link: null, location: null, dialIn: null },
      purpose: 'Education pathway consultation',
      studentNote: 'Canonical acceptance consultation fixture.',
      agentNote: '',
      paymentState: 'unpaid',
      service: {
        title: 'Education pathway guidance', category: 'education_guidance', description: 'Canonical QA service snapshot.',
        pricingMode: 'free', price: 0, deliveryMode: 'video', journeyType: 'education', countriesServed: ['PK'],
        destinationCountries: ['GB'], durationEstimate: '60 minutes', eligibilityNotes: 'Open consultation eligibility.',
      },
      verificationState: 'approved', restricted: false, cancellation: null, completion: null,
      createdAt, updatedAt: createdAt,
      student: { id: graph.studentUserId, name: `QA Student for ${graph.professionalName}` },
      leadId: null,
    },
    history: [{ id: `${FIXTURE.consultationId}-history`, actorType: 'student', fromStatus: null, toStatus: 'requested', createdAt }],
    threadId: graph.threadId,
    graph,
  };
}

export function consultationNegativeResponse(requestingPersona, ownerPersona) {
  if (requestingPersona === ownerPersona) return [200, consultationFixtureFor(ownerPersona)];
  return [403, { error: 'Consultation access denied' }];
}

export class AcceptanceFixtureContractError extends Error {
  constructor({ method = 'GET', pathname, persona, routeId }) {
    super(`UNHANDLED_ACCEPTANCE_API method=${method} pathname=${pathname} persona=${persona} routeId=${routeId || 'unknown'}`);
    this.name = 'AcceptanceFixtureContractError';
    this.code = 'UNHANDLED_ACCEPTANCE_API';
    this.method = method;
    this.pathname = pathname;
    this.persona = persona;
    this.routeId = routeId || 'unknown';
  }
}

export function serializeConsoleError(error, location = {}) {
  return { name: error?.name || 'Error', message: error?.message || String(error), stack: error?.stack || null, location: { url: location.url || null, line: location.lineNumber ?? null, column: location.columnNumber ?? null } };
}

export function mockResponse(pathname, persona, { method = 'GET', routeId = 'unknown' } = {}) {
  const agent = ['education-independent', 'education-agency', 'business-independent', 'business-agency'].includes(persona);
  if (pathname.startsWith('/api/auth/agent/')) return agent || persona === 'admin' ? [200, { accessToken: `qa-agent-${persona}`, account: { _id: `qa-${persona}`, email: `${persona}@example.test`, agentType: persona.includes('agency') ? 'agency' : 'agent' }, memberships: [] }] : [401, {}];
  if (pathname.startsWith('/api/admin/auth/')) return persona === 'admin' ? [200, { accessToken: 'qa-admin', admin: { _id: 'qa-admin', email: 'admin@example.test', role: 'super_admin', permissions: ['*'] } }] : [401, {}];
  if (pathname.startsWith('/api/auth/')) return ['student', 'business-client', 'employer', 'institution'].includes(persona) ? [200, { accessToken: `qa-user-${persona}`, user: { _id: `qa-${persona}`, name: `QA ${persona}`, role: 'User', capabilities: persona === 'business-client' ? ['business_client'] : [] } }] : [401, {}];
  if (pathname.includes('/notifications') || pathname.includes('/announcements')) return [200, { data: [], items: [], pagination: { totalPages: 1 }, unreadCount: 0 }];
  if (pathname === '/api/monetization/ad-slots') return [200, { slots: [] }];
  if (pathname === '/api/cms/site/homepage') return [200, { sections: [], data: {} }];
  if (pathname === '/api/cms/site/navigation') return [200, { items: [] }];
  if (pathname === '/api/cms/site/banners') return [200, { banners: [] }];
  if (pathname === '/api/education/institutions') return [200, { institutions: [], total: 0, page: 1, totalPages: 0 }];
  if (pathname === '/api/vault/documents') return [200, { documents: [], total: 0, page: 1, totalPages: 0 }];
  if (pathname === '/api/agent/business-services/context') return [200, { enabled: true, accountId: `qa-${persona}`, organizationId: `qa-org-${persona}`, capabilities: [] }];
  if (pathname === '/api/agent/business-services/catalog') return [200, { services: [], total: 0, page: 1, totalPages: 0 }];
  if (pathname === '/api/business/enabled') return [200, { enabled: persona === 'business-client', publicMarketplaceEnabled: false }];
  if (pathname === '/api/employer/me') return [200, { employer: { id: `qa-${persona}`, name: 'QA Employer', verified: true }, organization: { id: `qa-org-${persona}`, name: 'QA Employer' } }];
  if (pathname === '/api/employer/dashboard') return [200, { activeJobs: 0, totalApplications: 0, totalViews: 0, shortlistedCandidates: 0, jobs: [], conversionRateLabel: 'n/a', verified: true, verificationStatus: 'approved', verificationLevel: 'verified', draftJobs: 0, pendingApprovalJobs: 0, closedJobs: 0, newApplications: 0, totalJobs: 0, interviews: 0, unreadNotifications: 0, verificationState: 'approved' }];
  if (pathname.includes('/admin/agent-marketplace')) return [200, { posts: [], permissions: ['workflow:review', 'workflow:approve'] }];
  if (pathname === '/api/agent/provider-domains/context') return [200, { accountId: `qa-${persona}`, needsOnboarding: false, workspaces: [] }];
  if (pathname === '/api/agent/business-services/enabled') return persona.startsWith('business-') ? [200, { enabled: true, publicMarketplaceEnabled: false }] : [403, { error: 'business domain denied' }];
  if (pathname === '/api/agent/education/enabled') return persona.startsWith('education-') ? [200, { enabled: true }] : [403, { error: 'education domain denied' }];
  if (pathname === '/api/agent/profile') return [200, { profile: { agentType: persona.includes('agency') ? 'agency' : 'agent', professionalName: `QA ${persona}` } }];
  if (pathname === '/api/agent/dashboard') return [200, { verificationStatus: 'approved', profileCompleteness: 90, cards: {}, consultations: {}, marketplace: {}, attention: { limit: 5, providerTasks: [], applications: [], documentRequests: [], unreadMessages: 0 } }];
  if (pathname === '/api/agent/business-services/overview') return [200, { counters: {}, attention: { limit: 5, requests: [], quotes: [], cases: [], messages: [] } }];
  if (pathname === '/api/business/overview') return [200, { counts: {}, caseCounts: {}, recent: [], attention: { limit: 5, pendingQuotes: [], customerCases: [], documentExchange: 'unavailable_private_beta', filingAuthorization: 'unavailable' } }];
  if (pathname.includes('/api/agent/consultations/threads/') && pathname.endsWith('/messages')) return [200, { messages: [], pagination: { page: 1, limit: 50, total: 0, pages: 0 } }];
  if (pathname.includes('/api/agent/consultations/threads/') && pathname.endsWith('/read')) return [200, { ok: true }];
  if (/^\/api\/agent\/consultations\/[a-f0-9]{24}$/i.test(pathname)) {
    if (!['education-independent', 'education-agency'].includes(persona)) return [403, { error: 'education consultation domain denied' }];
    return [200, consultationFixtureFor(persona)];
  }
  if (pathname === '/api/agent/marketplace/counts') return [200, { counts: { approved: 0, publiclyEligible: 0, drafts: 0, pendingReview: 0, expired: 0, freeEntitlement: { available: false, consumed: false }, paidPublishingPlans: 'not_configured' } }];
  if (pathname === '/api/agent/marketplace') return [200, { posts: [], total: 0, page: 1, limit: 20, pages: 0 }];
  if (pathname === '/api/agent/verification') {
    const graph = consultationGraphs[persona];
    return [200, { organizationId: graph?.organizationId || `qa-${persona}`, agentType: graph?.agentType || 'agent', accountType: graph?.accountType || 'professional', verificationStatus: 'approved', isApproved: true, trustBadges: [], credentialPolicy: {}, verificationSources: [], mapsSupportingOnly: true, mapsCannotAloneResultInVerified: true, selfApprovalDenied: true, note: 'Verification is determined by the canonical server authority.' }];
  }
  if (pathname.includes('/cases')) return [200, { case: { id: FIXTURE.caseId, _id: FIXTURE.caseId, title: 'QA Professional Case', lifecycle: 'active', caseType: 'study', currentStage: 'intake' }, applications: [], tasks: [], documentRequests: [], timeline: [], messages: [], childPagination: {} }];
  if (pathname.includes('/api/agent/business-services/cases')) return [200, { case: { publicCaseRef: FIXTURE.caseRef, titleSnapshot: 'QA Business Case', status: 'open', currentMilestoneKey: 'intake' }, requirements: [], messages: [], timeline: [] }];
  if (pathname.includes('/api/business/quotes')) return pathname.includes('other') ? [403, { error: 'resource denied' }] : [200, { quote: { publicQuoteRef: FIXTURE.quoteRef, titleSnapshot: 'QA Business Quote', status: 'sent' }, messages: [] }];
  if (pathname === '/api/agents' || pathname.startsWith('/api/agents?')) return [200, { profiles: [], total: 0, page: 1, totalPages: 0 }];
  throw new AcceptanceFixtureContractError({ method, pathname, persona, routeId });
}
