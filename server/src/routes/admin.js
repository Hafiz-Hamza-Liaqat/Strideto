import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireStaff, requirePermission, requireSuperAdmin } from '../middleware/rbac.js';
import { adminReadLimiter, adminWriteLimiter, adminDeleteLimiter, uploadLimiter } from '../middleware/rateLimit.js';
import { PERMISSIONS } from '../config/rbac.js';
import * as adminJobs from '../controllers/admin/adminJobsController.js';
import * as adminScholarships from '../controllers/admin/adminScholarshipsController.js';
import * as adminAdmissions from '../controllers/admin/adminAdmissionsController.js';
import * as adminBlogs from '../controllers/admin/adminBlogsController.js';
import * as adminForeignStudies from '../controllers/admin/adminForeignStudiesController.js';
import * as adminNotifications from '../controllers/admin/adminNotificationsController.js';
import * as adminExams from '../controllers/admin/adminExamsController.js';
import * as adminInternships from '../controllers/admin/adminInternshipsController.js';
import * as adminWebinars from '../controllers/admin/adminWebinarsController.js';
import * as adminIntl from '../controllers/admin/adminIntlScholarshipsController.js';
import { generateJobDescription } from '../controllers/admin/aiJobController.js';
import { listImportResources, importData } from '../controllers/admin/adminImportController.js';
import { importUpload } from '../middleware/importUpload.js';
import { getGrowthDashboard } from '../controllers/growthDashboardController.js';
import { triggerScraper, getScraperRuns, getScraperSourcesList, getScraperConfig, updateScraperConfig } from '../controllers/scraperController.js';
import { getExecutiveDashboard } from '../controllers/admin/executiveDashboardController.js';
import * as moderation from '../controllers/admin/moderationController.js';
import * as auditLogs from '../controllers/admin/auditLogController.js';
import * as exportCtrl from '../controllers/admin/exportController.js';
import * as usersCtrl from '../controllers/admin/usersController.js';
import * as invitationsCtrl from '../controllers/admin/invitationsController.js';
import * as paymentsCtrl from '../controllers/admin/adminPaymentsController.js';
import * as adminCompanies from '../controllers/admin/adminCompaniesController.js';
import * as adminCareer from '../controllers/admin/adminCareerArticlesController.js';
import * as adminUpload from '../controllers/admin/adminUploadController.js';
import * as cms from '../controllers/cmsController.js';
import * as pageLayout from '../controllers/pageLayoutController.js';
import * as pageLayoutRevision from '../controllers/pageLayoutRevisionController.js';
import * as blockTemplate from '../controllers/blockTemplateController.js';
import * as globalBlock from '../controllers/globalBlockController.js';
import * as adminContact from '../controllers/admin/adminContactController.js';
import * as adminInstitutions from '../controllers/admin/adminInstitutionsController.js';
import * as adminSupport from '../controllers/admin/adminSupportController.js';
import * as newsletterAdmin from '../controllers/admin/newsletterAdminController.js';
import * as monitoring from '../controllers/admin/monitoringController.js';
import * as queueCtrl from '../controllers/admin/queueController.js';
import * as slugCtrl from '../controllers/admin/slugController.js';
import * as mediaCtrl from '../controllers/admin/mediaController.js';
import * as formAdmin from '../controllers/admin/formAdminController.js';
import * as translationAdmin from '../controllers/admin/translationController.js';
import * as formSubmissionAdmin from '../controllers/admin/formSubmissionAdminController.js';
import * as adminSearch from '../controllers/admin/adminSearchController.js';
import * as contentInsights from '../controllers/admin/contentInsightsController.js';
import * as editorialWorkflow from '../controllers/admin/editorialWorkflowController.js';
import { getPlatformHealth } from '../controllers/platformOpsController.js';
import { uploadAdminImage as uploadAdminImageMw } from '../middleware/imageUpload.js';
import { uploadMediaFiles } from '../middleware/mediaUpload.js';
import { adminVerificationRouter } from './adminVerification.js';
import { adminEducationRouter } from './adminEducation.js';

export const adminRouter = Router();

adminRouter.use(requireAuth, requireStaff, adminReadLimiter, adminWriteLimiter, adminDeleteLimiter);
adminRouter.use(adminEducationRouter);

adminRouter.get('/search', requirePermission(PERMISSIONS.CONTENT_SITE), adminSearch.adminSearch);
adminRouter.get('/search/stats', requirePermission(PERMISSIONS.CONTENT_SITE), adminSearch.adminIndexStats);
adminRouter.post('/search/reindex', requirePermission(PERMISSIONS.CONTENT_SITE), adminSearch.adminReindex);

adminRouter.get('/content-insights', requirePermission(PERMISSIONS.ANALYTICS_READ), contentInsights.getInsightsDashboard);
adminRouter.get('/content-insights/overview', requirePermission(PERMISSIONS.ANALYTICS_READ), contentInsights.getOverview);
adminRouter.get('/content-insights/search', requirePermission(PERMISSIONS.ANALYTICS_READ), contentInsights.getSearch);
adminRouter.get('/content-insights/ads', requirePermission(PERMISSIONS.ANALYTICS_READ), contentInsights.getAds);
adminRouter.get('/content-insights/content', requirePermission(PERMISSIONS.ANALYTICS_READ), contentInsights.getContent);
adminRouter.get('/content-insights/forms', requirePermission(PERMISSIONS.ANALYTICS_READ), contentInsights.getForms);
adminRouter.get('/content-insights/media', requirePermission(PERMISSIONS.ANALYTICS_READ), contentInsights.getMedia);
adminRouter.get('/content-insights/dynamic-blocks', requirePermission(PERMISSIONS.ANALYTICS_READ), contentInsights.getDynamicBlocks);
adminRouter.get('/content-insights/export', requirePermission(PERMISSIONS.ANALYTICS_READ), contentInsights.exportInsights);
adminRouter.get('/content-insights/cache', requirePermission(PERMISSIONS.ANALYTICS_READ), contentInsights.getCacheStats);
adminRouter.post('/content-insights/cache/clear', requirePermission(PERMISSIONS.ANALYTICS_READ), contentInsights.clearCache);

