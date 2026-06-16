import multer from 'multer';
import { Request } from 'express';

const storage = multer.memoryStorage();

// Ensure only PDF files are uploaded
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed.') as any, false);
  }
};

export const uploadPdf = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB Limit
  },
  fileFilter,
});
