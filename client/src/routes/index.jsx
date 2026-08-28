import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout, MainLayoutWrapper } from '../layouts/MainLayout';
import { withAuthLayout } from '../layouts/AuthLayout';
import { LocaleMainLayout } from '../layouts/LocaleMainLayout';
import { DEFAULT_LOCALE, ENABLED_CONTENT_LOCALES } from '@shared/localization/localeConfig.js';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { ProtectedEmployerRoute } from '../components/employer/ProtectedEmployerRoute';
import { ProtectedAgentRoute } from '../components/agent/ProtectedAgentRoute';
import { ProtectedInstitutionRoute } from '../components/institution/ProtectedInstitutionRoute';
import { RouteErrorBoundary } from '../components/common/RouteErrorBoundary';
import { AdminRouteGuard } from '../components/admin/AdminRouteGuard';
import { PERMISSIONS } from '../config/rbac';
import { ROUTES } from '../constants';
import VerifyEmail from '../pages/Auth/VerifyEmail';
import {
  LegacyAgentRedirect,
  LegacyEducationParamRedirect,
  LegacySharedAgentRedirect,
} from '../components/agent/LegacyAgentRedirect';

const Home = lazyLoad(() => import('../pages/Home/Home'));
const SearchResults = lazyLoad(() => import('../pages/Search/SearchResults'));
const Jobs = lazyLoad(() => import('../pages/Jobs/Jobs'));
const JobDetail = lazyLoad(() => import('../pages/Jobs/JobDetail'));
const Scholarships = lazyLoad(() => import('../pages/Scholarships/Scholarships'));
const ScholarshipDetail = lazyLoad(() => import('../pages/Scholarships/ScholarshipDetail'));
const Admissions = lazyLoad(() => import('../pages/Admissions/Admissions'));
const AdmissionDetail = lazyLoad(() => import('../pages/Admissions/AdmissionDetail'));
const SchoolsAndColleges = lazyLoad(() => import('../pages/SchoolsAndColleges/SchoolsAndColleges'));
const ForeignStudies = lazyLoad(() => import('../pages/ForeignStudies/ForeignStudies'));
const ForeignStudyDetail = lazyLoad(() => import('../pages/ForeignStudies/ForeignStudyDetail'));
const InstitutionDetail = lazyLoad(() => import('../pages/SchoolsAndColleges/InstitutionDetail'));
const NotificationsPage = lazyLoad(() => import('../pages/Notifications/NotificationsPage'));
const AnnouncementsPage = lazyLoad(() => import('../pages/Announcements/AnnouncementsPage'));
const Blog = lazyLoad(() => import('../pages/Blog/Blog'));
const BlogPost = lazyLoad(() => import('../pages/Blog/BlogPost'));
const Contact = lazyLoad(() => import('../pages/Contact/Contact'));
const Login = lazyLoad(() => import('../pages/Auth/Login'));
const Register = lazyLoad(() => import('../pages/Auth/Register'));
const ForgotPassword = lazyLoad(() => import('../pages/Auth/ForgotPassword'));
const ResetPassword = lazyLoad(() => import('../pages/Auth/ResetPassword'));
const AcceptInvitation = lazyLoad(() => import('../pages/Auth/AcceptInvitation'));
const Profile = lazyLoad(() => import('../pages/Profile/Profile'));
const Dashboard = lazyLoad(() => import('../pages/Dashboard/Dashboard'));
const SavedJobs = lazyLoad(() => import('../pages/SavedJobs/SavedJobs'));
const Admin = lazyLoad(() => import('../pages/Admin/Admin'));
const AIJobGenerator = lazyLoad(() => import('../pages/Admin/AIJobGenerator'));
const AnalyticsDashboard = lazyLoad(() => import('../pages/Admin/AnalyticsDashboard'));
const GrowthDashboard = lazyLoad(() => import('../pages/Admin/GrowthDashboard'));
const ExecutiveDashboard = lazyLoad(() => import('../pages/Admin/ExecutiveDashboard'));
const ModerationQueue = lazyLoad(() => import('../pages/Admin/ModerationQueue'));
const AdminReviewQueue = lazyLoad(() => import('../pages/Admin/AdminReviewQueue'));
const AdminVerificationQueue = lazyLoad(() => import('../pages/Admin/AdminVerificationQueue'));
const AdminGbsCapabilityQueue = lazyLoad(() => import('../pages/Admin/AdminGbsCapabilityQueue'));
const AdminGbsCapabilityReview = lazyLoad(() => import('../pages/Admin/AdminGbsCapabilityReview'));
const AdminGbsListingQueue = lazyLoad(() => import('../pages/Admin/AdminGbsListingQueue'));
const AdminGbsListingReview = lazyLoad(() => import('../pages/Admin/AdminGbsListingReview'));
const AuditLogPage = lazyLoad(() => import('../pages/Admin/AuditLogPage'));
const AlertsAdmin = lazyLoad(() => import('../pages/Admin/AlertsAdmin'));
const JobsProvinceLanding = lazyLoad(() => import('../pages/Landing/JobsProvinceLanding'));
const JobsCategoryLanding = lazyLoad(() => import('../pages/Landing/JobsCategoryLanding'));
const ResumeAnalyzer = lazyLoad(() => import('../pages/ResumeAnalyzer/ResumeAnalyzer'));
const ExamPrep = lazyLoad(() => import('../pages/ExamPrep/ExamPrep'));
const ExamDetail = lazyLoad(() => import('../pages/ExamPrep/ExamDetail'));
const QuizTake = lazyLoad(() => import('../pages/ExamPrep/QuizTake'));
const TestHub = lazyLoad(() => import('../pages/Tests/TestHub'));
const TestDetail = lazyLoad(() => import('../pages/Tests/TestDetail'));
const ScholarshipIntelligence = lazyLoad(() => import('../pages/Scholarships/ScholarshipIntelligence'));
const ScholarshipIntelligenceDetail = lazyLoad(() => import('../pages/Scholarships/ScholarshipIntelligenceDetail'));
const ProgramExplorerList = lazyLoad(() => import('../pages/Tests/ProgramExplorerList'));
const ProgramExplorerDetail = lazyLoad(() => import('../pages/Tests/ProgramExplorerDetail'));
const InstitutionExplorerList = lazyLoad(() => import('../pages/Education/InstitutionExplorerList'));
const InstitutionExplorerDetail = lazyLoad(() => import('../pages/Education/InstitutionExplorerDetail'));
const Internships = lazyLoad(() => import('../pages/Internships/Internships'));
const InternshipDetail = lazyLoad(() => import('../pages/Internships/InternshipDetail'));
const Webinars = lazyLoad(() => import('../pages/Webinars/Webinars'));
const IntlScholarships = lazyLoad(() => import('../pages/IntlScholarships/IntlScholarships'));
const IntlScholarshipDetail = lazyLoad(() => import('../pages/IntlScholarships/IntlScholarshipDetail'));
const Badges = lazyLoad(() => import('../pages/Badges/Badges'));
const ResumeBuilder = lazyLoad(() => import('../pages/ResumeBuilder/ResumeBuilder'));
const TalentProfileEditor = lazyLoad(() => import('../pages/TalentProfile/TalentProfileEditor'));
const PersonalizationHub = lazyLoad(() => import('../pages/Personalization/PersonalizationHub'));
const EligibilityDetail = lazyLoad(() => import('../pages/Personalization/EligibilityDetail').then((m) => ({ default: m.EligibilityDetailPage })));
const JourneyDashboard = lazyLoad(() => import('../pages/Journey/JourneyDashboard'));
const VaultPage = lazyLoad(() => import('../pages/Vault/VaultPage'));
const VaultDocumentDetail = lazyLoad(() => import('../pages/Vault/VaultDocumentDetail'));
const JourneyTasksPage = lazyLoad(() => import('../pages/Journey/TasksPage'));
const JourneyCalendarPage = lazyLoad(() => import('../pages/Journey/CalendarPage'));
const JourneyApplicationsPage = lazyLoad(() => import('../pages/Journey/ApplicationsPage'));
const JourneySavedPage = lazyLoad(() => import('../pages/Journey/SavedOpportunitiesPage'));
const MyApplications = lazyLoad(() => import('../pages/Applications/MyApplications'));
const CreateApplication = lazyLoad(() => import('../pages/Applications/CreateApplication'));
const ApplicationDetail = lazyLoad(() => import('../pages/Applications/ApplicationDetail'));
const StudentPrivacy = lazyLoad(() => import('../pages/Student/StudentPrivacy'));
const StudentHelp = lazyLoad(() => import('../pages/Student/StudentHelp'));
const StudentMessages = lazyLoad(() => import('../pages/Student/StudentMessages'));
const AssessmentsCatalog = lazyLoad(() => import('../pages/Assessments/AssessmentsCatalog'));
const AssessmentDetail = lazyLoad(() => import('../pages/Assessments/AssessmentDetail'));
const AssessmentTake = lazyLoad(() => import('../pages/Assessments/AssessmentTake'));
const CareerGuidance = lazyLoad(() => import('../pages/CareerGuidance/CareerGuidance'));
const CareerArticleDetail = lazyLoad(() => import('../pages/CareerGuidance/CareerArticleDetail'));
const SEOJobsPage = lazyLoad(() => import('../pages/SEO/SEOJobsPage'));
const SEOScholarshipsPage = lazyLoad(() => import('../pages/SEO/SEOScholarshipsPage'));
const About = lazyLoad(() => import('../pages/Static/staticCmsPages').then((m) => ({ default: m.AboutPage })));
const Services = lazyLoad(() => import('../pages/Static/staticCmsPages').then((m) => ({ default: m.ServicesPage })));
const Advertise = lazyLoad(() => import('../pages/Static/staticCmsPages').then((m) => ({ default: m.AdvertisePage })));
const HelpCenter = lazyLoad(() => import('../pages/Static/staticCmsPages').then((m) => ({ default: m.HelpCenterPage })));
const FAQ = lazyLoad(() => import('../pages/Static/staticCmsPages').then((m) => ({ default: m.FAQPage })));
const PrivacyPolicy = lazyLoad(() => import('../pages/Static/staticCmsPages').then((m) => ({ default: m.PrivacyPolicyPage })));
const Terms = lazyLoad(() => import('../pages/Static/staticCmsPages').then((m) => ({ default: m.TermsPage })));
const Cookies = lazyLoad(() => import('../pages/Static/staticCmsPages').then((m) => ({ default: m.CookiesPage })));
const HumanSitemap = lazyLoad(() => import('../pages/Static/HumanSitemap'));
const Disclaimer = lazyLoad(() => import('../pages/Static/staticCmsPages').then((m) => ({ default: m.DisclaimerPage })));
const RefundPolicy = lazyLoad(() => import('../pages/Static/staticCmsPages').then((m) => ({ default: m.RefundPolicyPage })));
const Careers = lazyLoad(() => import('../pages/Static/staticCmsPages').then((m) => ({ default: m.CareersPage })));
const Support = lazyLoad(() => import('../pages/Static/staticCmsPages').then((m) => ({ default: m.SupportPage })));
const SupportTickets = lazyLoad(() => import('../pages/Support/SupportTickets'));
const SubmitOpportunity = lazyLoad(() => import('../pages/Static/SubmitOpportunity'));
const NotFound = lazyLoad(() => import('../pages/Static/NotFound'));
const EmployerLogin = lazyLoad(() => import('../pages/Employer/EmployerLogin'));
const EmployerForgotPassword = lazyLoad(() => import('../pages/Employer/EmployerForgotPassword'));
const EmployerResetPassword = lazyLoad(() => import('../pages/Employer/EmployerResetPassword'));
const EmployerRegister = lazyLoad(() => import('../pages/Employer/EmployerRegister'));
const EmployerLayout = lazyLoad(() => import('../pages/Employer/EmployerLayout'));
const EmployerDashboard = lazyLoad(() => import('../pages/Employer/EmployerDashboard'));
const EmployerJobs = lazyLoad(() => import('../pages/Employer/EmployerJobs'));
const EmployerPostJob = lazyLoad(() => import('../pages/Employer/EmployerPostJob'));
const EmployerApplications = lazyLoad(() => import('../pages/Employer/EmployerApplications'));
const EmployerNotifications = lazyLoad(() => import('../pages/Employer/EmployerNotifications'));
const EmployerAnalytics = lazyLoad(() => import('../pages/Employer/EmployerAnalytics'));
const EmployerIntelligence = lazyLoad(() => import('../pages/Employer/EmployerIntelligence'));
const EmployerCandidates = lazyLoad(() => import('../pages/Employer/EmployerCandidates'));
const EmployerCandidateCompare = lazyLoad(() => import('../pages/Employer/EmployerCandidateCompare'));
const EmployerCandidateDetail = lazyLoad(() => import('../pages/Employer/EmployerCandidateDetail'));
const EmployerPipeline = lazyLoad(() => import('../pages/Employer/EmployerPipeline'));
const AdminContentJobs = lazyLoad(() => import('../pages/Admin/AdminContentJobs'));
const AdminContentScholarships = lazyLoad(() => import('../pages/Admin/AdminContentScholarships'));
const AdminContentAdmissions = lazyLoad(() => import('../pages/Admin/AdminContentAdmissions'));
const AdminContentBlogs = lazyLoad(() => import('../pages/Admin/AdminContentBlogs'));
const AdminContentInternships = lazyLoad(() => import('../pages/Admin/AdminContentInternships'));
const AdminContentUniversities = lazyLoad(() => import('../pages/Admin/AdminContentUniversities'));
const AdminEducationInstitutions = lazyLoad(() => import('../pages/Admin/AdminEducationInstitutions'));
const AdminPrograms = lazyLoad(() => import('../pages/Admin/AdminPrograms'));
const AdminEducationScholarships = lazyLoad(() => import('../pages/Admin/AdminEducationScholarships'));
const AdminIntlScholarships = lazyLoad(() => import('../pages/Admin/AdminIntlScholarships'));
const AdminForeignStudies = lazyLoad(() => import('../pages/Admin/AdminForeignStudies'));
const AdminCareerGuidance = lazyLoad(() => import('../pages/Admin/AdminCareerGuidance'));
const AdminCompanies = lazyLoad(() => import('../pages/Admin/AdminCompanies'));
const AdminEmployers = lazyLoad(() => import('../pages/Admin/AdminEmployers'));
const AdminNotifications = lazyLoad(() => import('../pages/Admin/AdminNotifications'));
const AdminAnnouncements = lazyLoad(() => import('../pages/Admin/AdminAnnouncements'));
const AdminAdvertisements = lazyLoad(() => import('../pages/Admin/AdminAdvertisements'));
const AdminExamPreparation = lazyLoad(() => import('../pages/Admin/AdminExamPreparation'));
const AdminEducationTests = lazyLoad(() => import('../pages/Admin/AdminEducationTests'));
const AdminTestAcceptance = lazyLoad(() => import('../pages/Admin/AdminTestAcceptance'));
const AdminUsers = lazyLoad(() => import('../pages/Admin/AdminUsers'));
const AdminInvitations = lazyLoad(() => import('../pages/Admin/AdminInvitations'));
const AdminPayments = lazyLoad(() => import('../pages/Admin/AdminPayments'));
const AdminImport = lazyLoad(() => import('../pages/Admin/AdminImport'));
const AdminGlobalSearch = lazyLoad(() => import('../pages/Admin/AdminGlobalSearch'));
const AdminSiteCms = lazyLoad(() => import('../pages/Admin/AdminSiteCms'));
const AdminPageBuilder = lazyLoad(() => import('../pages/Admin/AdminPageBuilder'));
const AdminPageBuilderHistory = lazyLoad(() => import('../pages/Admin/AdminPageBuilderHistory'));
const AdminBlockTemplates = lazyLoad(() => import('../pages/Admin/AdminBlockTemplates'));
const AdminGlobalBlocks = lazyLoad(() => import('../pages/Admin/AdminGlobalBlocks'));
const AdminMediaLibrary = lazyLoad(() => import('../pages/Admin/AdminMediaLibrary'));
const AdminForms = lazyLoad(() => import('../pages/Admin/AdminForms'));
const AdminFormEditor = lazyLoad(() => import('../pages/Admin/AdminFormEditor'));
const AdminFormSubmissions = lazyLoad(() => import('../pages/Admin/AdminFormSubmissions'));
const AdminContactMessages = lazyLoad(() => import('../pages/Admin/AdminContactMessages'));
const AdminInstitutions = lazyLoad(() => import('../pages/Admin/AdminInstitutions'));
const AdminWebinars = lazyLoad(() => import('../pages/Admin/AdminWebinars'));
const AdminPlatformOps = lazyLoad(() => import('../pages/Admin/AdminPlatformOps'));
const AdminNewsletter = lazyLoad(() => import('../pages/Admin/AdminNewsletter'));
const AdminSupport = lazyLoad(() => import('../pages/Admin/AdminSupport'));
const AdminMonitoring = lazyLoad(() => import('../pages/Admin/AdminMonitoring'));
const AdminSuperControlOverview = lazyLoad(() => import('../pages/Admin/AdminSuperControlOverview'));
const AdminOrganizations = lazyLoad(() => import('../pages/Admin/AdminOrganizations'));
const AdminTrustCenter = lazyLoad(() => import('../pages/Admin/AdminTrustCenter'));
const AdminCommerceCenter = lazyLoad(() => import('../pages/Admin/AdminCommerceCenter'));
const AdminDataQualityCenter = lazyLoad(() => import('../pages/Admin/AdminDataQualityCenter'));
const AdminAiOps = lazyLoad(() => import('../pages/Admin/AdminAiOps'));
const AdminSystemReadiness = lazyLoad(() => import('../pages/Admin/AdminSystemReadiness'));
const AdminCanonicalClaims = lazyLoad(() => import('../pages/Admin/AdminCanonicalClaims'));
const AdminOrganizationDetail = lazyLoad(() => import('../pages/Admin/AdminOrganizationDetail'));
const AdminInbox = lazyLoad(() => import('../pages/Admin/AdminInbox'));
const AdminPrivacyRequests = lazyLoad(() => import('../pages/Admin/AdminPrivacyRequests'));
const EmployerSettings = lazyLoad(() => import('../pages/Employer/EmployerSettings'));
const EmployerTeam = lazyLoad(() => import('../pages/Employer/EmployerTeam'));
const EmployerVerification = lazyLoad(() => import('../pages/Employer/EmployerVerification'));
const EmployerPlansUsage = lazyLoad(() => import('../pages/Employer/EmployerPlansUsage'));
const EmployerBilling = lazyLoad(() => import('../pages/Employer/EmployerBilling'));
const EmployerGuidelines = lazyLoad(() => import('../pages/Employer/EmployerGuidelines'));
const EmployerHelp = lazyLoad(() => import('../pages/Employer/EmployerHelp'));
const EmployerInterviews = lazyLoad(() => import('../pages/Employer/EmployerInterviews'));
const EmployerAcceptInvitation = lazyLoad(() => import('../pages/Employer/EmployerAcceptInvitation'));
const EmployerPublicGate = lazyLoad(() => import('../pages/Public/EmployerPublicProfile'));
const CompanyProfile = lazyLoad(() => import('../pages/Public/CompanyProfile'));
const UniversityProfile = lazyLoad(() => import('../pages/Public/UniversityProfile'));
const AgentLogin = lazyLoad(() => import('../pages/Agent/AgentLogin'));
const AgentForgotPassword = lazyLoad(() => import('../pages/Agent/AgentForgotPassword'));
const AgentResetPassword = lazyLoad(() => import('../pages/Agent/AgentResetPassword'));
const AgentRegister = lazyLoad(() => import('../pages/Agent/AgentRegister'));
const AgentLayout = lazyLoad(() => import('../pages/Agent/AgentLayout'));
const AgentDashboard = lazyLoad(() => import('../pages/Agent/AgentDashboard'));
const ProviderHome = lazyLoad(() => import('../pages/Agent/ProviderHome'));
const ProviderDomainOnboarding = lazyLoad(() => import('../pages/Agent/ProviderDomainOnboarding'));
const AgentOnboarding = lazyLoad(() => import('../pages/Agent/AgentOnboarding'));
const AgentVerification = lazyLoad(() => import('../pages/Agent/AgentVerification'));
const AgentServices = lazyLoad(() => import('../pages/Agent/AgentServices'));
const AgentLeads = lazyLoad(() => import('../pages/Agent/AgentLeads'));
const AgentClients = lazyLoad(() => import('../pages/Agent/AgentClients'));
const AgentUsageBilling = lazyLoad(() => import('../pages/Agent/AgentUsageBilling'));
const AgentGuidelines = lazyLoad(() => import('../pages/Agent/AgentGuidelines'));
const EducationProfile = lazyLoad(() => import('../pages/Agent/EducationProfile'));
const EducationTeam = lazyLoad(() => import('../pages/Agent/EducationTeam'));
const EducationMessages = lazyLoad(() => import('../pages/Agent/EducationMessages'));
const EducationNotifications = lazyLoad(() => import('../pages/Agent/EducationNotifications'));
const EducationHelp = lazyLoad(() => import('../pages/Agent/EducationHelp'));
const EducationSettings = lazyLoad(() => import('../pages/Agent/EducationSettings'));
const AgentAcceptInvitation = lazyLoad(() => import('../pages/Agent/AgentAcceptInvitation'));
const AgentDirectory = lazyLoad(() => import('../pages/Public/AgentDirectory'));
const AgentPublicProfile = lazyLoad(() => import('../pages/Public/AgentPublicProfile'));
const EducationProviderEntry = lazyLoad(() => import('../pages/Public/EducationProviderEntry'));
const BusinessProviderEntry = lazyLoad(() => import('../pages/Public/BusinessProviderEntry'));
const StudentAcquisition = lazyLoad(() => import('../pages/Public/StudentAcquisition'));
const EmployerAcquisition = lazyLoad(() => import('../pages/Public/EmployerAcquisition'));
const InstitutionAcquisition = lazyLoad(() => import('../pages/Public/InstitutionAcquisition'));
const LegacyProviderPortalLanding = lazyLoad(() => import('../pages/Public/LegacyProviderPortalLanding'));
const AgentMarketplace = lazyLoad(() => import('../pages/Agent/AgentMarketplace'));
const AgentMarketplaceForm = lazyLoad(() => import('../pages/Agent/AgentMarketplaceForm'));
const AgentMarketplacePublic = lazyLoad(() => import('../pages/Public/AgentMarketplace'));
const AgentMarketplaceDetail = lazyLoad(() => import('../pages/Public/AgentMarketplaceDetail'));
const BusinessServicesMarketplace = lazyLoad(() => import('../pages/Public/BusinessServicesMarketplace'));
const BusinessServicesListingDetail = lazyLoad(() => import('../pages/Public/BusinessServicesListingDetail'));
const AdminAgentMarketplace = lazyLoad(() => import('../pages/Admin/AdminAgentMarketplace'));
const AgentConsultations = lazyLoad(() => import('../pages/Agent/AgentConsultations'));
const AgentConsultationDetail = lazyLoad(() => import('../pages/Agent/AgentConsultationDetail'));
const AgentAvailability = lazyLoad(() => import('../pages/Agent/AgentAvailability'));
const InstitutionLogin = lazyLoad(() => import('../pages/Institution/InstitutionLogin'));
const InstitutionForgotPassword = lazyLoad(() => import('../pages/Institution/InstitutionForgotPassword'));
const InstitutionResetPassword = lazyLoad(() => import('../pages/Institution/InstitutionResetPassword'));
const InstitutionRegister = lazyLoad(() => import('../pages/Institution/InstitutionRegister'));
const InstitutionLayout = lazyLoad(() => import('../pages/Institution/InstitutionLayout'));
const InstitutionDashboard = lazyLoad(() => import('../pages/Institution/InstitutionDashboard'));
const InstitutionOnboarding = lazyLoad(() => import('../pages/Institution/InstitutionOnboarding'));
const InstitutionProfile = lazyLoad(() => import('../pages/Institution/InstitutionProfile'));
const InstitutionPrograms = lazyLoad(() => import('../pages/Institution/InstitutionPrograms'));
const InstitutionProgramEditor = lazyLoad(() => import('../pages/Institution/InstitutionProgramEditor'));
const InstitutionDataQuality = lazyLoad(() => import('../pages/Institution/InstitutionDataQuality'));
const InstitutionTeam = lazyLoad(() => import('../pages/Institution/InstitutionTeam'));
const InstitutionVerification = lazyLoad(() => import('../pages/Institution/InstitutionVerification'));
const InstitutionClaim = lazyLoad(() => import('../pages/Institution/InstitutionClaim'));
const InstitutionIntakes = lazyLoad(() => import('../pages/Institution/InstitutionIntakes'));
const InstitutionApplications = lazyLoad(() => import('../pages/Institution/InstitutionApplications'));
const InstitutionTestAcceptance = lazyLoad(() => import('../pages/Institution/InstitutionTestAcceptance'));
const InstitutionScholarships = lazyLoad(() => import('../pages/Institution/InstitutionScholarships'));
const InstitutionScholarshipEditor = lazyLoad(() => import('../pages/Institution/InstitutionScholarshipEditor'));
const InstitutionNotifications = lazyLoad(() => import('../pages/Institution/InstitutionNotifications'));
const InstitutionUsage = lazyLoad(() => import('../pages/Institution/InstitutionUsage'));
const InstitutionBilling = lazyLoad(() => import('../pages/Institution/InstitutionBilling'));
const InstitutionSettings = lazyLoad(() => import('../pages/Institution/InstitutionSettings'));
const InstitutionGuidelines = lazyLoad(() => import('../pages/Institution/InstitutionGuidelines'));
const InstitutionHelp = lazyLoad(() => import('../pages/Institution/InstitutionHelp'));
const InstitutionAcceptInvitation = lazyLoad(() => import('../pages/Institution/InstitutionAcceptInvitation'));
const StudentInstitutionApply = lazyLoad(() => import('../pages/Student/StudentInstitutionApply'));
const StudentInstitutionAdmissions = lazyLoad(() => import('../pages/Student/StudentInstitutionAdmissions'));
const Consultations = lazyLoad(() => import('../pages/Consultations/Consultations'));
const ConsultationRequest = lazyLoad(() => import('../pages/Consultations/ConsultationRequest'));
const ConsultationDetail = lazyLoad(() => import('../pages/Consultations/ConsultationDetail'));
const Cases = lazyLoad(() => import('../pages/Cases/Cases')); const CaseDetail = lazyLoad(() => import('../pages/Cases/CaseDetail')); const AgentCases = lazyLoad(() => import('../pages/Agent/AgentCases')); const AgentCaseDetail = lazyLoad(() => import('../pages/Agent/AgentCaseDetail'));
const AgentTrust = lazyLoad(() => import('../pages/Agent/AgentTrust'));
const AgentReviews = lazyLoad(() => import('../pages/Agent/AgentReviews'));
const GbsWorkspaceLayout = lazyLoad(() => import('../pages/Agent/business-services/GbsWorkspaceLayout'));
const GbsOverview = lazyLoad(() => import('../pages/Agent/business-services/GbsOverview'));
const GbsCapabilities = lazyLoad(() => import('../pages/Agent/business-services/GbsCapabilities'));
const GbsJurisdictions = lazyLoad(() => import('../pages/Agent/business-services/GbsJurisdictions'));
const GbsListings = lazyLoad(() => import('../pages/Agent/business-services/GbsListings'));
const GbsListingEditor = lazyLoad(() => import('../pages/Agent/business-services/GbsListingEditor'));
const GbsRequests = lazyLoad(() => import('../pages/Agent/business-services/GbsRequests'));
const GbsRequestDetail = lazyLoad(() => import('../pages/Agent/business-services/GbsRequestDetail'));
const GbsQuotes = lazyLoad(() => import('../pages/Agent/business-services/GbsQuotes'));
const GbsQuoteDetail = lazyLoad(() => import('../pages/Agent/business-services/GbsQuoteDetail'));
const GbsCases = lazyLoad(() => import('../pages/Agent/business-services/GbsCases'));
const GbsCaseDetail = lazyLoad(() => import('../pages/Agent/business-services/GbsCaseDetail'));
const GbsVerification = lazyLoad(() => import('../pages/Agent/business-services/GbsVerification'));
const GbsProfile = lazyLoad(() => import('../pages/Agent/business-services/GbsProfile'));
const GbsTeam = lazyLoad(() => import('../pages/Agent/business-services/GbsTeam'));
const GbsMessages = lazyLoad(() => import('../pages/Agent/business-services/GbsMessages'));
const GbsNotifications = lazyLoad(() => import('../pages/Agent/business-services/GbsNotifications'));
const GbsHelp = lazyLoad(() => import('../pages/Agent/business-services/GbsHelp'));
const GbsSettings = lazyLoad(() => import('../pages/Agent/business-services/GbsSettings'));
const BusinessClientLayout = lazyLoad(() => import('../pages/BusinessClient/BusinessClientLayout'));
const BusinessClientOverview = lazyLoad(() => import('../pages/BusinessClient/BusinessClientOverview'));
const BusinessClientRequests = lazyLoad(() => import('../pages/BusinessClient/BusinessClientRequests'));
const BusinessClientRequestForm = lazyLoad(() => import('../pages/BusinessClient/BusinessClientRequestForm'));
const BusinessClientRequestDetail = lazyLoad(() => import('../pages/BusinessClient/BusinessClientRequestDetail'));
const BusinessClientQuotes = lazyLoad(() => import('../pages/BusinessClient/BusinessClientQuotes'));
const BusinessClientQuoteDetail = lazyLoad(() => import('../pages/BusinessClient/BusinessClientQuoteDetail'));
const BusinessClientCases = lazyLoad(() => import('../pages/BusinessClient/BusinessClientCases'));
const BusinessClientCaseDetail = lazyLoad(() => import('../pages/BusinessClient/BusinessClientCaseDetail'));
const GbsRequirementPackVisualFixture = import.meta.env.DEV
  ? lazyLoad(() => import('../pages/dev/GbsRequirementPackVisualFixture'))
  : null;