adminRouter.post('/upload/image', requirePermission(
  PERMISSIONS.CONTENT_SITE,
  PERMISSIONS.CONTENT_BLOGS,
  PERMISSIONS.CONTENT_CAREER,
  PERMISSIONS.CONTENT_JOBS,
), uploadLimiter, (req, res, next) => {
  uploadAdminImageMw(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Image upload failed' });
    next();
  });
}, adminUpload.uploadAdminImage);

adminRouter.get('/permissions', usersCtrl.getMyPermissions);

adminRouter.get('/slugs/check', slugCtrl.checkSlug);

adminRouter.get('/executive-dashboard', requirePermission(PERMISSIONS.ANALYTICS_READ), getExecutiveDashboard);
adminRouter.get('/growth-dashboard', requirePermission(PERMISSIONS.ANALYTICS_READ), getGrowthDashboard);
adminRouter.get('/platform-health', requirePermission(PERMISSIONS.SYSTEM_SETTINGS, PERMISSIONS.ANALYTICS_READ), getPlatformHealth);
adminRouter.get('/monitoring', requirePermission(PERMISSIONS.ANALYTICS_READ), monitoring.getMonitoringDashboard);
adminRouter.get('/queue/status', requirePermission(PERMISSIONS.ANALYTICS_READ), queueCtrl.getQueueStatus);
adminRouter.post('/queue/process', requirePermission(PERMISSIONS.SYSTEM_SETTINGS), queueCtrl.processQueueNow);
adminRouter.post('/queue/retry', requirePermission(PERMISSIONS.SYSTEM_SETTINGS), queueCtrl.retryFailedJobs);

adminRouter.get('/moderation/queues', requirePermission(PERMISSIONS.MODERATE_JOBS, PERMISSIONS.MODERATE_EMPLOYERS), moderation.getModerationQueues);
adminRouter.post('/moderation/jobs/approve', requirePermission(PERMISSIONS.MODERATE_JOBS), moderation.bulkApproveJobs);
adminRouter.post('/moderation/jobs/reject', requirePermission(PERMISSIONS.MODERATE_JOBS), moderation.bulkRejectJobs);
adminRouter.post('/moderation/employers/:id/verify', requirePermission(PERMISSIONS.MODERATE_EMPLOYERS), moderation.verifyEmployer);
adminRouter.patch('/moderation/reports/:id', requirePermission(PERMISSIONS.MODERATE_REPORTS), moderation.reviewReport);
adminRouter.post('/moderation/:type/:id/suspend', requirePermission(PERMISSIONS.MODERATE_SUSPEND), moderation.suspendListing);

adminRouter.get('/audit-logs', requirePermission(PERMISSIONS.AUDIT_READ), auditLogs.listAuditLogs);

// Verification queue (Mission 2) — sub-router handles its own permission guards
adminRouter.use('/verification', adminVerificationRouter);

adminRouter.get('/export/:resource', requirePermission(PERMISSIONS.EXPORT_DATA), exportCtrl.exportData);

adminRouter.get('/users', requirePermission(PERMISSIONS.USERS_READ), usersCtrl.listUsers);
adminRouter.post('/users/bulk-role', requirePermission(PERMISSIONS.ROLES_ASSIGN), requireSuperAdmin, usersCtrl.bulkAssignRole);
adminRouter.get('/users/:id', requirePermission(PERMISSIONS.USERS_READ), usersCtrl.getUser);
adminRouter.get('/users/:id/activity', requirePermission(PERMISSIONS.USERS_READ), usersCtrl.getUserActivity);
adminRouter.patch('/users/:id', requirePermission(PERMISSIONS.USERS_MANAGE), usersCtrl.updateUser);
adminRouter.delete('/users/:id', requirePermission(PERMISSIONS.USERS_DELETE), usersCtrl.deleteUser);
adminRouter.post('/users/:id/reset-password', requirePermission(PERMISSIONS.USERS_MANAGE), usersCtrl.adminResetPassword);
adminRouter.patch('/users/:id/role', requirePermission(PERMISSIONS.ROLES_ASSIGN), requireSuperAdmin, usersCtrl.assignRole);

adminRouter.get('/invitations', requirePermission(PERMISSIONS.USERS_MANAGE), invitationsCtrl.listInvitations);
adminRouter.post('/invitations', requirePermission(PERMISSIONS.USERS_MANAGE), invitationsCtrl.createInvitation);
adminRouter.post('/invitations/:id/resend', requirePermission(PERMISSIONS.USERS_MANAGE), invitationsCtrl.resendInvitation);
adminRouter.delete('/invitations/:id', requirePermission(PERMISSIONS.USERS_MANAGE), invitationsCtrl.revokeInvitation);

adminRouter.get('/employers', requirePermission(PERMISSIONS.USERS_READ), usersCtrl.listEmployers);
adminRouter.get('/employers/:id', requirePermission(PERMISSIONS.USERS_READ), usersCtrl.getEmployer);
adminRouter.get('/employers/:id/jobs', requirePermission(PERMISSIONS.USERS_READ), usersCtrl.getEmployerJobs);
adminRouter.patch('/employers/:id', requirePermission(PERMISSIONS.USERS_MANAGE), usersCtrl.updateEmployer);
adminRouter.post('/employers/bulk-verify', requirePermission(PERMISSIONS.MODERATE_EMPLOYERS), usersCtrl.bulkVerifyEmployers);
adminRouter.post('/employers/bulk-suspend', requirePermission(PERMISSIONS.MODERATE_SUSPEND), usersCtrl.bulkSuspendEmployers);

