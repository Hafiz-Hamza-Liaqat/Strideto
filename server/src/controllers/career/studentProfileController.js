/**
 * Strideto Mission 3 — Student Profile child-record CRUD controllers.
 *
 * These controllers handle per-record operations on TalentProfile's student-
 * specific arrays (examScores, studyGoals, certificationReferences) and the
 * single subdocuments (studentPreferences, budgetProfile). They also serve
 * the completeness endpoint.
 *
 * Authorization: every handler verifies ownership via req.user.userId before
 * reading or mutating data.
 */
import { asyncHandler } from '../../utils/asyncHandler.js';
import { TalentProfileService } from '../../services/career/TalentProfileService.js';
import {
  parseExamScoreEntry,
  validateExamScoreEntry,
  parseStudyGoalEntry,
  validateStudyGoalEntry,
  parseStudentPreferences,
  validateStudentPreferences,
  parseBudgetProfile,
  validateBudgetProfile,
  parseEducationEntry,
  validateEducationEntry,
  parseExperienceEntry,
  validateExperienceEntry,
} from '../../../../shared/career/studentProfileValidation.js';
import { computeStudentProfileCompleteness } from '../../../../shared/career/studentProfileValidation.js';

// Max sizes match TalentProfile schema / validation contract
const ARRAY_LIMITS = {
  education: 30,
  experience: 30,
  examScores: 30,
  studyGoals: 20,
  certificationReferences: 30,
  skills: 200,
};

function validationError(errors) {
  const err = new Error(errors.join('; '));
  err.status = 400;
  err.details = errors;
  return err;
}

function notFoundError(resource = 'Record') {
  const err = new Error(`${resource} not found`);
  err.status = 404;
  return err;
}

function actorFromReq(req) {
  return { type: 'talent', id: String(req.user.userId) };
}

/**
 * Build a safe student-profile projection (excludes nothing sensitive at this
 * layer — privacy projection is applied when sharing with third parties, not
 * on own-profile access).
 */
function safeOwnProjection(profile) {
  if (!profile) return null;
  // All fields are readable by the owner. Agents/employers get a restricted view (Mission 11+).
  return profile;
}

// -----------------------------------------------------------------------
// GET /talent/me/completeness
// -----------------------------------------------------------------------

export const getMyStudentCompleteness = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const profile = await TalentProfileService.getByUserId(userId);
  const result = computeStudentProfileCompleteness({ profile: profile || {}, user: req.user });
  res.json(result);
});

// -----------------------------------------------------------------------
// Education child-record CRUD
// -----------------------------------------------------------------------

export const addEducation = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const profile = await TalentProfileService.getByUserId(userId);
  if (!profile) throw notFoundError('Profile');

  const parsed = parseEducationEntry(req.body);
  const errors = validateEducationEntry(parsed);
  if (errors.length) throw validationError(errors);

  const current = profile.education || [];
  if (current.length >= ARRAY_LIMITS.education) {
    throw validationError([`Cannot exceed ${ARRAY_LIMITS.education} education records`]);
  }

  const updated = await TalentProfileService.update(
    userId,
    { education: [...current, parsed] },
    actorFromReq(req),
    { skipDualWrite: false }
  );
  const added = (updated.education || []).at(-1);
  res.status(201).json(added);
});

export const updateEducation = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const profile = await TalentProfileService.getByUserId(userId);
  if (!profile) throw notFoundError('Profile');

  const { id } = req.params;
  const idx = (profile.education || []).findIndex((e) => String(e._id) === id);
  if (idx === -1) throw notFoundError('Education record');

  const parsed = parseEducationEntry({ ...profile.education[idx], ...req.body, _id: id });
  const errors = validateEducationEntry(parsed);
  if (errors.length) throw validationError(errors);

  const newEd = [...profile.education];
  newEd[idx] = parsed;
  const updated = await TalentProfileService.update(userId, { education: newEd }, actorFromReq(req));
  res.json((updated.education || []).find((e) => String(e._id) === id));
});

export const removeEducation = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const profile = await TalentProfileService.getByUserId(userId);
  if (!profile) throw notFoundError('Profile');

  const { id } = req.params;
  const newEd = (profile.education || []).filter((e) => String(e._id) !== id);
  if (newEd.length === (profile.education || []).length) throw notFoundError('Education record');

  await TalentProfileService.update(userId, { education: newEd }, actorFromReq(req));
  res.json({ ok: true });
});

// -----------------------------------------------------------------------
// Experience child-record CRUD
// -----------------------------------------------------------------------

export const addExperience = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const profile = await TalentProfileService.getByUserId(userId);
  if (!profile) throw notFoundError('Profile');

  const parsed = parseExperienceEntry(req.body);
  const errors = validateExperienceEntry(parsed);
  if (errors.length) throw validationError(errors);

  const current = profile.experience || [];
  if (current.length >= ARRAY_LIMITS.experience) {
    throw validationError([`Cannot exceed ${ARRAY_LIMITS.experience} experience records`]);
  }

  const updated = await TalentProfileService.update(
    userId,
    { experience: [...current, parsed] },
    actorFromReq(req)
  );
  res.status(201).json((updated.experience || []).at(-1));
});

