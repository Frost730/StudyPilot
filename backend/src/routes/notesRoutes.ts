import { Router } from 'express';
import { generateNotes, getNotes, getNotesById, updateNotes, deleteNotes } from '../controllers/notesController';
import { authenticateToken } from '../middlewares/auth';
import { aiGenerationLimiter } from '../middlewares/rateLimiter';

const router = Router();

router.use(authenticateToken);

router.post('/generate', aiGenerationLimiter, generateNotes);
router.get('/', getNotes);
router.get('/:id', getNotesById);
router.put('/:id', updateNotes);
router.delete('/:id', deleteNotes);

export default router;