adminRouter.get('/companies', requirePermission(PERMISSIONS.CONTENT_COMPANIES), adminCompanies.list);
adminRouter.get('/companies/:id', requirePermission(PERMISSIONS.CONTENT_COMPANIES), adminCompanies.getOne);
adminRouter.post('/companies', requirePermission(PERMISSIONS.CONTENT_COMPANIES), adminCompanies.create);
adminRouter.post('/companies/bulk', requirePermission(PERMISSIONS.CONTENT_COMPANIES), adminCompanies.bulkAction);
adminRouter.post('/companies/:id/duplicate', requirePermission(PERMISSIONS.CONTENT_COMPANIES), adminCompanies.duplicate);
adminRouter.put('/companies/:id', requirePermission(PERMISSIONS.CONTENT_COMPANIES), adminCompanies.update);
adminRouter.delete('/companies/:id', requirePermission(PERMISSIONS.CONTENT_COMPANIES), adminCompanies.remove);

adminRouter.get('/career-articles', requirePermission(PERMISSIONS.CONTENT_CAREER), adminCareer.list);
adminRouter.get('/career-articles/:id', requirePermission(PERMISSIONS.CONTENT_CAREER), adminCareer.getOne);
adminRouter.post('/career-articles', requirePermission(PERMISSIONS.CONTENT_CAREER), adminCareer.create);
adminRouter.post('/career-articles/bulk', requirePermission(PERMISSIONS.CONTENT_CAREER), adminCareer.bulkAction);
adminRouter.post('/career-articles/:id/duplicate', requirePermission(PERMISSIONS.CONTENT_CAREER), adminCareer.duplicate);
adminRouter.put('/career-articles/:id', requirePermission(PERMISSIONS.CONTENT_CAREER), adminCareer.update);
adminRouter.delete('/career-articles/:id', requirePermission(PERMISSIONS.CONTENT_CAREER), adminCareer.remove);

adminRouter.get('/payments', requirePermission(PERMISSIONS.PAYMENTS_READ), paymentsCtrl.listPayments);
adminRouter.get('/payments/:id', requirePermission(PERMISSIONS.PAYMENTS_READ), paymentsCtrl.getPayment);

adminRouter.get('/', (_req, res) => {
  res.json({ message: 'Admin panel', version: 'operations-v1' });
});

adminRouter.post('/scraper/run', requirePermission(PERMISSIONS.SCRAPER_RUN), triggerScraper);
adminRouter.get('/scraper/runs', requirePermission(PERMISSIONS.SCRAPER_RUN), getScraperRuns);
adminRouter.get('/scraper/sources', requirePermission(PERMISSIONS.SCRAPER_RUN), getScraperSourcesList);
adminRouter.get('/scraper/config', requirePermission(PERMISSIONS.SYSTEM_SETTINGS), requireSuperAdmin, getScraperConfig);
adminRouter.patch('/scraper/config', requirePermission(PERMISSIONS.SYSTEM_SETTINGS), requireSuperAdmin, updateScraperConfig);

adminRouter.get('/jobs', requirePermission(PERMISSIONS.CONTENT_JOBS, PERMISSIONS.MODERATE_JOBS), adminJobs.list);
adminRouter.get('/jobs/:id', requirePermission(PERMISSIONS.CONTENT_JOBS, PERMISSIONS.MODERATE_JOBS), adminJobs.getOne);
adminRouter.post('/jobs/generate', requirePermission(PERMISSIONS.CONTENT_JOBS), generateJobDescription);
adminRouter.post('/jobs', requirePermission(PERMISSIONS.CONTENT_JOBS), adminJobs.create);
adminRouter.post('/jobs/bulk', requirePermission(PERMISSIONS.CONTENT_JOBS), adminJobs.bulkAction);
adminRouter.post('/jobs/:id/duplicate', requirePermission(PERMISSIONS.CONTENT_JOBS), adminJobs.duplicate);
adminRouter.put('/jobs/:id', requirePermission(PERMISSIONS.CONTENT_JOBS), adminJobs.update);
adminRouter.post('/jobs/:id/approve', requirePermission(PERMISSIONS.MODERATE_JOBS), adminJobs.approveJob);
adminRouter.post('/jobs/:id/reject', requirePermission(PERMISSIONS.MODERATE_JOBS), adminJobs.rejectJob);
adminRouter.delete('/jobs/:id', requirePermission(PERMISSIONS.CONTENT_JOBS), adminJobs.remove);

adminRouter.get('/scholarships', requirePermission(PERMISSIONS.CONTENT_SCHOLARSHIPS), adminScholarships.list);
adminRouter.get('/scholarships/:id', requirePermission(PERMISSIONS.CONTENT_SCHOLARSHIPS), adminScholarships.getOne);
adminRouter.post('/scholarships', requirePermission(PERMISSIONS.CONTENT_SCHOLARSHIPS), adminScholarships.create);
adminRouter.post('/scholarships/bulk', requirePermission(PERMISSIONS.CONTENT_SCHOLARSHIPS), adminScholarships.bulkAction);
adminRouter.post('/scholarships/:id/duplicate', requirePermission(PERMISSIONS.CONTENT_SCHOLARSHIPS), adminScholarships.duplicate);
adminRouter.put('/scholarships/:id', requirePermission(PERMISSIONS.CONTENT_SCHOLARSHIPS), adminScholarships.update);
adminRouter.delete('/scholarships/:id', requirePermission(PERMISSIONS.CONTENT_SCHOLARSHIPS), adminScholarships.remove);

