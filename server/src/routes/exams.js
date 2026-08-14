import { Router } from 'express';
import * as exams from '../controllers/examsController.js';
import { submitQuiz, getLeaderboard, getMyProgress } from '../controllers/quizController.js';
import { studentProductAuth } from '../middleware/requireUserCapability.js';

export const examsRouter = Router();

examsRouter.get('/exams', exams.listExams);
examsRouter.get('/exams/:slug', exams.getExamBySlug);
examsRouter.get('/exams/:examId/past-papers', exams.listPastPapers);
examsRouter.get('/exams/:examId/quizzes', exams.listQuizzes);
examsRouter.get('/quizzes/:quizId', exams.getQuizWithMcqs);

examsRouter.post('/quizzes/submit', ...studentProductAuth, submitQuiz);
examsRouter.get('/quizzes/leaderboard', getLeaderboard);
examsRouter.get('/quizzes/my-progress', ...studentProductAuth, getMyProgress);
