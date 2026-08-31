import { Exam } from '../../models/Exam.js';
import { PastPaper } from '../../models/PastPaper.js';
import { Quiz } from '../../models/Quiz.js';
import { Mcq } from '../../models/Mcq.js';
import { QuizAttempt } from '../../models/QuizAttempt.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sanitizeString } from '../../utils/sanitize.js';
import { examSlug } from '../../utils/slugify.js';

export function legacyExamCreationDisabled(_req, res) {
  return res.status(410).json({
    error: 'Legacy exam-preparation authoring is deprecated. Use the canonical international Tests catalog.',
    code: 'LEGACY_EXAM_AUTHORING_DISABLED',
  });
}

export const listExams = asyncHandler(async (req, res) => {
  const q = req.query || {};
  const filter = {};
  if (q.status) filter.status = q.status;
  if (q.search) filter.$or = [{ name: new RegExp(sanitizeString(q.search), 'i') }, { code: new RegExp(sanitizeString(q.search), 'i') }];
  const data = await Exam.find(filter).sort({ name: 1 }).lean();
  res.json({ data });
});

export const createExam = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const name = sanitizeString(body.name);
  if (!name) return res.status(400).json({ error: 'name is required' });
  const slug = body.slug || examSlug(name);
  const doc = await Exam.create({
    name,
    slug,
    code: body.code ? sanitizeString(body.code) : undefined,
    description: body.description ? sanitizeString(body.description) : undefined,
    syllabus: body.syllabus ? sanitizeString(body.syllabus) : undefined,
    authority: body.authority ? sanitizeString(body.authority) : undefined,
    status: body.status || 'active',
  });
  res.status(201).json(doc);
});

export const updateExam = asyncHandler(async (req, res) => {
  const doc = await Exam.findByIdAndUpdate(req.params.id, {
    ...(req.body.name !== undefined && { name: sanitizeString(req.body.name) }),
    ...(req.body.slug !== undefined && { slug: sanitizeString(req.body.slug) }),
    ...(req.body.code !== undefined && { code: sanitizeString(req.body.code) }),
    ...(req.body.description !== undefined && { description: sanitizeString(req.body.description) }),
    ...(req.body.syllabus !== undefined && { syllabus: sanitizeString(req.body.syllabus) }),
    ...(req.body.authority !== undefined && { authority: sanitizeString(req.body.authority) }),
    ...(req.body.status !== undefined && { status: req.body.status }),
  }, { new: true });
  if (!doc) return res.status(404).json({ error: 'Exam not found' });
  res.json(doc);
});

export const removeExam = asyncHandler(async (req, res) => {
  const doc = await Exam.findByIdAndDelete(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Exam not found' });
  res.json({ deleted: true });
});

export const listPastPapers = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.examId) filter.examId = req.query.examId;
  if (req.query.status) filter.status = req.query.status;
  const data = await PastPaper.find(filter).populate('examId', 'name').sort({ year: -1 }).lean();
  res.json({ data });
});

export const createPastPaper = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const examId = body.examId;
  if (!examId) return res.status(400).json({ error: 'examId is required' });
  const doc = await PastPaper.create({
    examId,
    title: sanitizeString(body.title || ''),
    year: body.year ? parseInt(body.year, 10) : undefined,
    subject: body.subject ? sanitizeString(body.subject) : undefined,
    fileUrl: body.fileUrl ? sanitizeString(body.fileUrl) : undefined,
    link: body.link ? sanitizeString(body.link) : undefined,
    status: body.status || 'active',
  });
  res.status(201).json(doc);
});

export const updatePastPaper = asyncHandler(async (req, res) => {
  const doc = await PastPaper.findByIdAndUpdate(req.params.id, {
    ...(req.body.title !== undefined && { title: sanitizeString(req.body.title) }),
    ...(req.body.year !== undefined && { year: parseInt(req.body.year, 10) }),
    ...(req.body.subject !== undefined && { subject: sanitizeString(req.body.subject) }),
    ...(req.body.fileUrl !== undefined && { fileUrl: sanitizeString(req.body.fileUrl) }),
    ...(req.body.link !== undefined && { link: sanitizeString(req.body.link) }),
    ...(req.body.status !== undefined && { status: req.body.status }),
  }, { new: true });
  if (!doc) return res.status(404).json({ error: 'Past paper not found' });
  res.json(doc);
});