adminRouter.get('/admissions', requirePermission(PERMISSIONS.CONTENT_ADMISSIONS), adminAdmissions.list);
adminRouter.get('/admissions/:id', requirePermission(PERMISSIONS.CONTENT_ADMISSIONS), adminAdmissions.getOne);
adminRouter.post('/admissions', requirePermission(PERMISSIONS.CONTENT_ADMISSIONS), adminAdmissions.create);
adminRouter.post('/admissions/bulk', requirePermission(PERMISSIONS.CONTENT_ADMISSIONS), adminAdmissions.bulkAction);
adminRouter.post('/admissions/:id/duplicate', requirePermission(PERMISSIONS.CONTENT_ADMISSIONS), adminAdmissions.duplicate);
adminRouter.put('/admissions/:id', requirePermission(PERMISSIONS.CONTENT_ADMISSIONS), adminAdmissions.update);
adminRouter.delete('/admissions/:id', requirePermission(PERMISSIONS.CONTENT_ADMISSIONS), adminAdmissions.remove);

adminRouter.get('/blogs', requirePermission(PERMISSIONS.CONTENT_BLOGS), adminBlogs.list);
adminRouter.get('/blogs/:id', requirePermission(PERMISSIONS.CONTENT_BLOGS), adminBlogs.getOne);
adminRouter.post('/blogs', requirePermission(PERMISSIONS.CONTENT_BLOGS), adminBlogs.create);
adminRouter.post('/blogs/bulk', requirePermission(PERMISSIONS.CONTENT_BLOGS), adminBlogs.bulkAction);
adminRouter.post('/blogs/:id/duplicate', requirePermission(PERMISSIONS.CONTENT_BLOGS), adminBlogs.duplicate);
adminRouter.put('/blogs/:id', requirePermission(PERMISSIONS.CONTENT_BLOGS), adminBlogs.update);
adminRouter.delete('/blogs/:id', requirePermission(PERMISSIONS.CONTENT_BLOGS), adminBlogs.remove);

adminRouter.get('/foreign-studies', requirePermission(PERMISSIONS.CONTENT_FOREIGN), adminForeignStudies.list);
adminRouter.get('/foreign-studies/:id', requirePermission(PERMISSIONS.CONTENT_FOREIGN), adminForeignStudies.getOne);
adminRouter.post('/foreign-studies', requirePermission(PERMISSIONS.CONTENT_FOREIGN), adminForeignStudies.create);
adminRouter.post('/foreign-studies/bulk', requirePermission(PERMISSIONS.CONTENT_FOREIGN), adminForeignStudies.bulkAction);
adminRouter.post('/foreign-studies/:id/duplicate', requirePermission(PERMISSIONS.CONTENT_FOREIGN), adminForeignStudies.duplicate);
adminRouter.put('/foreign-studies/:id', requirePermission(PERMISSIONS.CONTENT_FOREIGN), adminForeignStudies.update);
adminRouter.delete('/foreign-studies/:id', requirePermission(PERMISSIONS.CONTENT_FOREIGN), adminForeignStudies.remove);

adminRouter.get('/notifications', requirePermission(PERMISSIONS.NOTIFICATIONS_SEND), adminNotifications.list);
adminRouter.post('/notifications', requirePermission(PERMISSIONS.NOTIFICATIONS_SEND), adminNotifications.create);
adminRouter.put('/notifications/:id', requirePermission(PERMISSIONS.NOTIFICATIONS_SEND), adminNotifications.update);
adminRouter.delete('/notifications/:id', requirePermission(PERMISSIONS.NOTIFICATIONS_SEND), adminNotifications.remove);

adminRouter.get('/exams', requirePermission(PERMISSIONS.CONTENT_MCQS), adminExams.listExams);
adminRouter.post('/exams', requirePermission(PERMISSIONS.CONTENT_MCQS), adminExams.createExam);
adminRouter.put('/exams/:id', requirePermission(PERMISSIONS.CONTENT_MCQS), adminExams.updateExam);
adminRouter.delete('/exams/:id', requirePermission(PERMISSIONS.CONTENT_MCQS), adminExams.removeExam);
adminRouter.get('/exams/analytics', requirePermission(PERMISSIONS.ANALYTICS_READ), adminExams.getExamAnalytics);

adminRouter.get('/internships', requirePermission(PERMISSIONS.CONTENT_JOBS), adminInternships.list);
adminRouter.get('/internships/:id', requirePermission(PERMISSIONS.CONTENT_JOBS), adminInternships.getOne);
adminRouter.post('/internships', requirePermission(PERMISSIONS.CONTENT_JOBS), adminInternships.create);
adminRouter.post('/internships/bulk', requirePermission(PERMISSIONS.CONTENT_JOBS), adminInternships.bulkAction);
adminRouter.post('/internships/:id/duplicate', requirePermission(PERMISSIONS.CONTENT_JOBS), adminInternships.duplicate);
adminRouter.put('/internships/:id', requirePermission(PERMISSIONS.CONTENT_JOBS), adminInternships.update);
adminRouter.delete('/internships/:id', requirePermission(PERMISSIONS.CONTENT_JOBS), adminInternships.remove);

