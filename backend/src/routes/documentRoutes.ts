import { Router } from 'express';
import { uploadDocument, getDocuments, renameDocument, deleteDocument } from '../controllers/documentController';
import { authenticateToken } from '../middlewares/auth';
import { uploadPdf } from '../middlewares/upload';

const router = Router();

// Apply auth middleware to all document endpoints
router.use(authenticateToken);

router.post('/upload', uploadPdf.single('file'), uploadDocument);
router.get('/', getDocuments);
router.patch('/:id', renameDocument);
router.delete('/:id', deleteDocument);

export default router;
