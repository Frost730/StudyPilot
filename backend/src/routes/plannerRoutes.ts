import { Router } from 'express';
import { generateStudyPlan, getStudyPlans, getStudyPlanById, toggleScheduleTask } from '../controllers/plannerController';
import { authenticateToken } from '../middlewares/auth';
import { aiGenerationLimiter } from '../middlewares/rateLimiter';

const router = Router();

router.use(authenticateToken);

router.post('/generate', aiGenerationLimiter, generateStudyPlan);
router.get('/', getStudyPlans);
router.get('/:id', getStudyPlanById);
router.patch('/:planId/task/:blockId', toggleScheduleTask);

export default router;