export const removePastPaper = asyncHandler(async (req, res) => {
  const doc = await PastPaper.findByIdAndDelete(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Past paper not found' });
  res.json({ deleted: true });
});

export const listMcqs = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.examId) filter.examId = req.query.examId;
  if (req.query.quizId) filter.quizId = req.query.quizId;
  if (req.query.status) filter.status = req.query.status;
  const data = await Mcq.find(filter).sort({ createdAt: 1 }).lean();
  res.json({ data });
});

export const createMcq = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const question = sanitizeString(body.question || '');
  const options = Array.isArray(body.options) ? body.options.map(sanitizeString).filter(Boolean) : [];
  const correctIndex = parseInt(body.correctIndex, 10);
  if (!question || options.length < 2 || isNaN(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
    return res.status(400).json({ error: 'question, options (array), and correctIndex (0-based) required' });
  }
  const doc = await Mcq.create({
    examId: body.examId || undefined,
    quizId: body.quizId || undefined,
    question,
    options,
    correctIndex,
    subject: body.subject ? sanitizeString(body.subject) : undefined,
    status: body.status || 'active',
  });
  res.status(201).json(doc);
});

export const updateMcq = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const update = {};
  if (body.question !== undefined) update.question = sanitizeString(body.question);
  if (body.options !== undefined) update.options = Array.isArray(body.options) ? body.options.map(sanitizeString).filter(Boolean) : undefined;
  if (body.correctIndex !== undefined) update.correctIndex = parseInt(body.correctIndex, 10);
  if (body.subject !== undefined) update.subject = sanitizeString(body.subject);
  if (body.status !== undefined) update.status = body.status;
  if (body.quizId !== undefined) update.quizId = body.quizId || undefined;
  if (body.examId !== undefined) update.examId = body.examId || undefined;
  const doc = await Mcq.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!doc) return res.status(404).json({ error: 'MCQ not found' });
  res.json(doc);
});

export const removeMcq = asyncHandler(async (req, res) => {
  const doc = await Mcq.findByIdAndDelete(req.params.id);
  if (!doc) return res.status(404).json({ error: 'MCQ not found' });
  res.json({ deleted: true });
});

export const listQuizzes = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.examId) filter.examId = req.query.examId;
  if (req.query.status) filter.status = req.query.status;
  const data = await Quiz.find(filter).populate('examId', 'name').sort({ createdAt: -1 }).lean();
  res.json({ data });
});

export const createQuiz = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const examId = body.examId;
  const title = sanitizeString(body.title || '');
  if (!examId || !title) return res.status(400).json({ error: 'examId and title required' });
  const doc = await Quiz.create({
    examId,
    title,
    slug: body.slug || examSlug(title) + '-' + Date.now(),
    description: body.description ? sanitizeString(body.description) : undefined,
    durationMinutes: body.durationMinutes ? parseInt(body.durationMinutes, 10) : 30,
    totalQuestions: 0,
    status: body.status || 'active',
  });
  res.status(201).json(doc);
});

export const updateQuiz = asyncHandler(async (req, res) => {
  const doc = await Quiz.findByIdAndUpdate(req.params.id, {
    ...(req.body.title !== undefined && { title: sanitizeString(req.body.title) }),
    ...(req.body.description !== undefined && { description: sanitizeString(req.body.description) }),
    ...(req.body.durationMinutes !== undefined && { durationMinutes: parseInt(req.body.durationMinutes, 10) }),
    ...(req.body.totalQuestions !== undefined && { totalQuestions: parseInt(req.body.totalQuestions, 10) }),
    ...(req.body.status !== undefined && { status: req.body.status }),
  }, { new: true });
  if (!doc) return res.status(404).json({ error: 'Quiz not found' });
  res.json(doc);
});

export const removeQuiz = asyncHandler(async (req, res) => {
  const doc = await Quiz.findByIdAndDelete(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Quiz not found' });
  res.json({ deleted: true });
});

export const getExamAnalytics = asyncHandler(async (req, res) => {
  const [attemptsByQuiz, topQuizzes, recentAttempts] = await Promise.all([
    QuizAttempt.aggregate([{ $group: { _id: '$quizId', count: { $sum: 1 }, avgScore: { $avg: '$score' } } }, { $sort: { count: -1 } }, { $limit: 20 }]),
    QuizAttempt.aggregate([{ $group: { _id: '$examId', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }]),
    QuizAttempt.find().sort({ completedAt: -1 }).limit(20).populate('userId', 'name').populate('quizId', 'title').populate('examId', 'name').lean(),
  ]);
  res.json({ attemptsByQuiz, topQuizzes, recentAttempts });
});