const GbsFilingAuthorizationVisualFixture = import.meta.env.DEV
  ? lazyLoad(() => import('../pages/dev/GbsFilingAuthorizationVisualFixture'))
  : null;
const TrustCenter = lazyLoad(() => import('../pages/Trust/TrustCenter'));
const AgentCommerce = lazyLoad(() => import('../pages/Agent/AgentCommerce')); const CommerceHistory = lazyLoad(() => import('../pages/Commerce/CommerceHistory'));
const MarketplaceCheckout = lazyLoad(() => import('../pages/Commerce/MarketplaceCheckout'));
const CopilotPage = lazyLoad(() => import('../pages/Copilot/CopilotPage'));
const BudgetPlannerPage = lazyLoad(() => import('../pages/Budget/BudgetPlannerPage'));
const NewBudgetPlanPage = lazyLoad(() => import('../pages/Budget/NewBudgetPlanPage'));
const BudgetPlanDetailPage = lazyLoad(() => import('../pages/Budget/BudgetPlanDetailPage'));
const BudgetComparePage = lazyLoad(() => import('../pages/Budget/BudgetComparePage'));

function lazyLoad(importFn) {
  const Lazy = lazy(importFn);
  return function Wrapped(props) {
    return (
      <RouteErrorBoundary>
        <Suspense fallback={<PageFallback />}>
          <Lazy {...props} />
        </Suspense>
      </RouteErrorBoundary>
    );
  };
}

