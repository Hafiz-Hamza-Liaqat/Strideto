import { Router } from 'express';
import { requireAuth, requireUserAuth } from '../middleware/auth.js';
import { requireStaff } from '../middleware/rbac.js';
import {
  getMyTalentProfile,
  createMyTalentProfile,
  updateMyTalentProfile,
  deleteMyTalentProfile,
  requireTalentProfileEnabled,
} from '../controllers/career/talentProfileController.js';
import {
  listMyResumeVersions,
  getResumeVersion,
  createResumeVersion,
  updateResumeVersion,
  deleteResumeVersion,
  publishResumeVersion,
} from '../controllers/career/resumeVersionController.js';
import {
  listMyProfileDocuments,
  createProfileDocument,
  updateProfileDocument,
  deleteProfileDocument,
  listMyCredentials,
  getCredential,
} from '../controllers/career/profileDocumentController.js';
import { runTalentHydration, hydrateSingleUser } from '../controllers/career/talentHydrationController.js';
import { uploadProfileDocument } from '../controllers/career/profileDocumentUploadController.js';
import {
  getResumeBuilderView,
  saveResumeBuilderView,
  getMyProfileSummary,
  getMyApplyKit,
  getMyFormPrefill,
  getMyCandidateCard,
} from '../controllers/career/profileAdoptionController.js';
// Mission 3 — student profile child-record CRUD + completeness
import {
  getMyStudentCompleteness,
  addEducation,
  updateEducation,
  removeEducation,
  addExperience,
  updateExperience,
  removeExperience,
  listExamScores,
  addExamScore,
  updateExamScore,
  removeExamScore,
  listStudyGoals,
  addStudyGoal,
  updateStudyGoal,
  removeStudyGoal,
  listCertifications,
  addCertification,
  updateCertification,
  removeCertification,
  getStudentPreferences,
  updateStudentPreferences,
  getBudgetProfile,
  updateBudgetProfile,
} from '../controllers/career/studentProfileController.js';
import { uploadResume } from '../middleware/upload.js';
import { uploadLimiter } from '../middleware/rateLimit.js';

export const talentRouter = Router();

const talentAuth = [requireAuth, requireUserAuth, requireTalentProfileEnabled];

// Talent profile
talentRouter.get('/talent/me', ...talentAuth, getMyTalentProfile);
talentRouter.post('/talent/me', ...talentAuth, createMyTalentProfile);
talentRouter.patch('/talent/me', ...talentAuth, updateMyTalentProfile);
talentRouter.delete('/talent/me', ...talentAuth, deleteMyTalentProfile);

// Resume versions
talentRouter.get('/talent/me/resume-versions', ...talentAuth, listMyResumeVersions);
talentRouter.post('/talent/me/resume-versions', ...talentAuth, createResumeVersion);
talentRouter.get('/talent/me/resume-versions/:id', ...talentAuth, getResumeVersion);
talentRouter.patch('/talent/me/resume-versions/:id', ...talentAuth, updateResumeVersion);
talentRouter.delete('/talent/me/resume-versions/:id', ...talentAuth, deleteResumeVersion);
talentRouter.post('/talent/me/resume-versions/:id/publish', ...talentAuth, publishResumeVersion);

// Profile documents
talentRouter.get('/talent/me/documents', ...talentAuth, listMyProfileDocuments);
talentRouter.post('/talent/me/documents', ...talentAuth, createProfileDocument);
talentRouter.post('/talent/me/documents/upload', ...talentAuth, uploadLimiter, (req, res, next) => {
  uploadResume(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'File upload failed' });
    next();
  });
}, uploadProfileDocument);
talentRouter.patch('/talent/me/documents/:id', ...talentAuth, updateProfileDocument);
talentRouter.delete('/talent/me/documents/:id', ...talentAuth, deleteProfileDocument);

// Credentials (read-only in C.8.0.2A)
talentRouter.get('/talent/me/credentials', ...talentAuth, listMyCredentials);
talentRouter.get('/talent/me/credentials/:id', ...talentAuth, getCredential);

// Platform adoption (C.8.0.2B.2)
talentRouter.get('/talent/me/resume-builder', ...talentAuth, getResumeBuilderView);
talentRouter.put('/talent/me/resume-builder', ...talentAuth, saveResumeBuilderView);
talentRouter.get('/talent/me/summary', ...talentAuth, getMyProfileSummary);
talentRouter.get('/talent/me/apply-kit', ...talentAuth, getMyApplyKit);
talentRouter.get('/talent/me/prefill', ...talentAuth, getMyFormPrefill);
talentRouter.get('/talent/me/candidate-card', ...talentAuth, getMyCandidateCard);

// Mission 3 — student profile completeness
talentRouter.get('/talent/me/completeness', ...talentAuth, getMyStudentCompleteness);

// Mission 3 — education child-record CRUD
talentRouter.post('/talent/me/education', ...talentAuth, addEducation);
talentRouter.patch('/talent/me/education/:id', ...talentAuth, updateEducation);
talentRouter.delete('/talent/me/education/:id', ...talentAuth, removeEducation);

// Mission 3 — experience child-record CRUD
talentRouter.post('/talent/me/experience', ...talentAuth, addExperience);
talentRouter.patch('/talent/me/experience/:id', ...talentAuth, updateExperience);
talentRouter.delete('/talent/me/experience/:id', ...talentAuth, removeExperience);

// Mission 3 — exam scores
talentRouter.get('/talent/me/exam-scores', ...talentAuth, listExamScores);
talentRouter.post('/talent/me/exam-scores', ...talentAuth, addExamScore);
talentRouter.patch('/talent/me/exam-scores/:id', ...talentAuth, updateExamScore);
talentRouter.delete('/talent/me/exam-scores/:id', ...talentAuth, removeExamScore);

// Mission 3 — study goals
talentRouter.get('/talent/me/study-goals', ...talentAuth, listStudyGoals);
talentRouter.post('/talent/me/study-goals', ...talentAuth, addStudyGoal);
talentRouter.patch('/talent/me/study-goals/:id', ...talentAuth, updateStudyGoal);
talentRouter.delete('/talent/me/study-goals/:id', ...talentAuth, removeStudyGoal);

// Mission 3 — certifications
talentRouter.get('/talent/me/certifications', ...talentAuth, listCertifications);
talentRouter.post('/talent/me/certifications', ...talentAuth, addCertification);
talentRouter.patch('/talent/me/certifications/:id', ...talentAuth, updateCertification);
talentRouter.delete('/talent/me/certifications/:id', ...talentAuth, removeCertification);

// Mission 3 — student preferences (single subdoc)
talentRouter.get('/talent/me/student-preferences', ...talentAuth, getStudentPreferences);
talentRouter.put('/talent/me/student-preferences', ...talentAuth, updateStudentPreferences);

// Mission 3 — budget profile (single subdoc)
talentRouter.get('/talent/me/budget', ...talentAuth, getBudgetProfile);
talentRouter.put('/talent/me/budget', ...talentAuth, updateBudgetProfile);

// Staff hydration (backend migration)
talentRouter.post('/admin/talent/hydrate', requireAuth, requireStaff, runTalentHydration);
talentRouter.post('/admin/talent/hydrate/:userId', requireAuth, requireStaff, hydrateSingleUser);
