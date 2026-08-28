import axiosInstance from './axiosBase';
import { adminApi } from './listingsService';

const crud = (base) => ({
  list: (params) => axiosInstance.get(base, { params }),
  get: (id) => axiosInstance.get(`${base}/${id}`),
  create: (body) => axiosInstance.post(base, body),
  update: (id, body) => axiosInstance.put(`${base}/${id}`, body),
  remove: (id) => axiosInstance.delete(`${base}/${id}`),
  duplicate: (id) => axiosInstance.post(`${base}/${id}/duplicate`),
  bulk: (action, ids) => axiosInstance.post(`${base}/bulk`, { action, ids }),
});

export const adminContentApi = {
  ...adminApi,
  listJobs: (params) => axiosInstance.get('/admin/jobs', { params }),
  getJob: (id) => axiosInstance.get(`/admin/jobs/${id}`),
  createJob: (body) => axiosInstance.post('/admin/jobs', body),
  extractJobFromDocument: (formData) =>
    axiosInstance.post('/admin/jobs/extract-from-document', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    }),
  updateJob: (id, body) => axiosInstance.put(`/admin/jobs/${id}`, body),
  deleteJob: (id) => axiosInstance.delete(`/admin/jobs/${id}`),
  duplicateJob: (id) => axiosInstance.post(`/admin/jobs/${id}/duplicate`),
  bulkJobs: (action, ids) => axiosInstance.post('/admin/jobs/bulk', { action, ids }),

  listScholarships: (params) => axiosInstance.get('/admin/scholarships', { params }),
  getScholarship: (id) => axiosInstance.get(`/admin/scholarships/${id}`),
  createScholarship: (body) => axiosInstance.post('/admin/scholarships', body),
  updateScholarship: (id, body) => axiosInstance.put(`/admin/scholarships/${id}`, body),
  deleteScholarship: (id) => axiosInstance.delete(`/admin/scholarships/${id}`),
  duplicateScholarship: (id) => axiosInstance.post(`/admin/scholarships/${id}/duplicate`),
  bulkScholarships: (action, ids) => axiosInstance.post('/admin/scholarships/bulk', { action, ids }),

  listAdmissions: (params) => axiosInstance.get('/admin/admissions', { params }),
  getAdmission: (id) => axiosInstance.get(`/admin/admissions/${id}`),
  createAdmission: (body) => axiosInstance.post('/admin/admissions', body),
  updateAdmission: (id, body) => axiosInstance.put(`/admin/admissions/${id}`, body),
  deleteAdmission: (id) => axiosInstance.delete(`/admin/admissions/${id}`),
  duplicateAdmission: (id) => axiosInstance.post(`/admin/admissions/${id}/duplicate`),
  bulkAdmissions: (action, ids) => axiosInstance.post('/admin/admissions/bulk', { action, ids }),

  blogs: crud('/admin/blogs'),
  internships: crud('/admin/internships'),
  foreignStudies: crud('/admin/foreign-studies'),
  companies: crud('/admin/companies'),
  careerArticles: crud('/admin/career-articles'),

  listIntlScholarships: (params) => axiosInstance.get('/admin/intl-scholarships', { params }),
  getIntlScholarship: (id) => axiosInstance.get(`/admin/intl-scholarships/${id}`),
  createIntlScholarship: (body) => axiosInstance.post('/admin/intl-scholarships', body),
  updateIntlScholarship: (id, body) => axiosInstance.put(`/admin/intl-scholarships/${id}`, body),
  deleteIntlScholarship: (id) => axiosInstance.delete(`/admin/intl-scholarships/${id}`),
  duplicateIntlScholarship: (id) => axiosInstance.post(`/admin/intl-scholarships/${id}/duplicate`),
  bulkIntlScholarships: (action, ids) => axiosInstance.post('/admin/intl-scholarships/bulk', { action, ids }),

  listUniversities: (params) => axiosInstance.get('/admin/universities', { params }),
  getUniversity: (id) => axiosInstance.get(`/admin/universities/${id}`),
  createUniversity: (body) => axiosInstance.post('/admin/universities', body),
  updateUniversity: (id, body) => axiosInstance.put(`/admin/universities/${id}`, body),
  deleteUniversity: (id) => axiosInstance.delete(`/admin/universities/${id}`),
  duplicateUniversity: (id) => axiosInstance.post(`/admin/universities/${id}/duplicate`),
  bulkUniversities: (action, ids) => axiosInstance.post('/admin/universities/bulk', { action, ids }),

  webinars: crud('/admin/webinars'),
  institutions: crud('/admin/institutions'),

  educationProviders: {
    list: (params) => axiosInstance.get('/admin/education/providers', { params }),
    create: (body) => axiosInstance.post('/admin/education/providers', body),
    update: (id, body) => axiosInstance.patch(`/admin/education/providers/${id}`, body),
  },
  educationTests: {
    list: (params) => axiosInstance.get('/admin/education/tests', { params }),
    get: (id) => axiosInstance.get(`/admin/education/tests/${id}`),
    create: (body) => axiosInstance.post('/admin/education/tests', body),
    update: (id, body) => axiosInstance.patch(`/admin/education/tests/${id}`, body),
  },
  educationAcceptance: {
    list: (params) => axiosInstance.get('/admin/education/acceptance', { params }),
    get: (id) => axiosInstance.get(`/admin/education/acceptance/${id}`),
    create: (body) => axiosInstance.post('/admin/education/acceptance', body),
    update: (id, body) => axiosInstance.patch(`/admin/education/acceptance/${id}`, body),
    supersede: (id, body) => axiosInstance.post(`/admin/education/acceptance/${id}/supersede`, body),
  },
  educationInstitutions: {
    list: (params) => axiosInstance.get('/admin/education/institutions', { params }),
    get: (id) => axiosInstance.get(`/admin/education/institutions/${id}`),
  },
  educationPrograms: {
    list: (params) => axiosInstance.get('/admin/education/programs', { params }),
    get: (id) => axiosInstance.get(`/admin/education/programs/${id}`),
  },

  contactMessages: {
    list: (params) => axiosInstance.get('/admin/contact-messages', { params }),
    get: (id) => axiosInstance.get(`/admin/contact-messages/${id}`),
    update: (id, body) => axiosInstance.patch(`/admin/contact-messages/${id}`, body),
    remove: (id) => axiosInstance.delete(`/admin/contact-messages/${id}`),
    exportCsv: () => axiosInstance.get('/admin/contact-messages/export', { responseType: 'blob' }),
  },
  supportTickets: {
    list: (params) => axiosInstance.get('/admin/support/tickets', { params }),
    get: (id) => axiosInstance.get(`/admin/support/tickets/${id}`),
    update: (id, body) => axiosInstance.patch(`/admin/support/tickets/${id}`, body),
    reply: (id, message) => axiosInstance.post(`/admin/support/tickets/${id}/reply`, { message }),
    close: (id) => axiosInstance.post(`/admin/support/tickets/${id}/close`),
  },
  newsletter: {
    listSubscribers: (params) => axiosInstance.get('/admin/newsletter/subscribers', { params }),
    deleteSubscriber: (id) => axiosInstance.delete(`/admin/newsletter/subscribers/${id}`),
    exportCsv: () => axiosInstance.get('/admin/newsletter/subscribers/export', { responseType: 'blob' }),
    listLogs: (params) => axiosInstance.get('/admin/newsletter/logs', { params }),
    send: (body) => axiosInstance.post('/admin/newsletter/send', body),
  },

  listUsers: (params) => axiosInstance.get('/admin/users', { params }),
  getUser: (id) => axiosInstance.get(`/admin/users/${id}`),
  updateUser: (id, body) => axiosInstance.patch(`/admin/users/${id}`, body),
  deleteUser: (id) => axiosInstance.delete(`/admin/users/${id}`),
  resetUserPassword: (id) => axiosInstance.post(`/admin/users/${id}/reset-password`),
  assignRole: (id, role) => axiosInstance.patch(`/admin/users/${id}/role`, { role }),
  bulkAssignRole: (ids, role) => axiosInstance.post('/admin/users/bulk-role', { ids, role }),
  getUserActivity: (id, params) => axiosInstance.get(`/admin/users/${id}/activity`, { params }),

  listInvitations: (params) => axiosInstance.get('/admin/invitations', { params }),
  createInvitation: (body) => axiosInstance.post('/admin/invitations', body),
  resendInvitation: (id) => axiosInstance.post(`/admin/invitations/${id}/resend`),
  revokeInvitation: (id) => axiosInstance.delete(`/admin/invitations/${id}`),

  listEmployers: (params) => axiosInstance.get('/admin/employers', { params }),
  getEmployer: (id) => axiosInstance.get(`/admin/employers/${id}`),
  getEmployerJobs: (id, params) => axiosInstance.get(`/admin/employers/${id}/jobs`, { params }),
  updateEmployer: (id, body) => axiosInstance.patch(`/admin/employers/${id}`, body),
  bulkVerifyEmployers: (ids, verificationLevel = 'verified') => axiosInstance.post('/admin/employers/bulk-verify', { ids, verificationLevel }),
  bulkSuspendEmployers: (ids, accountStatus = 'suspended') => axiosInstance.post('/admin/employers/bulk-suspend', { ids, accountStatus }),

  listPayments: (params) => axiosInstance.get('/admin/payments', { params }),
  getPayment: (id) => axiosInstance.get(`/admin/payments/${id}`),

  listNotifications: (params) => axiosInstance.get('/admin/notifications', { params }),
  createNotification: (body) => axiosInstance.post('/admin/notifications', body),
  updateNotification: (id, body) => axiosInstance.put(`/admin/notifications/${id}`, body),
  deleteNotification: (id) => axiosInstance.delete(`/admin/notifications/${id}`),

  listAdSlots: () => axiosInstance.get('/monetization/admin/ad-slots'),
  createAdSlot: (body) => axiosInstance.post('/monetization/admin/ad-slots', body),
  updateAdSlot: (id, body) => axiosInstance.put(`/monetization/admin/ad-slots/${id}`, body),
  deleteAdSlot: (id) => axiosInstance.delete(`/monetization/admin/ad-slots/${id}`),

  listExams: (params) => axiosInstance.get('/admin/exams', { params }),
  createExam: (body) => axiosInstance.post('/admin/exams', body),
  updateExam: (id, body) => axiosInstance.put(`/admin/exams/${id}`, body),
  deleteExam: (id) => axiosInstance.delete(`/admin/exams/${id}`),
  listMcqs: (params) => axiosInstance.get('/admin/mcqs', { params }),
  createMcq: (body) => axiosInstance.post('/admin/mcqs', body),
  updateMcq: (id, body) => axiosInstance.put(`/admin/mcqs/${id}`, body),
  deleteMcq: (id) => axiosInstance.delete(`/admin/mcqs/${id}`),
  listQuizzes: (params) => axiosInstance.get('/admin/quizzes', { params }),
  createQuiz: (body) => axiosInstance.post('/admin/quizzes', body),
  updateQuiz: (id, body) => axiosInstance.put(`/admin/quizzes/${id}`, body),
  deleteQuiz: (id) => axiosInstance.delete(`/admin/quizzes/${id}`),
  listPastPapers: (params) => axiosInstance.get('/admin/past-papers', { params }),
  createPastPaper: (body) => axiosInstance.post('/admin/past-papers', body),
  updatePastPaper: (id, body) => axiosInstance.put(`/admin/past-papers/${id}`, body),
  deletePastPaper: (id) => axiosInstance.delete(`/admin/past-papers/${id}`),

  reviewReport: (id, status) => axiosInstance.patch(`/admin/moderation/reports/${id}`, { status }),
  suspendListing: (type, id) => axiosInstance.post(`/admin/moderation/${type}/${id}/suspend`),

  uploadImage: (file) => {
    const form = new FormData();
    form.append('image', file);
    return axiosInstance.post('/admin/upload/image', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    });
  },

  getCmsHomepage: (locale) => axiosInstance.get('/admin/cms/homepage', { params: { locale } }),
  saveCmsHomepage: (body) => axiosInstance.put('/admin/cms/homepage', body),
  publishCmsHomepage: (locale) => axiosInstance.post(`/admin/cms/homepage/${locale}/publish`),
  previewCmsHomepage: (locale) => axiosInstance.get('/admin/cms/homepage/preview', { params: { locale } }),

  getCmsNavigation: (locale, placement) => axiosInstance.get('/admin/cms/navigation', { params: { locale, placement } }),
  saveCmsNavigation: (body) => axiosInstance.put('/admin/cms/navigation', body),
  publishCmsNavigation: (placement, locale) => axiosInstance.post(`/admin/cms/navigation/${placement}/${locale}/publish`),

  listCmsPages: (params) => axiosInstance.get('/admin/cms/pages', { params }),
  getCmsPage: (id) => axiosInstance.get(`/admin/cms/pages/${id}`),
  createCmsPage: (body) => axiosInstance.post('/admin/cms/pages', body),
  updateCmsPage: (id, body) => axiosInstance.put(`/admin/cms/pages/${id}`, body),
  deleteCmsPage: (id) => axiosInstance.delete(`/admin/cms/pages/${id}`),
  publishCmsPage: (id) => axiosInstance.post(`/admin/cms/pages/${id}/publish`),
  previewCmsPage: (id) => axiosInstance.get(`/admin/cms/pages/${id}/preview`),

  listCmsBanners: (params) => axiosInstance.get('/admin/cms/banners', { params }),
  getCmsBanner: (id) => axiosInstance.get(`/admin/cms/banners/${id}`),
  createCmsBanner: (body) => axiosInstance.post('/admin/cms/banners', body),
  updateCmsBanner: (id, body) => axiosInstance.put(`/admin/cms/banners/${id}`, body),
  deleteCmsBanner: (id) => axiosInstance.delete(`/admin/cms/banners/${id}`),

  checkSlug: (params) => axiosInstance.get('/admin/slugs/check', { params }),

  listPageLayouts: (params) => axiosInstance.get('/admin/page-layouts', { params }),
  getPageLayout: (pageKey, locale = 'en', config = {}) =>
    axiosInstance.get(`/admin/page-layouts/${encodeURIComponent(pageKey)}`, { params: { locale }, ...config }),
  savePageLayout: (body) => axiosInstance.put('/admin/page-layouts', body),
  publishPageLayout: (pageKey, locale = 'en') => axiosInstance.post(`/admin/page-layouts/${encodeURIComponent(pageKey)}/${locale}/publish`),
  previewPageLayout: (pageKey, locale = 'en') => axiosInstance.get(`/admin/page-layouts/${encodeURIComponent(pageKey)}/preview`, { params: { locale } }),

  listPageLayoutRevisions: (pageKey, locale = 'en', params = {}) =>
    axiosInstance.get(`/admin/page-layouts/${encodeURIComponent(pageKey)}/${locale}/revisions`, { params }),
  getPageLayoutRevision: (revisionId) => axiosInstance.get(`/admin/page-layouts/revisions/${revisionId}`),
  comparePageLayoutRevisions: (fromId, toId, params = {}) =>
    axiosInstance.get('/admin/page-layouts/revisions/compare', { params: { fromId, toId, ...params } }),
  previewPageLayoutRevision: (revisionId, params = {}) =>
    axiosInstance.get(`/admin/page-layouts/revisions/${revisionId}/preview`, { params }),
  restorePageLayoutRevision: (pageKey, locale, revisionId, body = {}) =>
    axiosInstance.post(`/admin/page-layouts/${encodeURIComponent(pageKey)}/${locale}/revisions/${revisionId}/restore`, body),
  deletePageLayoutRevision: (revisionId) => axiosInstance.delete(`/admin/page-layouts/revisions/${revisionId}`),

  listBlockTemplates: (params) => axiosInstance.get('/admin/block-templates', { params }),
  getBlockTemplate: (id) => axiosInstance.get(`/admin/block-templates/${id}`),
  createBlockTemplate: (body) => axiosInstance.post('/admin/block-templates', body),
  updateBlockTemplate: (id, body) => axiosInstance.put(`/admin/block-templates/${id}`, body),
  deleteBlockTemplate: (id) => axiosInstance.delete(`/admin/block-templates/${id}`),
  duplicateBlockTemplate: (id) => axiosInstance.post(`/admin/block-templates/${id}/duplicate`),

  listGlobalBlocks: (params) => axiosInstance.get('/admin/global-blocks', { params }),
  getGlobalBlocksBatch: (ids) => axiosInstance.get('/admin/global-blocks/batch', { params: { ids: ids.join(',') } }),
  getGlobalBlock: (id) => axiosInstance.get(`/admin/global-blocks/${id}`),
  getGlobalBlockUsage: (id) => axiosInstance.get(`/admin/global-blocks/${id}/usage`),
  createGlobalBlock: (body) => axiosInstance.post('/admin/global-blocks', body),
  updateGlobalBlock: (id, body) => axiosInstance.put(`/admin/global-blocks/${id}`, body),
  deleteGlobalBlock: (id, force = false) => axiosInstance.delete(`/admin/global-blocks/${id}`, { params: force ? { force: '1' } : {} }),
  duplicateGlobalBlock: (id) => axiosInstance.post(`/admin/global-blocks/${id}/duplicate`),

  listMediaAssets: (params) => axiosInstance.get('/admin/media', { params }),
  listMediaFolders: () => axiosInstance.get('/admin/media/folders'),
  getMediaAsset: (id) => axiosInstance.get(`/admin/media/${id}`),
  getMediaAssetUsage: (id) => axiosInstance.get(`/admin/media/${id}/usage`),
  updateMediaAsset: (id, body) => axiosInstance.patch(`/admin/media/${id}`, body),
  renameMediaAsset: (id, filename) => axiosInstance.post(`/admin/media/${id}/rename`, { filename }),
  deleteMediaAsset: (id, force = false) => axiosInstance.delete(`/admin/media/${id}`, { params: force ? { force: 'true' } : {} }),
  uploadMediaAssets: (files, { folder, onUploadProgress } = {}) => {
    const form = new FormData();
    for (const file of files) form.append('files', file);
    if (folder) form.append('folder', folder);
    return axiosInstance.post('/admin/media/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
      onUploadProgress,
    });
  },

  listForms: (params) => axiosInstance.get('/admin/forms', { params }),
  listPublishedForms: () => axiosInstance.get('/admin/forms/published'),
  getForm: (id) => axiosInstance.get(`/admin/forms/${id}`),
  createForm: (body) => axiosInstance.post('/admin/forms', body),
  updateForm: (id, body) => axiosInstance.put(`/admin/forms/${id}`, body),
  deleteForm: (id) => axiosInstance.delete(`/admin/forms/${id}`),
  duplicateForm: (id) => axiosInstance.post(`/admin/forms/${id}/duplicate`),
  listFormSubmissions: (params) => axiosInstance.get('/admin/forms/submissions', { params }),
  getFormSubmission: (id) => axiosInstance.get(`/admin/forms/submissions/${id}`),
  patchFormSubmission: (id, body) => axiosInstance.patch(`/admin/forms/submissions/${id}`, body),
  deleteFormSubmission: (id) => axiosInstance.delete(`/admin/forms/submissions/${id}`),
  exportFormSubmissions: (params) => axiosInstance.get('/admin/forms/submissions/export', { params, responseType: 'blob' }),

  getTranslationGroup: (entityType, id) =>
    axiosInstance.get(`/admin/translations/${entityType}/${id}/group`),
  createTranslation: (entityType, id, body) =>
    axiosInstance.post(`/admin/translations/${entityType}/${id}`, body),
  findTranslationEquivalent: (entityType, id, locale) =>
    axiosInstance.get(`/admin/translations/${entityType}/${id}/equivalent`, { params: { locale } }),
};
