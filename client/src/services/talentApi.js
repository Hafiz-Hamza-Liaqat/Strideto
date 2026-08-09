import axiosInstance from './axiosBase';

export const talentApi = {
  getMe: () => axiosInstance.get('/talent/me'),
  createMe: (body) => axiosInstance.post('/talent/me', body),
  updateMe: (body) => axiosInstance.patch('/talent/me', body),
  deleteMe: () => axiosInstance.delete('/talent/me'),

  listResumeVersions: () => axiosInstance.get('/talent/me/resume-versions'),
  getResumeVersion: (id) => axiosInstance.get(`/talent/me/resume-versions/${id}`),
  createResumeVersion: (body) => axiosInstance.post('/talent/me/resume-versions', body),
  updateResumeVersion: (id, body) => axiosInstance.patch(`/talent/me/resume-versions/${id}`, body),
  deleteResumeVersion: (id) => axiosInstance.delete(`/talent/me/resume-versions/${id}`),
  publishResumeVersion: (id) => axiosInstance.post(`/talent/me/resume-versions/${id}/publish`),

  listDocuments: () => axiosInstance.get('/talent/me/documents'),
  createDocument: (body) => axiosInstance.post('/talent/me/documents', body),
  updateDocument: (id, body) => axiosInstance.patch(`/talent/me/documents/${id}`, body),
  deleteDocument: (id) => axiosInstance.delete(`/talent/me/documents/${id}`),
  uploadDocument: (formData) => axiosInstance.post('/talent/me/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),

  listCredentials: () => axiosInstance.get('/talent/me/credentials'),

  getResumeBuilder: () => axiosInstance.get('/talent/me/resume-builder'),
  saveResumeBuilder: (body) => axiosInstance.put('/talent/me/resume-builder', body),
  getSummary: () => axiosInstance.get('/talent/me/summary'),
  getApplyKit: () => axiosInstance.get('/talent/me/apply-kit'),
  getPrefill: () => axiosInstance.get('/talent/me/prefill'),
  getCandidateCard: () => axiosInstance.get('/talent/me/candidate-card'),

  // Mission 3 — student profile
  getCompleteness: () => axiosInstance.get('/talent/me/completeness'),

  // Education
  addEducation: (body) => axiosInstance.post('/talent/me/education', body),
  updateEducation: (id, body) => axiosInstance.patch(`/talent/me/education/${id}`, body),
  deleteEducation: (id) => axiosInstance.delete(`/talent/me/education/${id}`),

  // Experience
  addExperience: (body) => axiosInstance.post('/talent/me/experience', body),
  updateExperience: (id, body) => axiosInstance.patch(`/talent/me/experience/${id}`, body),
  deleteExperience: (id) => axiosInstance.delete(`/talent/me/experience/${id}`),

  // Exam scores
  listExamScores: () => axiosInstance.get('/talent/me/exam-scores'),
  addExamScore: (body) => axiosInstance.post('/talent/me/exam-scores', body),
  updateExamScore: (id, body) => axiosInstance.patch(`/talent/me/exam-scores/${id}`, body),
  deleteExamScore: (id) => axiosInstance.delete(`/talent/me/exam-scores/${id}`),

  // Study goals
  listStudyGoals: () => axiosInstance.get('/talent/me/study-goals'),
  addStudyGoal: (body) => axiosInstance.post('/talent/me/study-goals', body),
  updateStudyGoal: (id, body) => axiosInstance.patch(`/talent/me/study-goals/${id}`, body),
  deleteStudyGoal: (id) => axiosInstance.delete(`/talent/me/study-goals/${id}`),

  // Certifications
  listCertifications: () => axiosInstance.get('/talent/me/certifications'),
  addCertification: (body) => axiosInstance.post('/talent/me/certifications', body),
  updateCertification: (id, body) => axiosInstance.patch(`/talent/me/certifications/${id}`, body),
  deleteCertification: (id) => axiosInstance.delete(`/talent/me/certifications/${id}`),

  // Student preferences & budget
  getStudentPreferences: () => axiosInstance.get('/talent/me/student-preferences'),
  updateStudentPreferences: (body) => axiosInstance.put('/talent/me/student-preferences', body),
  getBudget: () => axiosInstance.get('/talent/me/budget'),
  updateBudget: (body) => axiosInstance.put('/talent/me/budget', body),
};
