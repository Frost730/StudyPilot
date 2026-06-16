import { Router } from 'express';
import { generateQuiz, getQuizzes, getQuizById, submitQuiz } from '../controllers/quizController';
import { authenticateToken } from '../middlewares/auth';
import { aiGenerationLimiter } from '../middlewares/rateLimiter';

const router = Router();

router.use(authenticateToken);

router.post('/generate', aiGenerationLimiter, generateQuiz);
router.get('/', getQuizzes);
router.get('/:id', getQuizById);
router.post('/:id/submit', submitQuiz);

export default router;
