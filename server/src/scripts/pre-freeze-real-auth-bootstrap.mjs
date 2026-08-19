/** Disposable, namespaced real-auth account bootstrap for QA only. */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { AgentAccount } from '../models/agent/AgentAccount.js';
import { Employer } from '../models/Employer.js';
import { InstitutionAccount } from '../models/institution/InstitutionAccount.js';
import { InstitutionMembership } from '../models/institution/InstitutionMembership.js';
import { Organization } from '../models/Organization.js';
import { AgentProfile } from '../models/agent/AgentProfile.js';
import { AgentMembership } from '../models/agent/AgentMembership.js';
import { AgentService } from '../models/agent/AgentService.js';
import { AgentMarketplacePost } from '../models/agent/AgentMarketplacePost.js';
import { Consultation } from '../models/consultation/Consultation.js';
import { ProfessionalCase } from '../models/case/ProfessionalCase.js';
import { ProfessionalCaseApplication } from '../models/case/ProfessionalCaseApplication.js';
import { CaseTask } from '../models/case/CaseRecords.js';
import { ProviderDomainEnrollment } from '../models/gbs/ProviderDomainEnrollment.js';
import { ProviderCapability } from '../models/gbs/ProviderCapability.js';
import { GbsProviderProfessionalProfile } from '../models/gbs/GbsProviderProfessionalProfile.js';
import { GbsServiceListing } from '../models/gbs/GbsServiceListing.js';
import { GbsServiceRequest } from '../models/gbs/GbsServiceRequest.js';
import { GbsQuote } from '../models/gbs/GbsQuote.js';
import { GbsCase } from '../models/gbs/GbsCase.js';
import { GbsContextThread } from '../models/gbs/GbsContextThread.js';
import { GbsContextMessage } from '../models/gbs/GbsContextMessage.js';
import { getUserCapabilityService } from '../services/capability/userCapabilityRuntime.js';
import { Blog } from '../models/Blog.js';
import { CareerArticle } from '../models/CareerArticle.js';
import { Company } from '../models/Company.js';
import { Exam } from '../models/Exam.js';
import { Quiz } from '../models/Quiz.js';
import { ForeignStudy } from '../models/ForeignStudy.js';
import { Internship } from '../models/Internship.js';
import { IntlScholarship } from '../models/IntlScholarship.js';
import { Job } from '../models/Job.js';
import { Scholarship } from '../models/Scholarship.js';
import { Admission } from '../models/Admission.js';
import { Institution } from '../models/Institution.js';
import { University } from '../models/University.js';
import { Program } from '../models/education/Program.js';
import { CanonicalScholarship } from '../models/education/CanonicalScholarship.js';
import { CanonicalInstitution } from '../models/education/CanonicalInstitution.js';
import { Test } from '../models/education/Test.js';
import { VaultDocument } from '../models/vault/VaultDocument.js';
import { StudentCostPlan } from '../models/budget/StudentCostPlan.js';
import { TalentProfile } from '../models/career/TalentProfile.js';
import { Application } from '../models/Application.js';
import { OpportunityApplication } from '../models/career/OpportunityApplication.js';
import { FormDefinition } from '../models/FormDefinition.js';
import { InstitutionAdmissionApplication } from '../models/institution/InstitutionAdmissionApplication.js';
import { InstitutionClaim } from '../models/institution/InstitutionClaim.js';
import { OrganizationVerification } from '../models/OrganizationVerification.js';
import { CLAIM_STATES } from '../../../shared/institution/institutionPortal.js';
import { VERIFICATION_STATUSES } from '../../../shared/international/verification.js';

const uri = process.env.STRIDETO_QA_MONGO_URI || '';
const scope = process.argv.find((a) => a.startsWith('--run-scope='))?.split('=')[1] || 'smoke-1';
if (!/^[A-Za-z0-9_-]+$/.test(scope)) throw new Error('run scope must be alphanumeric');
if (!uri || !/\/strideto_(?:acceptance|qa)_[A-Za-z0-9_-]+(?:\?|$)/i.test(uri)) {
  throw new Error('Refusing bootstrap: STRIDETO_QA_MONGO_URI must name strideto_acceptance_* or strideto_qa_* database');
}
const namespace = `qa-final-acceptance-${scope}`;
const password = `${crypto.randomBytes(18).toString('base64url')}Aa9!`;
const email = (label) => `${namespace}-${label}@invalid.qa`;
const outDir = path.resolve('../../../qa-artifacts/real-auth', namespace);
fs.mkdirSync(outDir, { recursive: true });

async function user(label, role = 'User') {
  const e = email(label); let row = await User.findOne({ email: e }).select('+password');
  if (!row) row = new User({ name: `${namespace} ${label}`, email: e, password, role });
  Object.assign(row, { name: `${namespace} ${label}`, role, password, emailVerified: true, accountStatus: 'active', termsAcceptedAt: row.termsAcceptedAt || new Date(), privacyAcknowledgedAt: row.privacyAcknowledgedAt || new Date() });
  await row.save(); return { id: String(row._id), email: e, password };
}

async function account(Model, label, fields = {}) {
  const e = email(label); let row = await Model.findOne({ email: e }).select('+password');
  if (!row) row = new Model({ email: e, password, ...fields });
  Object.assign(row, { password, emailVerified: true, emailVerifiedAt: row.emailVerifiedAt || new Date(), accountStatus: 'active' });
  await row.save(); return { id: String(row._id), email: e, password };
}