adminRouter.get('/webinars', requirePermission(PERMISSIONS.CONTENT_BLOGS), adminWebinars.list);
adminRouter.get('/webinars/:id', requirePermission(PERMISSIONS.CONTENT_BLOGS), adminWebinars.getOne);
adminRouter.post('/webinars', requirePermission(PERMISSIONS.CONTENT_BLOGS), adminWebinars.create);
adminRouter.put('/webinars/:id', requirePermission(PERMISSIONS.CONTENT_BLOGS), adminWebinars.update);
adminRouter.delete('/webinars/:id', requirePermission(PERMISSIONS.CONTENT_BLOGS), adminWebinars.remove);

adminRouter.get('/intl-scholarships', requirePermission(PERMISSIONS.CONTENT_SCHOLARSHIPS), adminIntl.listScholarships);
adminRouter.get('/intl-scholarships/:id', requirePermission(PERMISSIONS.CONTENT_SCHOLARSHIPS), adminIntl.getScholarship);
adminRouter.post('/intl-scholarships', requirePermission(PERMISSIONS.CONTENT_SCHOLARSHIPS), adminIntl.createScholarship);
adminRouter.post('/intl-scholarships/bulk', requirePermission(PERMISSIONS.CONTENT_SCHOLARSHIPS), adminIntl.bulkScholarships);
adminRouter.post('/intl-scholarships/:id/duplicate', requirePermission(PERMISSIONS.CONTENT_SCHOLARSHIPS), adminIntl.duplicateScholarship);
adminRouter.put('/intl-scholarships/:id', requirePermission(PERMISSIONS.CONTENT_SCHOLARSHIPS), adminIntl.updateScholarship);
adminRouter.delete('/intl-scholarships/:id', requirePermission(PERMISSIONS.CONTENT_SCHOLARSHIPS), adminIntl.removeScholarship);
adminRouter.get('/universities', requirePermission(PERMISSIONS.CONTENT_UNIVERSITIES), adminIntl.listUniversities);
adminRouter.get('/universities/:id', requirePermission(PERMISSIONS.CONTENT_UNIVERSITIES), adminIntl.getUniversity);
adminRouter.post('/universities', requirePermission(PERMISSIONS.CONTENT_UNIVERSITIES), adminIntl.createUniversity);
adminRouter.post('/universities/bulk', requirePermission(PERMISSIONS.CONTENT_UNIVERSITIES), adminIntl.bulkUniversities);
adminRouter.post('/universities/:id/duplicate', requirePermission(PERMISSIONS.CONTENT_UNIVERSITIES), adminIntl.duplicateUniversity);
adminRouter.put('/universities/:id', requirePermission(PERMISSIONS.CONTENT_UNIVERSITIES), adminIntl.updateUniversity);
adminRouter.delete('/universities/:id', requirePermission(PERMISSIONS.CONTENT_UNIVERSITIES), adminIntl.removeUniversity);

adminRouter.get('/past-papers', requirePermission(PERMISSIONS.CONTENT_MCQS), adminExams.listPastPapers);
adminRouter.post('/past-papers', requirePermission(PERMISSIONS.CONTENT_MCQS), adminExams.createPastPaper);
adminRouter.put('/past-papers/:id', requirePermission(PERMISSIONS.CONTENT_MCQS), adminExams.updatePastPaper);
adminRouter.delete('/past-papers/:id', requirePermission(PERMISSIONS.CONTENT_MCQS), adminExams.removePastPaper);
adminRouter.get('/mcqs', requirePermission(PERMISSIONS.CONTENT_MCQS), adminExams.listMcqs);
adminRouter.post('/mcqs', requirePermission(PERMISSIONS.CONTENT_MCQS), adminExams.createMcq);
adminRouter.put('/mcqs/:id', requirePermission(PERMISSIONS.CONTENT_MCQS), adminExams.updateMcq);
adminRouter.delete('/mcqs/:id', requirePermission(PERMISSIONS.CONTENT_MCQS), adminExams.removeMcq);
adminRouter.get('/quizzes', requirePermission(PERMISSIONS.CONTENT_MCQS), adminExams.listQuizzes);
adminRouter.post('/quizzes', requirePermission(PERMISSIONS.CONTENT_MCQS), adminExams.createQuiz);
adminRouter.put('/quizzes/:id', requirePermission(PERMISSIONS.CONTENT_MCQS), adminExams.updateQuiz);
adminRouter.delete('/quizzes/:id', requirePermission(PERMISSIONS.CONTENT_MCQS), adminExams.removeQuiz);

adminRouter.get('/import', requirePermission(PERMISSIONS.CONTENT_IMPORT), listImportResources);
adminRouter.post('/import/:resource', requirePermission(PERMISSIONS.CONTENT_IMPORT), importUpload.single('file'), importData);

// Site CMS (Sprint C.1)
adminRouter.get('/cms/homepage', requirePermission(PERMISSIONS.CONTENT_SITE), cms.getHomepageAdmin);
adminRouter.put('/cms/homepage', requirePermission(PERMISSIONS.CONTENT_SITE), cms.upsertHomepage);
adminRouter.post('/cms/homepage/:locale/publish', requirePermission(PERMISSIONS.CONTENT_CMS_PUBLISH), cms.publishHomepage);
adminRouter.get('/cms/homepage/preview', requirePermission(PERMISSIONS.CONTENT_SITE), cms.previewHomepage);

adminRouter.get('/cms/navigation', requirePermission(PERMISSIONS.CONTENT_NAV), cms.getNavigationAdmin);
adminRouter.put('/cms/navigation', requirePermission(PERMISSIONS.CONTENT_NAV), cms.upsertNavigation);
adminRouter.post('/cms/navigation/:placement/:locale/publish', requirePermission(PERMISSIONS.CONTENT_CMS_PUBLISH), cms.publishNavigation);