export const updateExperience = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const profile = await TalentProfileService.getByUserId(userId);
  if (!profile) throw notFoundError('Profile');

  const { id } = req.params;
  const idx = (profile.experience || []).findIndex((e) => String(e._id) === id);
  if (idx === -1) throw notFoundError('Experience record');

  const parsed = parseExperienceEntry({ ...profile.experience[idx], ...req.body, _id: id });
  const errors = validateExperienceEntry(parsed);
  if (errors.length) throw validationError(errors);

  const newExp = [...profile.experience];
  newExp[idx] = parsed;
  const updated = await TalentProfileService.update(userId, { experience: newExp }, actorFromReq(req));
  res.json((updated.experience || []).find((e) => String(e._id) === id));
});

export const removeExperience = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const profile = await TalentProfileService.getByUserId(userId);
  if (!profile) throw notFoundError('Profile');

  const { id } = req.params;
  const newExp = (profile.experience || []).filter((e) => String(e._id) !== id);
  if (newExp.length === (profile.experience || []).length) throw notFoundError('Experience record');

  await TalentProfileService.update(userId, { experience: newExp }, actorFromReq(req));
  res.json({ ok: true });
});

// -----------------------------------------------------------------------
// Exam scores child-record CRUD
// -----------------------------------------------------------------------

export const listExamScores = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const profile = await TalentProfileService.getByUserId(userId);
  res.json((profile?.examScores) || []);
});

export const addExamScore = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const profile = await TalentProfileService.getByUserId(userId);
  if (!profile) throw notFoundError('Profile');

  const parsed = parseExamScoreEntry(req.body);
  const errors = validateExamScoreEntry(parsed);
  if (errors.length) throw validationError(errors);

  const current = profile.examScores || [];
  if (current.length >= ARRAY_LIMITS.examScores) {
    throw validationError([`Cannot exceed ${ARRAY_LIMITS.examScores} exam score records`]);
  }

  const updated = await TalentProfileService.update(
    userId,
    { examScores: [...current, parsed] },
    actorFromReq(req)
  );
  res.status(201).json((updated.examScores || []).at(-1));
});

export const updateExamScore = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const profile = await TalentProfileService.getByUserId(userId);
  if (!profile) throw notFoundError('Profile');

  const { id } = req.params;
  const idx = (profile.examScores || []).findIndex((e) => String(e._id) === id);
  if (idx === -1) throw notFoundError('Exam score record');

  const parsed = parseExamScoreEntry({ ...profile.examScores[idx], ...req.body, _id: id });
  const errors = validateExamScoreEntry(parsed);
  if (errors.length) throw validationError(errors);

  const newScores = [...profile.examScores];
  newScores[idx] = parsed;
  const updated = await TalentProfileService.update(userId, { examScores: newScores }, actorFromReq(req));
  res.json((updated.examScores || []).find((e) => String(e._id) === id));
});

export const removeExamScore = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const profile = await TalentProfileService.getByUserId(userId);
  if (!profile) throw notFoundError('Profile');

  const { id } = req.params;
  const newScores = (profile.examScores || []).filter((e) => String(e._id) !== id);
  if (newScores.length === (profile.examScores || []).length) throw notFoundError('Exam score record');

  await TalentProfileService.update(userId, { examScores: newScores }, actorFromReq(req));
  res.json({ ok: true });
});

// -----------------------------------------------------------------------
// Study goals child-record CRUD
// -----------------------------------------------------------------------

export const listStudyGoals = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const profile = await TalentProfileService.getByUserId(userId);
  res.json((profile?.studyGoals) || []);
});

export const addStudyGoal = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const profile = await TalentProfileService.getByUserId(userId);
  if (!profile) throw notFoundError('Profile');

  const parsed = parseStudyGoalEntry(req.body);
  const errors = validateStudyGoalEntry(parsed);
  if (errors.length) throw validationError(errors);

  const current = profile.studyGoals || [];
  if (current.length >= ARRAY_LIMITS.studyGoals) {
    throw validationError([`Cannot exceed ${ARRAY_LIMITS.studyGoals} goal records`]);
  }

  const updated = await TalentProfileService.update(
    userId,
    { studyGoals: [...current, parsed] },
    actorFromReq(req)
  );
  res.status(201).json((updated.studyGoals || []).at(-1));
});

export const updateStudyGoal = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const profile = await TalentProfileService.getByUserId(userId);
  if (!profile) throw notFoundError('Profile');

  const { id } = req.params;
  const idx = (profile.studyGoals || []).findIndex((g) => String(g._id) === id);
  if (idx === -1) throw notFoundError('Study goal record');

  const parsed = parseStudyGoalEntry({ ...profile.studyGoals[idx], ...req.body, _id: id });
  const errors = validateStudyGoalEntry(parsed);
  if (errors.length) throw validationError(errors);

  const newGoals = [...profile.studyGoals];
  newGoals[idx] = parsed;
  const updated = await TalentProfileService.update(userId, { studyGoals: newGoals }, actorFromReq(req));
  res.json((updated.studyGoals || []).find((g) => String(g._id) === id));
});

