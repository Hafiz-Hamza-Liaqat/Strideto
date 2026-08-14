import { Router } from 'express';
import { chatbotQuery, getChatHistory } from '../controllers/chatbotController.js';
import { studentProductAuth } from '../middleware/requireUserCapability.js';

export const chatbotRouter = Router();

chatbotRouter.post('/chatbot/query', ...studentProductAuth, chatbotQuery);
chatbotRouter.get('/chatbot/history', ...studentProductAuth, getChatHistory);