adminRouter.get('/cms/pages', requirePermission(PERMISSIONS.CONTENT_PAGES), cms.listStaticPages);
adminRouter.get('/cms/pages/:id/preview', requirePermission(PERMISSIONS.CONTENT_PAGES), cms.previewStaticPage);
adminRouter.get('/cms/pages/:id', requirePermission(PERMISSIONS.CONTENT_PAGES), cms.getStaticPage);
adminRouter.post('/cms/pages', requirePermission(PERMISSIONS.CONTENT_PAGES), cms.createStaticPage);
adminRouter.put('/cms/pages/:id', requirePermission(PERMISSIONS.CONTENT_PAGES), cms.updateStaticPage);
adminRouter.delete('/cms/pages/:id', requirePermission(PERMISSIONS.CONTENT_PAGES), cms.deleteStaticPage);
adminRouter.post('/cms/pages/:id/publish', requirePermission(PERMISSIONS.CONTENT_CMS_PUBLISH), cms.publishStaticPage);

adminRouter.get('/cms/banners', requirePermission(PERMISSIONS.CONTENT_SITE), cms.listBanners);
adminRouter.get('/cms/banners/:id', requirePermission(PERMISSIONS.CONTENT_SITE), cms.getBanner);
adminRouter.post('/cms/banners', requirePermission(PERMISSIONS.CONTENT_SITE), cms.createBanner);
adminRouter.put('/cms/banners/:id', requirePermission(PERMISSIONS.CONTENT_SITE), cms.updateBanner);
adminRouter.delete('/cms/banners/:id', requirePermission(PERMISSIONS.CONTENT_SITE), cms.deleteBanner);

// Page Builder foundation (Sprint C.6.4.8) — additive; does not replace Site CMS
adminRouter.get('/page-layouts', requirePermission(PERMISSIONS.CONTENT_SITE), pageLayout.listPageLayouts);
adminRouter.get('/page-layouts/registry', requirePermission(PERMISSIONS.CONTENT_SITE), pageLayout.getBlockRegistryMeta);
adminRouter.get('/page-layouts/revisions/compare', requirePermission(PERMISSIONS.CONTENT_SITE), pageLayoutRevision.compareRevisionPair);
adminRouter.get('/page-layouts/revisions/:revisionId/preview', requirePermission(PERMISSIONS.CONTENT_SITE), pageLayoutRevision.previewRevision);
adminRouter.get('/page-layouts/revisions/:revisionId', requirePermission(PERMISSIONS.CONTENT_SITE), pageLayoutRevision.getRevision);
adminRouter.delete('/page-layouts/revisions/:revisionId', requirePermission(PERMISSIONS.CONTENT_SITE), pageLayoutRevision.deleteRevision);
adminRouter.get('/page-layouts/:pageKey/:locale/revisions', requirePermission(PERMISSIONS.CONTENT_SITE), pageLayoutRevision.listRevisions);
adminRouter.post('/page-layouts/:pageKey/:locale/revisions/:revisionId/restore', requirePermission(PERMISSIONS.CONTENT_SITE), pageLayoutRevision.restoreRevision);
adminRouter.get('/page-layouts/:pageKey/preview', requirePermission(PERMISSIONS.CONTENT_SITE), pageLayout.previewPageLayout);
adminRouter.get('/page-layouts/:pageKey', requirePermission(PERMISSIONS.CONTENT_SITE), pageLayout.getPageLayoutAdmin);
adminRouter.put('/page-layouts', requirePermission(PERMISSIONS.CONTENT_SITE), pageLayout.upsertPageLayout);
adminRouter.post('/page-layouts/:pageKey/:locale/publish', requirePermission(PERMISSIONS.CONTENT_CMS_PUBLISH), pageLayout.publishPageLayout);

// Page Builder templates & global blocks (C.6.4.12)
adminRouter.get('/block-templates', requirePermission(PERMISSIONS.CONTENT_SITE), blockTemplate.listBlockTemplates);
adminRouter.post('/block-templates', requirePermission(PERMISSIONS.CONTENT_SITE), blockTemplate.createBlockTemplate);
adminRouter.get('/block-templates/:id', requirePermission(PERMISSIONS.CONTENT_SITE), blockTemplate.getBlockTemplate);
adminRouter.put('/block-templates/:id', requirePermission(PERMISSIONS.CONTENT_SITE), blockTemplate.updateBlockTemplate);
adminRouter.delete('/block-templates/:id', requirePermission(PERMISSIONS.CONTENT_SITE), blockTemplate.deleteBlockTemplate);
adminRouter.post('/block-templates/:id/duplicate', requirePermission(PERMISSIONS.CONTENT_SITE), blockTemplate.duplicateBlockTemplate);

adminRouter.get('/global-blocks/batch', requirePermission(PERMISSIONS.CONTENT_SITE), globalBlock.getGlobalBlocksAdminBatch);
adminRouter.get('/global-blocks', requirePermission(PERMISSIONS.CONTENT_SITE), globalBlock.listGlobalBlocks);
adminRouter.post('/global-blocks', requirePermission(PERMISSIONS.CONTENT_SITE), globalBlock.createGlobalBlock);
adminRouter.get('/global-blocks/:id/usage', requirePermission(PERMISSIONS.CONTENT_SITE), globalBlock.getGlobalBlockUsage);
adminRouter.get('/global-blocks/:id', requirePermission(PERMISSIONS.CONTENT_SITE), globalBlock.getGlobalBlock);
adminRouter.put('/global-blocks/:id', requirePermission(PERMISSIONS.CONTENT_SITE), globalBlock.updateGlobalBlock);
adminRouter.delete('/global-blocks/:id', requirePermission(PERMISSIONS.CONTENT_SITE), globalBlock.deleteGlobalBlock);
adminRouter.post('/global-blocks/:id/duplicate', requirePermission(PERMISSIONS.CONTENT_SITE), globalBlock.duplicateGlobalBlock);

