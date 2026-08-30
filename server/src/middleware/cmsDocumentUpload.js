import multer from 'multer';
import { rejectDangerousFilename } from '../utils/fileValidation.js';

const MAX_SIZE = 5 * 1024 * 1024;
const storage = multer.memoryStorage();

const ALLOWED = new Set([
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

export const uploadCmsDocument = multer({
  storage,
  limits: { fileSize: MAX_SIZE, files: 1 },
  fileFilter: (req, file, cb) => {
    try {
      rejectDangerousFilename(file.originalname);
      const ext = (file.originalname || '').toLowerCase().split('.').pop();
      if (!['txt', 'docx'].includes(ext)) {
        return cb(new Error('Only DOCX or TXT files are allowed'), false);
      }
      if (ALLOWED.has(file.mimetype) || file.mimetype === 'application/octet-stream') {
        return cb(null, true);
      }
      return cb(new Error('Unsupported file type'), false);
    } catch (err) {
      return cb(err, false);
    }
  },
}).single('document');