async function makeEducationProvider(label, type, accountId) {
  const now = new Date();
  const org = await Organization.findOneAndUpdate(
    { slug: `${namespace}-${label}` },
    { $set: { organizationType: type === 'agency' ? 'agency' : 'agent', displayName: `${namespace} ${label}`, legalName: `${namespace} ${label}`, countryCode: 'PK', status: 'active' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  const profile = await AgentProfile.findOneAndUpdate(
    { agentAccountId: accountId },
    { $set: { organizationId: org._id, agentType: type, professionalName: `${namespace} ${label}`, slug: `${namespace}-${label}`, profileStatus: 'approved', countryCode: 'PK', serviceCountries: ['PK'], destinationCountries: ['US', 'CA'] } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  const membership = await AgentMembership.findOneAndUpdate(
    { organizationId: org._id, agentAccountId: accountId },
    { $set: { role: 'owner', active: true, joinedAt: now } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  const service = await AgentService.findOneAndUpdate(
    { slug: `${namespace}-${label}-service` },
    { $set: { organizationId: org._id, agentProfileId: profile._id, title: `${namespace} Education Guidance`, category: 'university_application_support', description: 'Disposable QA education service', pricingMode: 'fixed_price', price: { amountMinor: 15000, currency: 'USD' }, deliveryMode: 'online', destinationCountries: ['US'], status: 'active' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return { org, profile, membership, service, accountId };
}

async function consultationFor(owner, studentId, label) {
  const now = new Date();
  const consultation = await Consultation.findOneAndUpdate(
    { purpose: `${namespace}-${label}` },
    { $set: { studentUserId: studentId, organizationId: owner.org._id, assignedMembershipId: owner.membership._id, agentServiceId: owner.service._id, serviceSnapshot: { title: owner.service.title, category: owner.service.category, description: owner.service.description, price: owner.service.price, destinationCountries: owner.service.destinationCountries, source: 'engagement_snapshot' }, status: 'completed', requestedWindow: { start: now, end: new Date(now.getTime() + 3600000) }, durationMinutes: 60, timezone: 'UTC', meetingMode: 'video', purpose: `${namespace}-${label}`, paymentState: 'payment_not_configured', completion: { completedAt: now } } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  const professionalCase = await ProfessionalCase.findOneAndUpdate(
    { title: `${namespace}-${label}-case` },
    { $set: { studentUserId: studentId, organizationId: owner.org._id, assignedMembershipId: owner.membership._id, authorizedMembershipIds: [owner.membership._id], consultationId: consultation._id, caseType: 'study', workflowId: 'study_v1', workflowVersion: 1, lifecycle: 'active', currentStage: 'active', title: `${namespace}-${label}-case`, openedAt: now } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return { consultationId: String(consultation._id), professionalCaseId: String(professionalCase._id), organizationId: String(owner.org._id), membershipId: String(owner.membership._id), serviceId: String(owner.service._id), accountId: owner.accountId };
}

async function educationGraph(accounts, users) {
  const independent = await makeEducationProvider('education-independent', 'agent', accounts['education-independent'].id);
  const agency = await makeEducationProvider('education-agency', 'agency', accounts['education-agency'].id);
  return {
    independent: await consultationFor(independent, users.student.id, 'education-independent'),
    agency: await consultationFor(agency, users.student.id, 'education-agency'),
    independentProvider: independent,
    agencyProvider: agency,
  };
}

async function educationNegativeTargets(accounts, users) {
  const indB = await makeEducationProvider('education-independent-b', 'agent', accounts['education-independent-b'].id);
  const agencyB = await makeEducationProvider('education-agency-b', 'agency', accounts['education-agency-b'].id);
  const now = new Date();
  const caseB = await ProfessionalCase.findOneAndUpdate(
    { title: `${namespace}-education-independent-b-negative-case` },
    { $set: { studentUserId: users['student-b'].id, organizationId: indB.org._id, assignedMembershipId: indB.membership._id, authorizedMembershipIds: [indB.membership._id], caseType: 'study', workflowId: 'study_v1', workflowVersion: 1, lifecycle: 'active', currentStage: 'active', title: `${namespace}-education-independent-b-negative-case`, openedAt: now } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  const agencyBCase = await ProfessionalCase.findOneAndUpdate(
    { title: `${namespace}-education-agency-b-negative-case` },
    { $set: { studentUserId: users['student-b'].id, organizationId: agencyB.org._id, assignedMembershipId: agencyB.membership._id, authorizedMembershipIds: [agencyB.membership._id], caseType: 'study', workflowId: 'study_v1', workflowVersion: 1, lifecycle: 'active', currentStage: 'active', title: `${namespace}-education-agency-b-negative-case`, openedAt: now } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return {
    independent: { organizationId: String(indB.org._id), membershipId: String(indB.membership._id), professionalCaseId: String(caseB._id) },
    agency: { organizationId: String(agencyB.org._id), membershipId: String(agencyB.membership._id), professionalCaseId: String(agencyBCase._id) },
  };
}

async function studentCaseApplication(education, studentId) {
  const pcId = new mongoose.Types.ObjectId(education.independent.professionalCaseId);
  const application = await ProfessionalCaseApplication.findOneAndUpdate(
    { caseId: pcId, creationCommandId: `${namespace}-student-app-1` },
    { $set: { caseId: pcId, creationCommandId: `${namespace}-student-app-1`, institutionSnapshot: { officialName: `${namespace} University`, countryCode: 'US', city: 'New York' }, programSnapshot: { name: 'Computer Science', degreeLevel: 'Bachelor', campus: 'Main' }, intakeSnapshot: { cycleLabel: 'Fall 2026', startDate: '2026-09-01', deadlineDate: '2026-03-01' }, destinationCountry: 'US', status: 'preparing', deadlineAt: new Date('2026-03-01') } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return String(application._id);
}

async function educationAttentionGraph(education, studentId) {
  const { independentProvider } = education;
  const now = new Date();
  let urgentCaseId = null;
  for (let i = 1; i <= 55; i++) {
    const title = `${namespace}-attention-case-${String(i).padStart(3, '0')}`;
    const c = await ProfessionalCase.findOneAndUpdate(
      { title },
      { $set: { studentUserId: studentId, organizationId: independentProvider.org._id, assignedMembershipId: independentProvider.membership._id, authorizedMembershipIds: [independentProvider.membership._id], caseType: 'study', workflowId: 'study_v1', workflowVersion: 1, lifecycle: 'active', currentStage: 'active', title, openedAt: new Date(now.getTime() - (55 - i) * 86400000) } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    if (i === 1) urgentCaseId = c._id;
  }
  const urgentTask = await CaseTask.findOneAndUpdate(
    { caseId: urgentCaseId, title: `${namespace}-urgent-agent-task` },
    { $set: { caseId: urgentCaseId, title: `${namespace}-urgent-agent-task`, responsibleActor: 'agent', responsibleMembershipId: independentProvider.membership._id, dueAt: new Date(now.getTime() - 86400000), status: 'pending', source: 'agent' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return { totalAttentionCases: 55, urgentCaseId: String(urgentCaseId), urgentTaskId: String(urgentTask._id) };
}

async function makeBusinessProvider(label, agentAccountId) {
  const subjectId = agentAccountId;
  const type = label.includes('agency') ? 'agency' : 'agent';
  const now = new Date();
  const org = await Organization.findOneAndUpdate(
    { slug: `${namespace}-${label}` },
    { $set: { organizationType: type, displayName: `${namespace} ${label}`, legalName: `${namespace} ${label}`, countryCode: 'PK', status: 'active' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  await AgentProfile.findOneAndUpdate(
    { agentAccountId },
    { $set: { organizationId: org._id, agentType: type, professionalName: `${namespace} ${label}`, slug: `${namespace}-${label}`, profileStatus: 'approved', countryCode: 'PK', serviceCountries: ['PK'], destinationCountries: ['US', 'CA'] } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  // AgentMembership is required by trust, commerce, and usage-billing endpoints.
  // organizationId must match AgentProfile.organizationId for resolveAgentScope() to pass.
  await AgentMembership.findOneAndUpdate(
    { organizationId: org._id, agentAccountId },
    { $set: { role: 'owner', active: true, joinedAt: now } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  await ProviderDomainEnrollment.findOneAndUpdate(
    { subjectType: 'agent', subjectId, domainId: 'business_services' },
    { $set: { subjectType: 'agent', subjectId, domainId: 'business_services', status: 'active', onboardingStatus: 'complete', selectedBy: namespace } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  const capability = await ProviderCapability.findOneAndUpdate(
    { subjectType: 'agent', subjectId, capabilityId: 'business_formation' },
    { $set: { subjectType: 'agent', subjectId, capabilityId: 'business_formation', status: 'active', trustStatus: 'evidence_submitted' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  await GbsProviderProfessionalProfile.findOneAndUpdate(
    { subjectType: 'agent', subjectId },
    { $set: { subjectType: 'agent', subjectId, displayName: `${namespace} ${label}`, publicEmail: email(label), serviceCountries: ['US'], languages: ['en'], professionalSummary: `Disposable QA business provider for ${label}` } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  const listing = await GbsServiceListing.findOneAndUpdate(
    { subjectType: 'agent', subjectId, capabilityId: 'business_formation', jurisdictionId: 'us.de' },
    { $set: { subjectType: 'agent', subjectId, capabilityId: 'business_formation', countryCode: 'US', jurisdictionId: 'us.de', title: `${namespace} ${label} Business Formation`, shortDescription: 'Disposable QA listing', pricingMode: 'quote_required', moderationStatus: 'draft', publicationStatus: 'private', adminReviewStatus: 'pending' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return { subjectId, listing, org, providerCapabilityId: String(capability._id) };
}

async function buildBusinessClientGraph(clientLabel, clientUserId, providerSubjectId, listing, suffix) {
  const now = new Date();
  const requestRef = `GBSR-${namespace}-${suffix}`;
  const quoteRef = `GBSQ-${namespace}-${suffix}`;
  const caseRef = `GBSC-${namespace}-${suffix}`;
  const reqCmdId = `${namespace}-req-cmd-${suffix}`;
  const qtCmdId = `${namespace}-qt-cmd-${suffix}`;
  const caseCmdId = `${namespace}-case-cmd-${suffix}`;

  const request = await GbsServiceRequest.findOneAndUpdate(
    { publicRequestRef: requestRef },
    { $set: { publicRequestRef: requestRef, creationCommandId: reqCmdId, requesterUserId: clientUserId, listingId: listing._id, listingSlugSnapshot: listing.publicSlug || `${namespace}-listing-${suffix}`, intakeChannel: 'private_beta', providerSubjectType: 'agent', providerSubjectId, capabilityId: listing.capabilityId, countryCode: listing.countryCode, jurisdictionId: listing.jurisdictionId, titleSnapshot: listing.title, providerDisplayNameSnapshot: `${namespace} business-${suffix}`, actingFor: 'self', customerSummary: `QA disposable business request ${suffix}`, status: 'ready_for_quote' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const quote = await GbsQuote.findOneAndUpdate(
    { publicQuoteRef: quoteRef },
    { $set: { publicQuoteRef: quoteRef, creationCommandId: qtCmdId, serviceRequestId: request._id, requestPublicRefSnapshot: requestRef, requesterUserId: clientUserId, providerSubjectType: 'agent', providerSubjectId, listingId: listing._id, capabilityId: listing.capabilityId, jurisdictionId: listing.jurisdictionId, countryCode: listing.countryCode, quoteRevision: 1, status: 'accepted', currency: 'USD', professionalFeeLines: [{ label: 'Business Formation Service', amountMinor: 50000, currency: 'USD', ownership: 'provider', category: 'provider_service' }], subtotalProfessionalMinor: 50000, totalCustomerAmountMinor: 50000, titleSnapshot: listing.title, actingForSnapshot: 'self', customerSummarySnapshot: `QA disposable business request ${suffix}`, sentAt: now, acceptedAt: now, listingPricingModeSnapshot: 'quote_required' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const caseRecord = await GbsCase.findOneAndUpdate(
    { publicCaseRef: caseRef },
    { $set: { publicCaseRef: caseRef, creationCommandId: caseCmdId, quoteId: quote._id, serviceRequestId: request._id, publicQuoteRefSnapshot: quoteRef, requestPublicRefSnapshot: requestRef, requesterUserId: clientUserId, providerSubjectType: 'agent', providerSubjectId, listingId: listing._id, capabilityId: listing.capabilityId, jurisdictionId: listing.jurisdictionId, countryCode: listing.countryCode, workflowTemplateKey: 'generic_professional_service', status: suffix === 'a' ? 'awaiting_client' : 'open', currentMilestoneKey: suffix === 'a' ? 'awaiting_customer_action' : 'case_opened', titleSnapshot: listing.title, actingForSnapshot: 'self', customerSummarySnapshot: `QA disposable business request ${suffix}`, openedAt: now, timelineEvents: [{ eventType: 'case_opened', actorType: 'system', at: now }] } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const thread = await GbsContextThread.findOneAndUpdate(
    { contextType: 'case', contextId: caseRecord._id },
    { $set: { contextType: 'case', contextId: caseRecord._id, contextPublicRef: caseRef, requesterUserId: clientUserId, providerSubjectType: 'agent', providerSubjectId, titleSnapshot: listing.title, lastMessageAt: now } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  const threadExists = await GbsContextMessage.findOne({ threadId: thread._id });
  if (!threadExists) {
    await GbsContextMessage.create({ threadId: thread._id, senderActorType: 'business_client', senderActorId: String(clientUserId), text: `QA disposable opening message for ${caseRef}` });
  }

  return { requestId: String(request._id), requestPublicRef: requestRef, quoteId: String(quote._id), quotePublicRef: quoteRef, caseId: String(caseRecord._id), casePublicRef: caseRef };
}

async function businessAttentionPaginationGraph(clientUserId, providerSubjectId, listing, baseCount = 12) {
  const now = new Date();
  const ids = [];
  for (let i = 1; i <= baseCount; i++) {
    const ref = `GBSR-${namespace}-PAG-${String(i).padStart(3, '0')}`;
    const cmdId = `${namespace}-pag-req-${String(i).padStart(3, '0')}`;
    const req = await GbsServiceRequest.findOneAndUpdate(
      { publicRequestRef: ref },
      { $set: { publicRequestRef: ref, creationCommandId: cmdId, requesterUserId: clientUserId, listingId: listing._id, listingSlugSnapshot: listing.publicSlug || `${namespace}-listing-pag`, intakeChannel: 'private_beta', providerSubjectType: 'agent', providerSubjectId, capabilityId: listing.capabilityId, countryCode: listing.countryCode, jurisdictionId: listing.jurisdictionId, titleSnapshot: listing.title, providerDisplayNameSnapshot: `${namespace} business-pag`, actingFor: 'self', customerSummary: `QA pagination request ${i}`, status: 'submitted' } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    ids.push(String(req._id));
  }
  return { paginationRequestIds: ids, count: baseCount };
}

async function institutionGraph(accounts) {
  const org = await Organization.findOneAndUpdate(
    { slug: `${namespace}-institution-org` },
    { $set: { organizationType: 'university', displayName: `${namespace} Institution`, legalName: `${namespace} Institution University`, countryCode: 'US', status: 'active' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  const membership = await InstitutionMembership.findOneAndUpdate(
    { organizationId: org._id, institutionAccountId: accounts.institution.id },
    { $set: { organizationId: org._id, institutionAccountId: accounts.institution.id, role: 'owner', active: true } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return { organizationId: String(org._id), membershipId: String(membership._id) };
}

async function adminGraph(education) {
  const { independentProvider, agencyProvider } = education;
  const slug = `${namespace}-admin-marketplace-target`;
  const post = await AgentMarketplacePost.findOneAndUpdate(
    { slug },
    { $set: { organizationId: independentProvider.org._id, authorAgentAccountId: independentProvider.accountId, postType: 'service_announcement', title: `${namespace} Admin Review Target`, slug, summary: 'Disposable QA marketplace post pending admin review', agentStatement: 'This is a disposable QA marketplace post created for admin moderation testing. It contains no production information.', targetCountries: ['PK'], destinationCountries: ['US'], publicationStatus: 'submitted', moderationStatus: 'pending' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  // Agency-owned marketplace post required so education-agency can reach /agent/education/marketplace/:id/edit.
  const agencySlug = `${namespace}-agency-marketplace-target`;
  const agencyPost = await AgentMarketplacePost.findOneAndUpdate(
    { slug: agencySlug },
    { $set: { organizationId: agencyProvider.org._id, authorAgentAccountId: agencyProvider.accountId, postType: 'service_announcement', title: `${namespace} Agency Marketplace Target`, slug: agencySlug, summary: 'Disposable QA agency marketplace post', agentStatement: 'This is a disposable QA marketplace post created for agency edit testing. It contains no production information.', targetCountries: ['PK'], destinationCountries: ['US'], publicationStatus: 'draft', moderationStatus: 'pending' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return { pendingPostId: String(post._id), slug, agencyPostId: String(agencyPost._id), agencySlug };
}

async function publicGraph(education) {
  const { independentProvider } = education;
  const publishedSlug = `${namespace}-public-education-service`;
  const publicService = await AgentService.findOneAndUpdate(
    { slug: publishedSlug },
    { $set: { organizationId: independentProvider.org._id, agentProfileId: independentProvider.profile._id, title: `${namespace} Public Education Service`, category: 'university_application_support', description: 'Disposable QA public education service for marketplace visibility testing', pricingMode: 'fixed_price', price: { amountMinor: 12000, currency: 'USD' }, deliveryMode: 'online', destinationCountries: ['US', 'CA', 'UK'], status: 'active' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return { publicServiceId: String(publicService._id), organizationId: String(independentProvider.org._id), profileId: String(independentProvider.profile._id) };
}

async function publicContentGraph(education) {
  const { independentProvider } = education;
  const now = new Date();

  const blog = await Blog.findOneAndUpdate(
    { slug: `${namespace}-blog` },
    { $set: { title: `${namespace} Blog Post`, slug: `${namespace}-blog`, status: 'published', publishedAt: now, excerpt: 'Disposable QA blog post.' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const approvedMarketplacePost = await AgentMarketplacePost.findOneAndUpdate(
    { slug: `${namespace}-approved-marketplace-post` },
    { $set: { organizationId: independentProvider.org._id, authorAgentAccountId: independentProvider.accountId, postType: 'service_announcement', title: `${namespace} Approved Marketplace Post`, slug: `${namespace}-approved-marketplace-post`, summary: 'Disposable QA approved marketplace post for public anonymous route', agentStatement: 'Disposable QA approved post. No production data.', targetCountries: ['PK'], destinationCountries: ['US'], publicationStatus: 'published', moderationStatus: 'approved', launchEligible: true } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  // OrganizationVerification required by agentMarketplaceService.getPublicPost visibility gate.
  await OrganizationVerification.findOneAndUpdate(
    { organizationId: independentProvider.org._id },
    { $set: { organizationId: independentProvider.org._id, organizationType: 'agent', countryCode: 'PK', status: VERIFICATION_STATUSES.APPROVED, verifiedAt: now } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const careerArticle = await CareerArticle.findOneAndUpdate(
    { slug: `${namespace}-career-article` },
    { $set: { title: `${namespace} Career Article`, slug: `${namespace}-career-article`, status: 'published', publishedAt: now, excerpt: 'Disposable QA career article.' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const company = await Company.findOneAndUpdate(
    { slug: `${namespace}-company` },
    { $set: { name: `${namespace} Company`, slug: `${namespace}-company`, status: 'active' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const exam = await Exam.findOneAndUpdate(
    { slug: `${namespace}-exam` },
    { $set: { name: `${namespace} Exam`, slug: `${namespace}-exam`, status: 'active' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const quiz = await Quiz.findOneAndUpdate(
    { examId: exam._id, title: `${namespace} Quiz` },
    { $set: { examId: exam._id, title: `${namespace} Quiz`, status: 'active' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const foreignStudy = await ForeignStudy.findOneAndUpdate(
    { slug: `${namespace}-foreign-study` },
    { $set: { country: 'USA', program: 'QA Test Program', slug: `${namespace}-foreign-study`, status: 'active' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const internship = await Internship.findOneAndUpdate(
    { slug: `${namespace}-internship` },
    { $set: { title: `${namespace} Internship`, slug: `${namespace}-internship`, organization: `${namespace} Company`, status: 'active' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const intlScholarship = await IntlScholarship.findOneAndUpdate(
    { title: `${namespace} Intl Scholarship` },
    { $set: { title: `${namespace} Intl Scholarship`, country: 'US', status: 'active' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const publicJob = await Job.findOneAndUpdate(
    { slug: `${namespace}-public-job` },
    { $set: { title: `${namespace} Public Job`, slug: `${namespace}-public-job`, company: `${namespace} Company`, status: 'active', publicationState: 'active', source: 'manual', launchEligible: true } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const canonicalInstitution = await CanonicalInstitution.findOneAndUpdate(
    { slug: `${namespace}-canonical-institution` },
    { $set: { officialName: `${namespace} Canonical Institution`, slug: `${namespace}-canonical-institution`, countryCode: 'US', institutionType: 'university', status: 'active' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const canonicalProgram = await Program.findOneAndUpdate(
    { slug: `${namespace}-canonical-program` },
    { $set: { name: `${namespace} Canonical Program`, slug: `${namespace}-canonical-program`, institutionId: canonicalInstitution._id, degreeLevel: 'bachelor', field: 'computer_science', studyMode: 'on_campus', country: 'US', status: 'published', launchEligible: true } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const canonicalScholarship = await CanonicalScholarship.findOneAndUpdate(
    { slug: `${namespace}-canonical-scholarship` },
    { $set: { slug: `${namespace}-canonical-scholarship`, title: `${namespace} Canonical Scholarship`, destinationCountries: ['US'], status: 'published' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const scholarship = await Scholarship.findOneAndUpdate(
    { slug: `${namespace}-scholarship` },
    { $set: { title: `${namespace} Scholarship`, slug: `${namespace}-scholarship`, provider: `${namespace} Foundation`, status: 'active', launchEligible: true } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const institution = await Institution.findOneAndUpdate(
    { slug: `${namespace}-institution` },
    { $set: { name: `${namespace} Institution`, slug: `${namespace}-institution`, type: 'university', status: 'active' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const educationTest = await Test.findOneAndUpdate(
    { slug: `${namespace}-education-test` },
    { $set: { name: `${namespace} Education Test`, slug: `${namespace}-education-test`, category: 'english_proficiency', status: 'published' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const university = await University.findOneAndUpdate(
    { slug: `${namespace}-university` },
    { $set: { name: `${namespace} University`, slug: `${namespace}-university`, country: 'US', status: 'active' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const admission = await Admission.findOneAndUpdate(
    { slug: `${namespace}-admission` },
    { $set: { program: `${namespace} CS Program`, institution: `${namespace} University`, slug: `${namespace}-admission`, status: 'active', launchEligible: true } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return {
    blogSlug: blog.slug,
    agentProfileSlug: `${namespace}-education-independent`,
    approvedMarketplacePostSlug: approvedMarketplacePost.slug,
    careerArticleSlug: careerArticle.slug,
    companySlug: company.slug,
    examSlug: exam.slug,
    quizId: String(quiz._id),
    foreignStudySlug: foreignStudy.slug,
    internshipSlug: internship.slug,
    intlScholarshipId: String(intlScholarship._id),
    publicJobSlug: publicJob.slug,
    canonicalProgramSlug: canonicalProgram.slug,
    canonicalScholarshipSlug: canonicalScholarship.slug,
    canonicalInstitutionId: String(canonicalInstitution._id),
    scholarshipSlug: scholarship.slug,
    institutionSlug: institution.slug,
    educationTestSlug: educationTest.slug,
    universitySlug: university.slug,
    admissionSlug: admission.slug,
  };
}

async function portalFixtureGraph(accounts, users, education, institutionData) {
  if (!accounts.institution?.id) throw new Error('QA institution account required to seed approved claim');
  const { independentProvider } = education;
  const now = new Date();
  const institutionOrgId = new mongoose.Types.ObjectId(institutionData.organizationId);
  const studentObjId = new mongoose.Types.ObjectId(users.student.id);

  const vaultDoc = await VaultDocument.findOneAndUpdate(
    { ownerUserId: studentObjId, displayName: `${namespace} QA Transcript` },
    { $set: { ownerUserId: studentObjId, documentType: 'transcript', displayName: `${namespace} QA Transcript`, status: 'active' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const costPlan = await StudentCostPlan.findOneAndUpdate(
    { ownerUserId: studentObjId, title: `${namespace} QA Cost Plan` },
    { $set: { ownerUserId: studentObjId, title: `${namespace} QA Cost Plan`, journeyType: 'study', status: 'active', history: [{ eventType: 'plan_created', description: 'QA bootstrap', at: now }] } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // CanonicalInstitution linked to the institution org (needed for Program → InstitutionAdmissionApplication)
  const institutionCanonical = await CanonicalInstitution.findOneAndUpdate(
    { organizationId: institutionOrgId },
    { $set: { officialName: `${namespace} Institution Portal`, slug: `${namespace}-portal-institution`, countryCode: 'US', institutionType: 'university', organizationId: institutionOrgId, status: 'active' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const institutionProgram = await Program.findOneAndUpdate(
    { slug: `${namespace}-institution-program` },
    { $set: { name: `${namespace} Institution Program`, slug: `${namespace}-institution-program`, institutionId: institutionCanonical._id, degreeLevel: 'bachelor', field: 'computer_science', studyMode: 'on_campus', country: 'US', status: 'draft' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Production getProgram/updateProgram require an approved CanonicalInstitution claim
  // plus approved organization verification. Seed the same relationship the portal enforces.
  const representativeAccountId = new mongoose.Types.ObjectId(String(accounts.institution.id));
  await OrganizationVerification.findOneAndUpdate(
    { organizationId: institutionOrgId },
    { $set: { organizationId: institutionOrgId, organizationType: 'university', countryCode: 'US', status: VERIFICATION_STATUSES.APPROVED, verifiedAt: now } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  await InstitutionClaim.findOneAndUpdate(
    { organizationId: institutionOrgId },
    { $set: {
      organizationId: institutionOrgId,
      canonicalInstitutionId: institutionCanonical._id,
      representativeAccountId,
      state: CLAIM_STATES.APPROVED,
      submittedAt: now,
      reviewedAt: now,
      approvedAt: now,
      countryCode: 'US',
      normalizedName: `${namespace} institution portal`,
      history: [{ fromState: '', toState: CLAIM_STATES.APPROVED, changedByRealm: 'admin', reason: 'QA disposable approved claim', at: now }],
    } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // CanonicalScholarship for student personalization eligibility test (looked up by _id)
  const personalizationScholarship = await CanonicalScholarship.findOneAndUpdate(
    { slug: `${namespace}-personalization-scholarship` },
    { $set: { slug: `${namespace}-personalization-scholarship`, title: `${namespace} Personalization Scholarship`, destinationCountries: ['US'], status: 'active' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Canonical Program for student personalization eligibility test (looked up by _id)
  const personalizationCanonicalInstitution = await CanonicalInstitution.findOneAndUpdate(
    { slug: `${namespace}-personalization-institution` },
    { $set: { officialName: `${namespace} Personalization Institution`, slug: `${namespace}-personalization-institution`, countryCode: 'US', institutionType: 'university', status: 'active' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  const personalizationProgram = await Program.findOneAndUpdate(
    { slug: `${namespace}-personalization-program` },
    { $set: { name: `${namespace} Personalization Program`, slug: `${namespace}-personalization-program`, institutionId: personalizationCanonicalInstitution._id, degreeLevel: 'bachelor', field: 'computer_science', studyMode: 'on_campus', country: 'US', status: 'published' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const institutionApp = await InstitutionAdmissionApplication.findOneAndUpdate(
    { organizationId: institutionOrgId, programId: institutionProgram._id, studentUserId: studentObjId, intakeCycleLabel: 'fall-2026' },
    { $set: { organizationId: institutionOrgId, programId: institutionProgram._id, studentUserId: studentObjId, intakeCycleLabel: 'fall-2026', status: 'received', consentedAt: now, snapshot: { displayName: `${namespace} Student`, email: users.student.email } } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const formDef = await FormDefinition.findOneAndUpdate(
    { slug: `${namespace}-form` },
    { $set: { name: `${namespace} QA Form`, slug: `${namespace}-form`, status: 'published', fields: [{ id: 'name', type: 'text', name: 'Full Name', required: true }] } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const employerObjId = new mongoose.Types.ObjectId(accounts.employer.id);
  const employerJob = await Job.findOneAndUpdate(
    { slug: `${namespace}-employer-job` },
    { $set: { title: `${namespace} Employer Job`, slug: `${namespace}-employer-job`, company: `${namespace} Company`, employerId: employerObjId, status: 'active', publicationState: 'active', source: 'employer' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Update the employer account to have a public slug for the anonymous employer profile route
  await Employer.findByIdAndUpdate(employerObjId, { $set: { slug: `${namespace}-employer` } });

  // TalentProfile + legacy Application for employer intelligence route.
  // The employer intelligence service (EmployerIntelligenceService.getOwnedLegacyApplication)
  // queries the Application model, not OpportunityApplication.
  const talentProfile = await TalentProfile.findOneAndUpdate(
    { userId: studentObjId },
    { $set: { userId: studentObjId, status: 'draft' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const legacyApp = await Application.findOneAndUpdate(
    { userId: studentObjId, jobId: employerJob._id },
    { $set: { userId: studentObjId, jobId: employerJob._id, talentProfileId: talentProfile._id, status: 'applied' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // OpportunityApplication for student:/applications/:param route.
  const opportunityApp = await OpportunityApplication.findOneAndUpdate(
    { userId: studentObjId, talentProfileId: talentProfile._id, 'opportunityRef.opportunityType': 'job', 'opportunityRef.opportunityId': employerJob._id },
    { $set: { userId: studentObjId, talentProfileId: talentProfile._id, opportunityRef: { opportunityType: 'job', opportunityId: employerJob._id }, pipelineStage: 'applied', stageTemplateId: 'job_default', status: 'active', title: `${namespace} QA Job Application`, companyName: `${namespace} Company`, legacyApplicationId: legacyApp._id } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return {
    vaultDocumentId: String(vaultDoc._id),
    costPlanId: String(costPlan._id),
    institutionProgramId: String(institutionProgram._id),
    institutionAdmissionApplicationId: String(institutionApp._id),
    formDefinitionId: String(formDef._id),
    employerJobId: String(employerJob._id),
    opportunityApplicationId: String(legacyApp._id),
    studentOpportunityApplicationId: String(opportunityApp._id),
    personalizationProgramId: String(personalizationProgram._id),
    personalizationScholarshipId: String(personalizationScholarship._id),
  };
}

async function main() {
  await mongoose.connect(uri, { autoIndex: false });
  const studentUser = await user('student');
  const studentBUser = await user('student-b');
  const businessClientUser = await user('business-client');
  const businessClientBUser = await user('business-client-b');
  const adminUser = await user('admin', 'SuperAdmin');

  const caps = getUserCapabilityService();
  await caps.initializeCustomerUser(await User.findById(studentUser.id), { grantedBy: namespace, grantReason: 'qa_bootstrap' });
  await caps.initializeCustomerUser(await User.findById(studentBUser.id), { grantedBy: namespace, grantReason: 'qa_bootstrap' });
  for (const id of [businessClientUser.id, businessClientBUser.id]) {
    await caps.initializeCustomerUser(await User.findById(id), { grantedBy: namespace, grantReason: 'qa_bootstrap' });
    await caps.grantCapability({ userId: id, capability: 'business_client', grantedBy: namespace, grantReason: 'qa_bootstrap' });
  }
  await caps.initializeStaffUser(await User.findById(adminUser.id), { grantedBy: namespace, grantReason: 'qa_bootstrap' });

  const educationIndAccount = await account(AgentAccount, 'education-independent');
  const educationAgAccount = await account(AgentAccount, 'education-agency');
  const educationIndBAccount = await account(AgentAccount, 'education-independent-b');
  const educationAgBAccount = await account(AgentAccount, 'education-agency-b');
  const businessIndAccount = await account(AgentAccount, 'business-independent');
  const businessAgAccount = await account(AgentAccount, 'business-agency');
  const employerAccount = await account(Employer, 'employer', { companyName: `${namespace} employer` });
  const institutionAcct = await account(InstitutionAccount, 'institution');

  const accountsMap = {
    'education-independent': educationIndAccount,
    'education-agency': educationAgAccount,
    'education-independent-b': educationIndBAccount,
    'education-agency-b': educationAgBAccount,
    'business-independent': businessIndAccount,
    'business-agency': businessAgAccount,
  };
  const usersMap = { student: studentUser, 'student-b': studentBUser };

  const education = await educationGraph(accountsMap, usersMap);
  const educationB = await educationNegativeTargets(accountsMap, usersMap);
  const studentAppId = await studentCaseApplication(education, studentUser.id);
  const attentionData = await educationAttentionGraph(education, studentUser.id);
  const institutionData = await institutionGraph({ institution: institutionAcct });
  const adminData = await adminGraph(education);
  const publicData = await publicGraph(education);
  const publicContentData = await publicContentGraph(education);
  const portalFixtures = await portalFixtureGraph({ employer: employerAccount, institution: institutionAcct }, usersMap, education, institutionData);

  const { subjectId: bisIndSubjectId, listing: bisIndListing, providerCapabilityId: bisIndCapabilityId } = await makeBusinessProvider('business-independent', businessIndAccount.id);
  const { subjectId: bisAgSubjectId, listing: bisAgListing, providerCapabilityId: bisAgCapabilityId } = await makeBusinessProvider('business-agency', businessAgAccount.id);

  const businessClientA = await buildBusinessClientGraph('business-client', studentUser.id === businessClientUser.id ? businessClientUser.id : businessClientUser.id, bisIndSubjectId, bisIndListing, 'a');
  const businessClientB = await buildBusinessClientGraph('business-client-b', businessClientBUser.id, bisAgSubjectId, bisAgListing, 'b');
  const paginationData = await businessAttentionPaginationGraph(businessClientUser.id, bisIndSubjectId, bisIndListing);

  const credentials = {
    student: studentUser,
    'student-b': studentBUser,
    'business-client': businessClientUser,
    'business-client-b': businessClientBUser,
    admin: adminUser,
    'education-independent': educationIndAccount,
    'education-agency': educationAgAccount,
    'education-independent-b': educationIndBAccount,
    'education-agency-b': educationAgBAccount,
    'business-independent': businessIndAccount,
    'business-agency': businessAgAccount,
    employer: employerAccount,
    institution: institutionAcct,
  };

  const resolver = {
    namespace,
    education: {
      independent: { ...education.independent },
      agency: { ...education.agency },
    },
    educationNegative: {
      independent: { ...educationB.independent },
      agency: { ...educationB.agency },
    },
    studentCase: {
      studentId: studentUser.id,
      primaryCaseId: education.independent.professionalCaseId,
      applicationId: portalFixtures.studentOpportunityApplicationId,
    },
    studentB: {
      userId: studentBUser.id,
      negativeTargetCaseId: educationB.independent.professionalCaseId,
    },
    business: {
      independent: { subjectId: bisIndSubjectId, listingId: String(bisIndListing._id), providerCapabilityId: bisIndCapabilityId },
      agency: { subjectId: bisAgSubjectId, listingId: String(bisAgListing._id), providerCapabilityId: bisAgCapabilityId },
    },
    businessClient: {
      a: { ...businessClientA, userId: businessClientUser.id },
      b: { ...businessClientB, userId: businessClientBUser.id },
    },
    institution: institutionData,
    admin: adminData,
    public: publicData,
    publicContent: publicContentData,
    portalFixtures,
    attention: attentionData,
    pagination: paginationData,
  };

  const ninePersonaCredentials = {
    student: studentUser,
    'education-independent': educationIndAccount,
    'education-agency': educationAgAccount,
    'business-independent': businessIndAccount,
    'business-agency': businessAgAccount,
    'business-client': businessClientUser,
    employer: employerAccount,
    institution: institutionAcct,
    admin: adminUser,
  };

  fs.writeFileSync(path.join(outDir, 'credentials.json'), `${JSON.stringify({ namespace, credentials }, null, 2)}\n`, { mode: 0o600 });
  fs.writeFileSync(path.join(outDir, 'resolver.json'), `${JSON.stringify({ namespace, ...resolver }, null, 2)}\n`, { mode: 0o600 });
  fs.writeFileSync(
    path.join(outDir, 'session-env.txt'),
    `${Object.entries(ninePersonaCredentials).map(([p, v]) => `STRIDETO_QA_${p.toUpperCase().replaceAll('-', '_')}=${JSON.stringify({ email: v.email, password: v.password })}`).join('\n')}\n`,
    { mode: 0o600 }
  );

  console.log(JSON.stringify({
    namespace,
    output: outDir,
    ninePersonas: Object.keys(ninePersonaCredentials),
    totalCredentials: Object.keys(credentials).length,
    credentials: 'GENERATED_LOCAL_QA',
    domainGraph: 'complete: education+negative+business+institution+admin+public+publicContent+portalFixtures+attention+pagination',
    resolver: 'resolver.json',
    attentionCases: attentionData.totalAttentionCases,
    businessClientA: businessClientA.casePublicRef,
    businessClientB: businessClientB.casePublicRef,
    paginationRequests: paginationData.count,
  }));
}

main().catch((e) => { console.error(e.message); process.exitCode = 1; }).finally(async () => { if (mongoose.connection.readyState) await mongoose.disconnect(); });