adminRouter.get('/contact-messages', requirePermission(PERMISSIONS.USERS_READ), adminContact.list);
adminRouter.get('/contact-messages/export', requirePermission(PERMISSIONS.EXPORT_DATA), adminContact.exportCsv);
adminRouter.get('/contact-messages/:id', requirePermission(PERMISSIONS.USERS_READ), adminContact.getOne);
adminRouter.patch('/contact-messages/:id', requirePermission(PERMISSIONS.USERS_MANAGE), adminContact.update);
adminRouter.delete('/contact-messages/:id', requirePermission(PERMISSIONS.USERS_MANAGE), adminContact.remove);

adminRouter.get('/institutions', requirePermission(PERMISSIONS.CONTENT_ADMISSIONS), adminInstitutions.list);
adminRouter.get('/institutions/:id', requirePermission(PERMISSIONS.CONTENT_ADMISSIONS), adminInstitutions.getOne);
adminRouter.post('/institutions', requirePermission(PERMISSIONS.CONTENT_ADMISSIONS), adminInstitutions.create);
adminRouter.post('/institutions/bulk', requirePermission(PERMISSIONS.CONTENT_ADMISSIONS), adminInstitutions.bulkAction);
adminRouter.post('/institutions/:id/duplicate', requirePermission(PERMISSIONS.CONTENT_ADMISSIONS), adminInstitutions.duplicate);
adminRouter.put('/institutions/:id', requirePermission(PERMISSIONS.CONTENT_ADMISSIONS), adminInstitutions.update);
adminRouter.delete('/institutions/:id', requirePermission(PERMISSIONS.CONTENT_ADMISSIONS), adminInstitutions.remove);

adminRouter.get('/support/tickets', requirePermission(PERMISSIONS.USERS_READ), adminSupport.list);
adminRouter.get('/support/tickets/:id', requirePermission(PERMISSIONS.USERS_READ), adminSupport.getOne);
adminRouter.patch('/support/tickets/:id', requirePermission(PERMISSIONS.USERS_MANAGE), adminSupport.update);
adminRouter.post('/support/tickets/:id/reply', requirePermission(PERMISSIONS.USERS_MANAGE), adminSupport.reply);
adminRouter.post('/support/tickets/:id/close', requirePermission(PERMISSIONS.USERS_MANAGE), adminSupport.close);

adminRouter.get('/newsletter/subscribers', requirePermission(PERMISSIONS.NOTIFICATIONS_SEND), newsletterAdmin.listSubscribers);
adminRouter.get('/newsletter/subscribers/export', requirePermission(PERMISSIONS.EXPORT_DATA), newsletterAdmin.exportSubscribersCsv);
adminRouter.delete('/newsletter/subscribers/:id', requirePermission(PERMISSIONS.NOTIFICATIONS_SEND), newsletterAdmin.deleteSubscriber);
adminRouter.get('/newsletter/logs', requirePermission(PERMISSIONS.NOTIFICATIONS_SEND), newsletterAdmin.listLogs);
adminRouter.post('/newsletter/send', requirePermission(PERMISSIONS.NOTIFICATIONS_SEND), newsletterAdmin.sendNewsletter);

// Media Library (C.7.0.1)
adminRouter.get('/media/folders', requirePermission(PERMISSIONS.CONTENT_SITE), mediaCtrl.listFolders);
adminRouter.get('/media', requirePermission(PERMISSIONS.CONTENT_SITE), mediaCtrl.listAssets);
adminRouter.post('/media/upload', requirePermission(PERMISSIONS.CONTENT_SITE), uploadLimiter, (req, res, next) => {
  uploadMediaFiles(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Media upload failed' });
    next();
  });
}, mediaCtrl.uploadAssets);
adminRouter.get('/media/:id/usage', requirePermission(PERMISSIONS.CONTENT_SITE), mediaCtrl.getAssetUsage);
adminRouter.get('/media/:id', requirePermission(PERMISSIONS.CONTENT_SITE), mediaCtrl.getAsset);
adminRouter.patch('/media/:id', requirePermission(PERMISSIONS.CONTENT_SITE), mediaCtrl.patchAsset);
adminRouter.post('/media/:id/rename', requirePermission(PERMISSIONS.CONTENT_SITE), mediaCtrl.renameAsset);
adminRouter.delete('/media/:id', requirePermission(PERMISSIONS.CONTENT_SITE), mediaCtrl.removeAsset);

// Forms Builder (C.7.0.2)
adminRouter.get('/forms/published', requirePermission(PERMISSIONS.CONTENT_SITE), formAdmin.listPublishedForms);
adminRouter.get('/forms/submissions/export', requirePermission(PERMISSIONS.USERS_READ, PERMISSIONS.EXPORT_DATA), formSubmissionAdmin.exportCsv);
adminRouter.get('/forms/submissions', requirePermission(PERMISSIONS.USERS_READ), formSubmissionAdmin.listSubmissions);
adminRouter.get('/forms/submissions/:id', requirePermission(PERMISSIONS.USERS_READ), formSubmissionAdmin.getSubmission);
adminRouter.patch('/forms/submissions/:id', requirePermission(PERMISSIONS.USERS_MANAGE), formSubmissionAdmin.patchSubmission);
adminRouter.delete('/forms/submissions/:id', requirePermission(PERMISSIONS.USERS_MANAGE), formSubmissionAdmin.removeSubmission);
adminRouter.get('/forms', requirePermission(PERMISSIONS.CONTENT_SITE), formAdmin.listForms);
adminRouter.post('/forms', requirePermission(PERMISSIONS.CONTENT_SITE), formAdmin.createForm);
adminRouter.get('/forms/:id', requirePermission(PERMISSIONS.CONTENT_SITE), formAdmin.getForm);
adminRouter.put('/forms/:id', requirePermission(PERMISSIONS.CONTENT_SITE), formAdmin.updateForm);
adminRouter.delete('/forms/:id', requirePermission(PERMISSIONS.CONTENT_SITE), formAdmin.removeForm);
adminRouter.post('/forms/:id/duplicate', requirePermission(PERMISSIONS.CONTENT_SITE), formAdmin.duplicateForm);

