import axiosInstance from './axiosBase';

/** OpportunityApplication API (C.8.0.3A / C.8.1 tracker). */
export const applicationsApi = {
  list: (params) => axiosInstance.get('/applications', { params }),
  getMetrics: () => axiosInstance.get('/applications/metrics'),
  getStageTemplates: () => axiosInstance.get('/applications/stage-templates'),
  getById: (id) => axiosInstance.get(`/applications/${id}`),
  create: (body) => axiosInstance.post('/applications', body),
  update: (id, body) => axiosInstance.patch(`/applications/${id}`, body),
  archive: (id) => axiosInstance.delete(`/applications/${id}`),
  transitionStage: (id, body) => axiosInstance.post(`/applications/${id}/stage`, body),
  addNote: (id, body) => axiosInstance.post(`/applications/${id}/notes`, body),
  attachDocument: (id, body) => axiosInstance.post(`/applications/${id}/documents`, body),
  removeDocument: (id, documentId) => axiosInstance.delete(`/applications/${id}/documents/${documentId}`),
  addReminder: (id, body) => axiosInstance.post(`/applications/${id}/reminders`, body),
  updateReminder: (id, reminderId, body) => axiosInstance.patch(`/applications/${id}/reminders/${reminderId}`, body),
  removeReminder: (id, reminderId) => axiosInstance.delete(`/applications/${id}/reminders/${reminderId}`),
  addContact: (id, body) => axiosInstance.post(`/applications/${id}/contacts`, body),
  removeContact: (id, contactId) => axiosInstance.delete(`/applications/${id}/contacts/${contactId}`),
  upsertInterview: (id, body) => axiosInstance.put(`/applications/${id}/interview`, body),
  listCommunication: (id, params) => axiosInstance.get(`/applications/${id}/communication`, { params }),
  sendCommunicationMessage: (id, body) =>
    axiosInstance.post(`/applications/${id}/communication/messages`, body),
  respondInterviewInvitation: (id, invitationId, body) =>
    axiosInstance.post(`/applications/${id}/communication/interview-invitations/${invitationId}/respond`, body),
  respondApplicationOffer: (id, offerId, body) =>
    axiosInstance.post(`/applications/${id}/offers/${offerId}/respond`, body),
};

/** Internal Institution admissions (Phase 6). User realm only. */
export const studentInstitutionAdmissionApi = {
  submit: (data) => axiosInstance.post('/student/institution-admissions', data),
  list: (params) => axiosInstance.get('/student/institution-admissions', { params }),
  withdraw: (applicationId) => axiosInstance.post(`/student/institution-admissions/${encodeURIComponent(applicationId)}/withdraw`),
  respond: (applicationId, response) => axiosInstance.post(`/student/institution-admissions/${encodeURIComponent(applicationId)}/respond`, { response }),
};
