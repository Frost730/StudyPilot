import { Router } from 'express';
import { askQuestion, getChatHistory, getChatSession, deleteChat } from '../controllers/chatController';
import { authenticateToken } from '../middlewares/auth';
import { aiGenerationLimiter } from '../middlewares/rateLimiter';

const router = Router();

router.use(authenticateToken);

router.post('/', aiGenerationLimiter, askQuestion);
router.get('/history', getChatHistory);
router.get('/session/:id', getChatSession);
router.delete('/session/:id', deleteChat);

export default router;