function PageFallback() {
  const { t } = useTranslation('common');
  return (
    <div
      className="min-h-[12rem] w-full bg-bg-main dark:bg-secondary flex items-center justify-center motion-reduce:min-h-[8rem]"
      role="status"
      aria-live="polite"
    >
      <span className="text-sm text-gray-500 dark:text-gray-400">{t('loading')}</span>
    </div>
  );
}

export const routes = [
  {
    path: ROUTES.INSTITUTION_DASHBOARD,
    element: <ProtectedInstitutionRoute><InstitutionLayout /></ProtectedInstitutionRoute>,
    children: [
      { index: true, element: <InstitutionDashboard /> },
      { path: 'onboarding', element: <InstitutionOnboarding /> },
      { path: 'profile', element: <InstitutionProfile /> },
      { path: 'verification', element: <InstitutionVerification /> },
      { path: 'claim', element: <InstitutionClaim /> },
      { path: 'programs', element: <InstitutionPrograms /> },
      { path: 'programs/new', element: <InstitutionProgramEditor /> },
      { path: 'programs/:programId/edit', element: <InstitutionProgramEditor /> },
      { path: 'intakes', element: <InstitutionIntakes /> },
      { path: 'applications', element: <InstitutionApplications /> },
      { path: 'applications/:applicationId', element: <InstitutionApplications /> },
      { path: 'test-acceptance', element: <InstitutionTestAcceptance /> },
      { path: 'scholarships', element: <InstitutionScholarships /> },
      { path: 'scholarships/new', element: <InstitutionScholarshipEditor /> },
      { path: 'scholarships/:scholarshipId/edit', element: <InstitutionScholarshipEditor /> },
      { path: 'data-quality', element: <InstitutionDataQuality /> },
      { path: 'team', element: <InstitutionTeam /> },
      { path: 'notifications', element: <InstitutionNotifications /> },
      { path: 'usage', element: <InstitutionUsage /> },
      { path: 'billing', element: <InstitutionBilling /> },
      { path: 'settings', element: <InstitutionSettings /> },
      { path: 'guidelines', element: <InstitutionGuidelines /> },
      { path: 'help', element: <InstitutionHelp /> },
    ],
  },
  {
    path: ROUTES.AGENT_DASHBOARD,
    element: (
      <ProtectedAgentRoute>
        <AgentLayout />
      </ProtectedAgentRoute>
    ),
    children: [
      { index: true, element: <ProviderHome /> },
      { path: 'education', element: <AgentDashboard /> },
      { path: 'education/profile', element: <EducationProfile /> },
      { path: 'education/leads', element: <AgentLeads /> },
      { path: 'education/clients', element: <AgentClients /> },
      { path: 'education/consultations', element: <AgentConsultations /> },
      { path: 'education/consultations/:consultationId', element: <AgentConsultationDetail /> },
      { path: 'education/cases', element: <AgentCases /> },
      { path: 'education/cases/:caseId', element: <AgentCaseDetail /> },
      { path: 'education/services', element: <AgentServices /> },
      { path: 'education/marketplace', element: <AgentMarketplace /> },
      { path: 'education/marketplace/new', element: <AgentMarketplaceForm /> },
      { path: 'education/marketplace/:postId/edit', element: <AgentMarketplaceForm /> },
      { path: 'education/availability', element: <AgentAvailability /> },
      { path: 'education/verification', element: <AgentVerification /> },
      { path: 'education/reviews', element: <AgentReviews /> },
      { path: 'education/team', element: <EducationTeam /> },
      { path: 'education/messages', element: <EducationMessages /> },
      { path: 'education/notifications', element: <EducationNotifications /> },
      { path: 'education/help', element: <EducationHelp /> },
      { path: 'education/settings', element: <EducationSettings /> },
      { path: 'profile', element: <LegacySharedAgentRedirect resource="profile" /> },
      { path: 'services', element: <LegacyAgentRedirect to={ROUTES.AGENT_EDUCATION_SERVICES} /> },
      { path: 'marketplace', element: <LegacyAgentRedirect to={ROUTES.AGENT_EDUCATION_MARKETPLACE} /> },
      { path: 'marketplace/new', element: <LegacyAgentRedirect to={ROUTES.AGENT_EDUCATION_MARKETPLACE_NEW} /> },
      { path: 'marketplace/:postId/edit', element: <LegacyEducationParamRedirect build={(p) => `${ROUTES.AGENT_EDUCATION_MARKETPLACE}/${p.postId}/edit`} /> },
      { path: 'consultations', element: <LegacyAgentRedirect to={ROUTES.AGENT_EDUCATION_CONSULTATIONS} /> },
      { path: 'consultations/:consultationId', element: <LegacyEducationParamRedirect build={(p) => `${ROUTES.AGENT_EDUCATION_CONSULTATIONS}/${p.consultationId}`} /> },
      { path: 'cases', element: <LegacyAgentRedirect to={ROUTES.AGENT_EDUCATION_CASES} /> },
      { path: 'cases/:caseId', element: <LegacyEducationParamRedirect build={(p) => `${ROUTES.AGENT_EDUCATION_CASES}/${p.caseId}`} /> },
      { path: 'trust', element: <AgentTrust /> },
      { path: 'reviews', element: <LegacyAgentRedirect to={ROUTES.AGENT_EDUCATION_REVIEWS} /> },
      {
        path: 'business-services',
        element: <GbsWorkspaceLayout />,
        children: [
          { index: true, element: <GbsOverview /> },
          { path: 'profile', element: <GbsProfile /> },
          { path: 'capabilities', element: <GbsCapabilities /> },
          { path: 'jurisdictions', element: <GbsJurisdictions /> },
          { path: 'listings', element: <GbsListings /> },
          { path: 'listings/new', element: <GbsListingEditor /> },
          { path: 'listings/:listingId/edit', element: <GbsListingEditor /> },
          { path: 'requests', element: <GbsRequests /> },
          { path: 'requests/:requestRef', element: <GbsRequestDetail /> },
          { path: 'quotes', element: <GbsQuotes /> },
          { path: 'quotes/:quoteRef', element: <GbsQuoteDetail /> },
          { path: 'cases', element: <GbsCases /> },
          { path: 'cases/:caseRef', element: <GbsCaseDetail /> },
          { path: 'verification', element: <GbsVerification /> },
          { path: 'team', element: <GbsTeam /> },
          { path: 'messages', element: <GbsMessages /> },
          { path: 'notifications', element: <GbsNotifications /> },
          { path: 'help', element: <GbsHelp /> },
          { path: 'settings', element: <GbsSettings /> },
        ],
      },
      { path: 'commerce', element: <AgentCommerce /> },
      { path: 'availability', element: <LegacyAgentRedirect to={ROUTES.AGENT_EDUCATION_AVAILABILITY} /> },
      { path: 'verification', element: <LegacyAgentRedirect to={ROUTES.AGENT_EDUCATION_VERIFICATION} /> },
      { path: 'team', element: <LegacySharedAgentRedirect resource="team" /> },
      { path: 'leads', element: <LegacyAgentRedirect to={ROUTES.AGENT_EDUCATION_LEADS} /> },
      { path: 'clients', element: <LegacyAgentRedirect to={ROUTES.AGENT_EDUCATION_CLIENTS} /> },
      { path: 'messages', element: <LegacySharedAgentRedirect resource="messages" /> },
      { path: 'notifications', element: <LegacySharedAgentRedirect resource="notifications" /> },
      { path: 'usage-billing', element: <AgentUsageBilling /> },
      { path: 'guidelines', element: <AgentGuidelines /> },
      { path: 'help', element: <LegacySharedAgentRedirect resource="help" /> },
      { path: 'settings', element: <LegacySharedAgentRedirect resource="settings" /> },
    ],
  },
  {
    path: ROUTES.AGENT_DOMAIN_ONBOARDING,
    element: <ProtectedAgentRoute><ProviderDomainOnboarding /></ProtectedAgentRoute>,
  },
  {
    path: ROUTES.AGENT_ONBOARDING,
    element: <ProtectedAgentRoute><AgentOnboarding /></ProtectedAgentRoute>,
  },
  {
    path: ROUTES.EMPLOYER_DASHBOARD,
    element: (
      <ProtectedEmployerRoute>
        <EmployerLayout />
      </ProtectedEmployerRoute>
    ),
    children: [
      { index: true, element: <EmployerDashboard /> },
      { path: 'intelligence', element: <EmployerIntelligence /> },
      { path: 'intelligence/candidates', element: <EmployerCandidates /> },
      { path: 'intelligence/compare', element: <EmployerCandidateCompare /> },
      { path: 'intelligence/candidates/:id', element: <EmployerCandidateDetail /> },
      { path: 'intelligence/pipeline', element: <EmployerPipeline /> },
      { path: 'jobs', element: <EmployerJobs /> },
      { path: 'jobs/new', element: <EmployerPostJob /> },
      { path: 'jobs/:jobId/edit', element: <EmployerPostJob /> },
      { path: 'applications', element: <EmployerApplications /> },
      { path: 'analytics', element: <EmployerAnalytics /> },
      { path: 'settings', element: <EmployerSettings /> },
      { path: 'notifications', element: <EmployerNotifications /> },
      { path: 'interviews', element: <EmployerInterviews /> },
      { path: 'verification', element: <EmployerVerification /> },
      { path: 'plans', element: <EmployerPlansUsage /> },
      { path: 'billing', element: <EmployerBilling /> },
      { path: 'guidelines', element: <EmployerGuidelines /> },
      { path: 'help', element: <EmployerHelp /> },
      { path: 'team', element: <EmployerTeam /> },
    ],
  },
  {
    path: '/',
    element: <MainLayoutWrapper />,
    children: [
      { index: true, element: <Home /> },
      { path: ROUTES.SEARCH, element: <SearchResults /> },
      { path: ROUTES.JOBS, element: <Jobs /> },
      { path: '/jobs-in-:slug', element: <SEOJobsPage /> },
      { path: '/latest-government-jobs', element: <SEOJobsPage /> },
      { path: '/fpsc-jobs', element: <SEOJobsPage /> },
      { path: '/nts-jobs', element: <SEOJobsPage /> },
      { path: '/ppsc-jobs', element: <SEOJobsPage /> },
      { path: '/wapda-jobs', element: <SEOJobsPage /> },
      { path: '/government-jobs', element: <SEOJobsPage /> },
      { path: '/private-jobs', element: <SEOJobsPage /> },
      { path: '/internship-jobs', element: <SEOJobsPage /> },
      { path: `${ROUTES.JOBS}/province/:slug`, element: <JobsProvinceLanding /> },
      { path: `${ROUTES.JOBS}/category/:slug`, element: <JobsCategoryLanding /> },
      { path: `${ROUTES.JOBS}/:slug`, element: <JobDetail /> },
      { path: '/scholarships-in-:country', element: <SEOScholarshipsPage /> },
      { path: ROUTES.SCHOLARSHIPS, element: <Scholarships /> },
      { path: `${ROUTES.SCHOLARSHIPS}/:slug`, element: <ScholarshipDetail /> },
      { path: ROUTES.ADMISSIONS, element: <Admissions /> },
      { path: `${ROUTES.ADMISSIONS}/:slug`, element: <AdmissionDetail /> },
      { path: ROUTES.SCHOOLS_AND_COLLEGES, element: <SchoolsAndColleges /> },
      { path: `${ROUTES.SCHOOLS_AND_COLLEGES}/:slug`, element: <InstitutionDetail /> },
      { path: ROUTES.FOREIGN_STUDIES, element: <ForeignStudies /> },
      { path: `${ROUTES.FOREIGN_STUDIES}/:slug`, element: <ForeignStudyDetail /> },
      { path: ROUTES.BLOG, element: <Blog /> },
      { path: `${ROUTES.BLOG}/:slug`, element: <BlogPost /> },
      { path: ROUTES.CONTACT, element: <Contact /> },
      { path: ROUTES.ABOUT, element: <About /> },
      { path: ROUTES.FOR_STUDENTS, element: <StudentAcquisition /> },
      { path: ROUTES.FOR_EMPLOYERS, element: <EmployerAcquisition /> },
      { path: ROUTES.FOR_INSTITUTIONS, element: <InstitutionAcquisition /> },
      { path: ROUTES.SERVICES, element: <Services /> },
      { path: ROUTES.ADVERTISE, element: <Advertise /> },
      { path: ROUTES.HELP_CENTER, element: <HelpCenter /> },
      { path: ROUTES.FAQ, element: <FAQ /> },
      { path: ROUTES.SUBMIT_OPPORTUNITY, element: <SubmitOpportunity /> },
      { path: ROUTES.PRIVACY_POLICY, element: <PrivacyPolicy /> },
      { path: ROUTES.TERMS, element: <Terms /> },
      { path: ROUTES.COOKIES, element: <Cookies /> },
      { path: ROUTES.COOKIES_LEGACY, element: <Cookies /> },
      { path: ROUTES.LICENSE, element: <NotFound /> },
      { path: ROUTES.SITEMAP, element: <HumanSitemap /> },
      { path: ROUTES.DISCLAIMER, element: <Disclaimer /> },
      { path: ROUTES.REFUND_POLICY, element: <RefundPolicy /> },
      { path: ROUTES.CAREERS, element: <Careers /> },
      { path: ROUTES.SUPPORT, element: <Support /> },
      { path: `${ROUTES.SUPPORT}/tickets`, element: <SupportTickets /> },
      { path: ROUTES.INSTITUTION_LOGIN, element: withAuthLayout(<InstitutionLogin />, 'Institution account') },
      { path: ROUTES.INSTITUTION_FORGOT_PASSWORD, element: withAuthLayout(<InstitutionForgotPassword />, 'Institution account') },
      { path: ROUTES.INSTITUTION_RESET_PASSWORD, element: withAuthLayout(<InstitutionResetPassword />, 'Institution account') },
      { path: ROUTES.INSTITUTION_REGISTER, element: withAuthLayout(<InstitutionRegister />, 'Institution account') },
      { path: ROUTES.INSTITUTION_ACCEPT_INVITATION, element: withAuthLayout(<InstitutionAcceptInvitation />, 'Institution account') },
      { path: ROUTES.LOGIN, element: withAuthLayout(<Login />, 'Student account') },
      { path: ROUTES.REGISTER, element: withAuthLayout(<Register />, 'Student account') },
      { path: ROUTES.EMPLOYER_LOGIN, element: withAuthLayout(<EmployerLogin />, 'Employer account') },
      { path: ROUTES.EMPLOYER_FORGOT_PASSWORD, element: withAuthLayout(<EmployerForgotPassword />, 'Employer account') },
      { path: ROUTES.EMPLOYER_RESET_PASSWORD, element: withAuthLayout(<EmployerResetPassword />, 'Employer account') },
      { path: ROUTES.EMPLOYER_REGISTER, element: withAuthLayout(<EmployerRegister />, 'Employer account') },
      { path: ROUTES.EMPLOYER_ACCEPT_INVITATION, element: withAuthLayout(<EmployerAcceptInvitation />, 'Employer account') },
      { path: ROUTES.AGENT_LOGIN, element: withAuthLayout(<AgentLogin />, 'Agent account') },
      { path: ROUTES.AGENT_FORGOT_PASSWORD, element: withAuthLayout(<AgentForgotPassword />, 'Agent account') },
      { path: ROUTES.AGENT_RESET_PASSWORD, element: withAuthLayout(<AgentResetPassword />, 'Agent account') },
      { path: ROUTES.AGENT_REGISTER, element: withAuthLayout(<AgentRegister />, 'Agent account') },
      { path: ROUTES.AGENT_ACCEPT_INVITATION, element: <AgentAcceptInvitation /> },
      { path: ROUTES.PROVIDERS, element: <LegacyProviderPortalLanding /> },
      { path: ROUTES.PROVIDERS_EDUCATION_MOBILITY, element: <EducationProviderEntry /> },
      { path: ROUTES.PROVIDERS_BUSINESS_FORMATION, element: <BusinessProviderEntry /> },
      { path: ROUTES.AGENT_PUBLIC_DIRECTORY, element: <AgentDirectory /> },
      { path: ROUTES.AGENT_PUBLIC_MARKETPLACE, element: <AgentMarketplacePublic /> },
      { path: ROUTES.AGENT_PUBLIC_MARKETPLACE_DETAIL, element: <AgentMarketplaceDetail /> },
      { path: ROUTES.AGENT_PUBLIC_PROFILE, element: <AgentPublicProfile /> },
      { path: ROUTES.BUSINESS_SERVICES, element: <BusinessServicesMarketplace /> },
      { path: ROUTES.BUSINESS_SERVICES_LISTING, element: <BusinessServicesListingDetail /> },
      ...(GbsRequirementPackVisualFixture ? [
        { path: 'dev/gbs-requirement-pack-fixture', element: <GbsRequirementPackVisualFixture /> },
        { path: 'dev/gbs-requirement-pack-fixture/provider', element: <GbsRequirementPackVisualFixture role="provider" /> },
      ] : []),
      ...(GbsFilingAuthorizationVisualFixture ? [
        { path: 'dev/gbs-filing-authorization-fixture', element: <GbsFilingAuthorizationVisualFixture /> },
        { path: 'dev/gbs-filing-authorization-fixture/provider', element: <GbsFilingAuthorizationVisualFixture role="provider" /> },
      ] : []),
      { path: 'employer/:slug', element: <EmployerPublicGate /> },
      { path: `${ROUTES.COMPANY}/:slug`, element: <CompanyProfile /> },
      { path: `${ROUTES.UNIVERSITY}/:slug`, element: <UniversityProfile /> },
      { path: ROUTES.FORGOT_PASSWORD, element: withAuthLayout(<ForgotPassword />, 'Student account') },
      { path: ROUTES.RESET_PASSWORD, element: withAuthLayout(<ResetPassword />, 'Student account') },
      { path: ROUTES.VERIFY_EMAIL, element: withAuthLayout(<VerifyEmail />, 'Verify email') },
      { path: ROUTES.ACCEPT_INVITATION, element: <AcceptInvitation /> },
      {
        path: ROUTES.PROFILE,
        element: (
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        ),
      },
      {
        path: ROUTES.BUSINESS,
        element: (
          <ProtectedRoute>
            <BusinessClientLayout />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <BusinessClientOverview /> },
          { path: 'requests', element: <BusinessClientRequests /> },
          { path: 'requests/new', element: <BusinessClientRequestForm /> },
          { path: 'requests/:requestRef', element: <BusinessClientRequestDetail /> },
          { path: 'quotes', element: <BusinessClientQuotes /> },
          { path: 'quotes/:quoteRef', element: <BusinessClientQuoteDetail /> },
          { path: 'cases', element: <BusinessClientCases /> },
          { path: 'cases/:caseRef', element: <BusinessClientCaseDetail /> },
        ],
      },
      {
        path: ROUTES.TALENT_PROFILE,
        element: (
          <ProtectedRoute>
            <TalentProfileEditor />
          </ProtectedRoute>
        ),
      },
      {
        path: ROUTES.STUDENT_INSTITUTION_ADMISSIONS,
        element: (
          <ProtectedRoute>
            <StudentInstitutionAdmissions />
          </ProtectedRoute>
        ),
      },
      {
        path: ROUTES.STUDENT_INSTITUTION_APPLY,
        element: (
          <ProtectedRoute>
            <StudentInstitutionApply />
          </ProtectedRoute>
        ),
      },
      {
        path: ROUTES.APPLICATIONS,
        element: (
          <ProtectedRoute>
            <MyApplications />
          </ProtectedRoute>
        ),
      },
      {
        path: `${ROUTES.APPLICATIONS}/new`,
        element: (
          <ProtectedRoute>
            <CreateApplication />
          </ProtectedRoute>
        ),
      },
      {
        path: `${ROUTES.APPLICATIONS}/:id`,
        element: (
          <ProtectedRoute>
            <ApplicationDetail />
          </ProtectedRoute>
        ),
      },
      {
        path: ROUTES.ASSESSMENTS,
        element: (
          <ProtectedRoute>
            <AssessmentsCatalog />
          </ProtectedRoute>
        ),
      },
      {
        path: `${ROUTES.ASSESSMENTS}/:slug/take`,
        element: (
          <ProtectedRoute>
            <AssessmentTake />
          </ProtectedRoute>
        ),
      },
      {
        path: `${ROUTES.ASSESSMENTS}/:slug`,
        element: (
          <ProtectedRoute>
            <AssessmentDetail />
          </ProtectedRoute>
        ),
      },
      {
        path: ROUTES.DASHBOARD,
        element: (
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: ROUTES.SAVED_JOBS,
        element: (
          <ProtectedRoute>
            <SavedJobs />
          </ProtectedRoute>
        ),
      },
      {
        path: ROUTES.NOTIFICATIONS,
        element: (
          <ProtectedRoute>
            <NotificationsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: ROUTES.ANNOUNCEMENTS,
        element: (
          <ProtectedRoute>
            <AnnouncementsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: ROUTES.PRIVACY,
        element: (
          <ProtectedRoute>
            <StudentPrivacy />
          </ProtectedRoute>
        ),
      },
      {
        path: ROUTES.STUDENT_HELP,
        element: (
          <ProtectedRoute>
            <StudentHelp />
          </ProtectedRoute>
        ),
      },
      {
        path: ROUTES.STUDENT_MESSAGES,
        element: (
          <ProtectedRoute>
            <StudentMessages />
          </ProtectedRoute>
        ),
      },
      {
        path: ROUTES.ADMIN,
        element: (
          <ProtectedRoute requireStaff>
            <Admin />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <ExecutiveDashboard /> },
          { path: 'moderation', element: <ModerationQueue /> },
          { path: 'review', element: <AdminReviewQueue /> },
          { path: 'audit', element: <AuditLogPage /> },
          { path: 'verification-queue', element: <AdminVerificationQueue /> },
          { path: 'gbs/capabilities', element: <AdminGbsCapabilityQueue /> },
          { path: 'gbs/capabilities/:id', element: <AdminGbsCapabilityReview /> },
          { path: 'gbs/listings', element: <AdminGbsListingQueue /> },
          { path: 'gbs/listings/:id', element: <AdminGbsListingReview /> },
          { path: 'agent-marketplace', element: (
            <AdminRouteGuard anyPermission={[PERMISSIONS.WORKFLOW_REVIEW, PERMISSIONS.WORKFLOW_APPROVE]}>
              <AdminAgentMarketplace />
            </AdminRouteGuard>
          ) },
          { path: 'growth-dashboard', element: <GrowthDashboard /> },
          { path: 'ai-job-generator', element: <AIJobGenerator /> },
          { path: 'analytics', element: <AnalyticsDashboard /> },
          { path: 'alerts', element: <AlertsAdmin /> },
          { path: 'jobs', element: <AdminContentJobs /> },
          { path: 'scholarships', element: <AdminContentScholarships /> },
          { path: 'admissions', element: <AdminContentAdmissions /> },
          { path: 'blogs', element: <AdminContentBlogs /> },
          { path: 'internships', element: <AdminContentInternships /> },
          { path: 'universities', element: <AdminContentUniversities /> },
          { path: 'education/institutions', element: <AdminEducationInstitutions /> },
          { path: 'programs', element: <AdminPrograms /> },
          { path: 'education/scholarships', element: <AdminEducationScholarships /> },
          { path: 'international-scholarships', element: <AdminIntlScholarships /> },
          { path: 'foreign-studies', element: <AdminForeignStudies /> },
          { path: 'career-guidance', element: <AdminCareerGuidance /> },
          { path: 'companies', element: <AdminCompanies /> },
          { path: 'employers', element: <AdminEmployers /> },
          { path: 'notifications', element: <AdminNotifications /> },
          { path: 'announcements', element: <AdminAnnouncements /> },
          { path: 'advertisements', element: <AdminAdvertisements /> },
          { path: 'exam-preparation', element: <AdminExamPreparation /> },
          { path: 'education/tests', element: <AdminEducationTests /> },
          { path: 'education/test-acceptance', element: <AdminTestAcceptance /> },
          { path: 'users', element: <AdminUsers /> },
          { path: 'invitations', element: <AdminInvitations /> },
          { path: 'payments', element: <AdminPayments /> },
          { path: 'activity', element: <AuditLogPage /> },
          { path: 'import', element: <AdminImport /> },
          { path: 'search', element: <AdminGlobalSearch /> },
          { path: 'site-cms', element: <AdminSiteCms /> },
          { path: 'page-builder', element: <AdminPageBuilder /> },
          { path: 'page-builder/history', element: <AdminPageBuilderHistory /> },
          { path: 'page-builder/templates', element: <AdminBlockTemplates /> },
          { path: 'page-builder/global-blocks', element: <AdminGlobalBlocks /> },
          { path: 'media', element: <AdminMediaLibrary /> },
          { path: 'forms', element: <AdminForms /> },
          { path: 'forms/new', element: <AdminFormEditor /> },
          { path: 'forms/submissions', element: <AdminFormSubmissions /> },
          { path: 'forms/:id', element: <AdminFormEditor /> },
          { path: 'contact-messages', element: <AdminContactMessages /> },
          { path: 'institutions', element: <AdminInstitutions /> },
          { path: 'webinars', element: <AdminWebinars /> },
          { path: 'platform-ops', element: <AdminPlatformOps /> },
          { path: 'newsletter', element: <AdminNewsletter /> },
          { path: 'support', element: <AdminSupport /> },
          { path: 'monitoring', element: <AdminMonitoring /> },
          // Mission 21 — Super Control Center
          { path: 'sc/overview', element: <AdminSuperControlOverview /> },
          { path: 'sc/organizations', element: <AdminOrganizations /> },
          { path: 'sc/organizations/:id', element: <AdminOrganizationDetail /> },
          { path: 'sc/claims', element: <AdminCanonicalClaims /> },
          { path: 'sc/trust', element: <AdminTrustCenter /> },
          { path: 'sc/commerce', element: <AdminCommerceCenter /> },
          { path: 'sc/data-quality', element: <AdminDataQualityCenter /> },
          { path: 'sc/ai-ops', element: <AdminAiOps /> },
          { path: 'sc/system', element: <AdminSystemReadiness /> },
          { path: 'inbox', element: <AdminInbox /> },
          { path: 'privacy-requests', element: <AdminPrivacyRequests /> },
        ],
      },
      {
        path: ROUTES.RESUME_ANALYZER,
        element: (
          <ProtectedRoute>
            <ResumeAnalyzer />
          </ProtectedRoute>
        ),
      },
      { path: ROUTES.RESUME_BUILDER, element: <ResumeBuilder /> },
      { path: ROUTES.CAREER_GUIDANCE, element: <CareerGuidance /> },
      { path: '/career-guidance/:slug', element: <CareerArticleDetail /> },
      { path: ROUTES.EXAM_PREP, element: <ExamPrep /> },
      { path: `${ROUTES.EXAM_PREP}/quiz/:quizId`, element: <QuizTake /> },
      { path: `${ROUTES.EXAM_PREP}/:slug`, element: <ExamDetail /> },
      { path: ROUTES.TEST_HUB, element: <TestHub /> },
      { path: `${ROUTES.TEST_HUB}/:slug`, element: <TestDetail /> },
      { path: ROUTES.CANONICAL_SCHOLARSHIPS, element: <ScholarshipIntelligence /> },
      { path: `${ROUTES.CANONICAL_SCHOLARSHIPS}/:slug`, element: <ScholarshipIntelligenceDetail /> },
      { path: ROUTES.PROGRAM_EXPLORER, element: <ProgramExplorerList /> },
      { path: `${ROUTES.PROGRAM_EXPLORER}/:slug`, element: <ProgramExplorerDetail /> },
      { path: ROUTES.EDUCATION_INSTITUTIONS, element: <InstitutionExplorerList /> },
      { path: `${ROUTES.EDUCATION_INSTITUTIONS}/:slug`, element: <InstitutionExplorerDetail /> },
      {
        path: ROUTES.PERSONALIZATION_HUB,
        element: (
          <ProtectedRoute>
            <PersonalizationHub />
          </ProtectedRoute>
        ),
      },
      {
        path: ROUTES.PERSONALIZATION_PROGRAM_ELIGIBILITY,
        element: (
          <ProtectedRoute>
            <EligibilityDetail opportunityType="program" />
          </ProtectedRoute>
        ),
      },
      {
        path: ROUTES.PERSONALIZATION_SCHOLARSHIP_ELIGIBILITY,
        element: (
          <ProtectedRoute>
            <EligibilityDetail opportunityType="scholarship" />
          </ProtectedRoute>
        ),
      },
      {
        path: ROUTES.JOURNEY,
        element: (
          <ProtectedRoute>
            <JourneyDashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: ROUTES.JOURNEY_TASKS,
        element: (
          <ProtectedRoute>
            <JourneyTasksPage />
          </ProtectedRoute>
        ),
      },
      {
        path: ROUTES.JOURNEY_DEADLINES,
        element: (
          <ProtectedRoute>
            <JourneyCalendarPage />
          </ProtectedRoute>
        ),
      },
      {
        path: ROUTES.JOURNEY_APPLICATIONS,
        element: (
          <ProtectedRoute>
            <JourneyApplicationsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: ROUTES.JOURNEY_SAVED,
        element: (
          <ProtectedRoute>
            <JourneySavedPage />
          </ProtectedRoute>
        ),
      },
      {
        path: ROUTES.VAULT,
        element: (
          <ProtectedRoute>
            <VaultPage />
          </ProtectedRoute>
        ),
      },
      {
        path: ROUTES.VAULT_DOCUMENT,
        element: (
          <ProtectedRoute>
            <VaultDocumentDetail />
          </ProtectedRoute>
        ),
      },
      {
        path: ROUTES.CONSULTATIONS,
        element: <ProtectedRoute><Consultations /></ProtectedRoute>,
      },
      { path: ROUTES.CASES, element: <ProtectedRoute><Cases /></ProtectedRoute> },
      { path: ROUTES.TRUST_CENTER, element: <ProtectedRoute><TrustCenter /></ProtectedRoute> },
      { path: ROUTES.COMMERCE_HISTORY, element: <ProtectedRoute><CommerceHistory /></ProtectedRoute> },
      { path: ROUTES.MARKETPLACE_CHECKOUT, element: <ProtectedRoute><MarketplaceCheckout /></ProtectedRoute> },
      { path: ROUTES.COPILOT, element: <ProtectedRoute><CopilotPage /></ProtectedRoute> },
      { path: ROUTES.BUDGET, element: <ProtectedRoute><BudgetPlannerPage /></ProtectedRoute> },
      { path: ROUTES.BUDGET_NEW, element: <ProtectedRoute><NewBudgetPlanPage /></ProtectedRoute> },
      { path: ROUTES.BUDGET_COMPARE, element: <ProtectedRoute><BudgetComparePage /></ProtectedRoute> },
      { path: ROUTES.BUDGET_DETAIL, element: <ProtectedRoute><BudgetPlanDetailPage /></ProtectedRoute> },
      { path: `${ROUTES.CASES}/:caseId`, element: <ProtectedRoute><CaseDetail /></ProtectedRoute> },
      {
        path: ROUTES.CONSULTATION_REQUEST,
        element: <ProtectedRoute><ConsultationRequest /></ProtectedRoute>,
      },
      {
        path: ROUTES.CONSULTATION_DETAIL,
        element: <ProtectedRoute><ConsultationDetail /></ProtectedRoute>,
      },
      { path: ROUTES.INTERNSHIPS, element: <Internships /> },
      { path: `${ROUTES.INTERNSHIPS}/:idOrSlug`, element: <InternshipDetail /> },
      { path: ROUTES.WEBINARS, element: <Webinars /> },
      { path: ROUTES.INTL_SCHOLARSHIPS, element: <IntlScholarships /> },
      { path: `${ROUTES.INTL_SCHOLARSHIPS}/:id`, element: <IntlScholarshipDetail /> },
      {
        path: ROUTES.BADGES_LEADERBOARD,
        element: (
          <ProtectedRoute>
            <Badges />
          </ProtectedRoute>
        ),
      },
    ],
  },
  ...ENABLED_CONTENT_LOCALES.filter((locale) => locale !== DEFAULT_LOCALE).map((locale) => ({
    path: `/${locale}`,
    element: <LocaleMainLayout locale={locale} />,
    children: [
      { index: true, element: <Home /> },
      { path: 'search', element: <SearchResults /> },
      { path: 'jobs', element: <Jobs /> },
      { path: 'jobs/:slug', element: <JobDetail /> },
      { path: 'scholarships', element: <Scholarships /> },
      { path: 'scholarships/:slug', element: <ScholarshipDetail /> },
      { path: 'admissions', element: <Admissions /> },
      { path: 'admissions/:slug', element: <AdmissionDetail /> },
      { path: 'blog', element: <Blog /> },
      { path: 'blog/:slug', element: <BlogPost /> },
      { path: 'about', element: <About /> },
      { path: 'services', element: <Services /> },
      { path: 'privacy-policy', element: <PrivacyPolicy /> },
      { path: 'terms', element: <Terms /> },
      { path: 'career-guidance', element: <CareerGuidance /> },
      { path: 'career-guidance/:slug', element: <CareerArticleDetail /> },
    ],
  })),
  { path: '*', element: <MainLayout><NotFound /></MainLayout> },
];
