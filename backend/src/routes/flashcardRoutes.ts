import { Router } from 'express';
import { generateFlashcards, getFlashcards, updateFlashcardStatus, deleteFlashcard } from '../controllers/flashcardController';
import { authenticateToken } from '../middlewares/auth';
import { aiGenerationLimiter } from '../middlewares/rateLimiter';

const router = Router();

router.use(authenticateToken);

router.post('/generate', aiGenerationLimiter, generateFlashcards);
router.get('/', getFlashcards);
router.patch('/:id', updateFlashcardStatus);
router.delete('/:id', deleteFlashcard);

export default router;