// Translations (C.7.0.8)
adminRouter.get('/translations/:entityType/:id/group', requirePermission(PERMISSIONS.CONTENT_SITE), translationAdmin.getTranslationGroup);
adminRouter.get('/translations/:entityType/:id/equivalent', requirePermission(PERMISSIONS.CONTENT_SITE), translationAdmin.findEquivalent);
adminRouter.post('/translations/:entityType/:id', requirePermission(PERMISSIONS.CONTENT_SITE), translationAdmin.createTranslation);

// Editorial workflow (C.7.0.6)
adminRouter.get('/workflow/permissions', requirePermission(PERMISSIONS.WORKFLOW_VIEW, PERMISSIONS.ANALYTICS_READ), editorialWorkflow.getPermissionModel);
adminRouter.get('/workflow/dashboard', requirePermission(PERMISSIONS.WORKFLOW_VIEW, PERMISSIONS.ANALYTICS_READ), editorialWorkflow.getDashboard);
adminRouter.get('/review', requirePermission(PERMISSIONS.WORKFLOW_VIEW, PERMISSIONS.WORKFLOW_REVIEW), editorialWorkflow.getReviewQueue);
adminRouter.get('/workflow/check', requirePermission(PERMISSIONS.WORKFLOW_VIEW), editorialWorkflow.checkPermission);
adminRouter.post('/workflow/bulk/approve', requirePermission(PERMISSIONS.WORKFLOW_APPROVE), editorialWorkflow.bulkApprove);
adminRouter.post('/workflow/bulk/reject', requirePermission(PERMISSIONS.WORKFLOW_APPROVE, PERMISSIONS.WORKFLOW_REVIEW), editorialWorkflow.bulkReject);
adminRouter.post('/workflow/bulk/assign', requirePermission(PERMISSIONS.WORKFLOW_REVIEW), editorialWorkflow.bulkAssign);
adminRouter.get('/workflow/:entityType/:entityId', requirePermission(PERMISSIONS.WORKFLOW_VIEW), editorialWorkflow.getWorkflow);
adminRouter.post('/workflow/:entityType/:entityId/submit', requirePermission(PERMISSIONS.WORKFLOW_REVIEW, PERMISSIONS.WORKFLOW_VIEW), editorialWorkflow.submitForReview);
adminRouter.post('/workflow/:entityType/:entityId/assign', requirePermission(PERMISSIONS.WORKFLOW_REVIEW), editorialWorkflow.assignReviewer);
adminRouter.post('/workflow/:entityType/:entityId/approve', requirePermission(PERMISSIONS.WORKFLOW_APPROVE), editorialWorkflow.approve);
adminRouter.post('/workflow/:entityType/:entityId/reject', requirePermission(PERMISSIONS.WORKFLOW_APPROVE, PERMISSIONS.WORKFLOW_REVIEW), editorialWorkflow.reject);
adminRouter.post('/workflow/:entityType/:entityId/request-changes', requirePermission(PERMISSIONS.WORKFLOW_REVIEW), editorialWorkflow.requestChanges);
adminRouter.post('/workflow/:entityType/:entityId/schedule', requirePermission(PERMISSIONS.WORKFLOW_SCHEDULE, PERMISSIONS.WORKFLOW_PUBLISH), editorialWorkflow.schedule);
adminRouter.post('/workflow/:entityType/:entityId/publish', requirePermission(PERMISSIONS.WORKFLOW_PUBLISH, PERMISSIONS.CONTENT_CMS_PUBLISH), editorialWorkflow.publish);
adminRouter.post('/workflow/:entityType/:entityId/archive', requirePermission(PERMISSIONS.WORKFLOW_MANAGE), editorialWorkflow.archive);
adminRouter.get('/workflow/:entityType/:entityId/comments', requirePermission(PERMISSIONS.WORKFLOW_VIEW), editorialWorkflow.listComments);
adminRouter.post('/workflow/:entityType/:entityId/comments', requirePermission(PERMISSIONS.WORKFLOW_REVIEW), editorialWorkflow.addComment);
adminRouter.patch('/workflow/comments/:commentId', requirePermission(PERMISSIONS.WORKFLOW_REVIEW), editorialWorkflow.resolveComment);
adminRouter.get('/workflow/:entityType/:entityId/lock', requirePermission(PERMISSIONS.WORKFLOW_VIEW), editorialWorkflow.getLock);
adminRouter.post('/workflow/:entityType/:entityId/lock', requirePermission(PERMISSIONS.WORKFLOW_VIEW), editorialWorkflow.acquireLock);
adminRouter.delete('/workflow/:entityType/:entityId/lock', requirePermission(PERMISSIONS.WORKFLOW_VIEW), editorialWorkflow.releaseLock);
adminRouter.patch('/users/:userId/workflow-roles', requirePermission(PERMISSIONS.ROLES_ASSIGN), editorialWorkflow.assignUserRoles);