export const removeStudyGoal = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const profile = await TalentProfileService.getByUserId(userId);
  if (!profile) throw notFoundError('Profile');

  const { id } = req.params;
  const newGoals = (profile.studyGoals || []).filter((g) => String(g._id) !== id);
  if (newGoals.length === (profile.studyGoals || []).length) throw notFoundError('Study goal record');

  await TalentProfileService.update(userId, { studyGoals: newGoals }, actorFromReq(req));
  res.json({ ok: true });
});

// -----------------------------------------------------------------------
// Certifications child-record CRUD
// -----------------------------------------------------------------------

export const listCertifications = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const profile = await TalentProfileService.getByUserId(userId);
  res.json((profile?.certificationReferences) || []);
});

export const addCertification = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const profile = await TalentProfileService.getByUserId(userId);
  if (!profile) throw notFoundError('Profile');

  const current = profile.certificationReferences || [];
  if (current.length >= ARRAY_LIMITS.certificationReferences) {
    throw validationError([`Cannot exceed ${ARRAY_LIMITS.certificationReferences} certification records`]);
  }
  const entry = {
    name: String(req.body.name || '').trim().slice(0, 200),
    issuer: String(req.body.issuer || '').trim().slice(0, 200),
    issuedAt: req.body.issuedAt ? new Date(req.body.issuedAt) : undefined,
    expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : undefined,
    externalUrl: String(req.body.externalUrl || '').trim().slice(0, 2000),
  };

  const updated = await TalentProfileService.update(
    userId,
    { certificationReferences: [...current, entry] },
    actorFromReq(req)
  );
  res.status(201).json((updated.certificationReferences || []).at(-1));
});

export const updateCertification = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const profile = await TalentProfileService.getByUserId(userId);
  if (!profile) throw notFoundError('Profile');

  const { id } = req.params;
  const idx = (profile.certificationReferences || []).findIndex((c) => String(c._id) === id);
  if (idx === -1) throw notFoundError('Certification record');

  const existing = profile.certificationReferences[idx];
  const merged = {
    ...existing,
    name: req.body.name !== undefined ? String(req.body.name).trim().slice(0, 200) : existing.name,
    issuer: req.body.issuer !== undefined ? String(req.body.issuer).trim().slice(0, 200) : existing.issuer,
    issuedAt: req.body.issuedAt !== undefined ? new Date(req.body.issuedAt) : existing.issuedAt,
    expiresAt: req.body.expiresAt !== undefined ? new Date(req.body.expiresAt) : existing.expiresAt,
    externalUrl: req.body.externalUrl !== undefined
      ? String(req.body.externalUrl).trim().slice(0, 2000)
      : existing.externalUrl,
    _id: id,
  };

  const newCerts = [...profile.certificationReferences];
  newCerts[idx] = merged;
  const updated = await TalentProfileService.update(
    userId,
    { certificationReferences: newCerts },
    actorFromReq(req)
  );
  res.json((updated.certificationReferences || []).find((c) => String(c._id) === id));
});

export const removeCertification = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const profile = await TalentProfileService.getByUserId(userId);
  if (!profile) throw notFoundError('Profile');

  const { id } = req.params;
  const newCerts = (profile.certificationReferences || []).filter((c) => String(c._id) !== id);
  if (newCerts.length === (profile.certificationReferences || []).length) throw notFoundError('Certification record');

  await TalentProfileService.update(userId, { certificationReferences: newCerts }, actorFromReq(req));
  res.json({ ok: true });
});

// -----------------------------------------------------------------------
// Student preferences (single subdocument)
// -----------------------------------------------------------------------

export const getStudentPreferences = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const profile = await TalentProfileService.getByUserId(userId);
  res.json(profile?.studentPreferences || {});
});

export const updateStudentPreferences = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const profile = await TalentProfileService.getByUserId(userId);
  if (!profile) throw notFoundError('Profile');

  const parsed = parseStudentPreferences(req.body);
  const errors = validateStudentPreferences(parsed);
  if (errors.length) throw validationError(errors);

  const updated = await TalentProfileService.update(
    userId,
    { studentPreferences: parsed },
    actorFromReq(req)
  );
  res.json(updated.studentPreferences);
});

// -----------------------------------------------------------------------
// Budget profile (single subdocument)
// -----------------------------------------------------------------------

export const getBudgetProfile = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const profile = await TalentProfileService.getByUserId(userId);
  res.json(profile?.budgetProfile || {});
});

export const updateBudgetProfile = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const profile = await TalentProfileService.getByUserId(userId);
  if (!profile) throw notFoundError('Profile');

  const parsed = parseBudgetProfile(req.body);
  const errors = validateBudgetProfile(parsed);
  if (errors.length) throw validationError(errors);

  const updated = await TalentProfileService.update(
    userId,
    { budgetProfile: parsed },
    actorFromReq(req)
  );
  res.json(updated.budgetProfile);
});
