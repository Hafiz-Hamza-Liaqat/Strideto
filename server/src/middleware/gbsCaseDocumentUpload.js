import multer from 'multer';
import {
  GBS_CASE_DOCUMENT_BOUNDS,
  GBS_CASE_DOCUMENT_MIMES,
  GBS_CASE_DOCUMENT_DOCX_MIME,
} from '../../../shared/gbs/caseDocumentContract.js';
import { rejectDangerousFilename, sniffMime } from '../utils/fileValidation.js';

const storage = multer.memoryStorage();

function gbsFileFilter(req, file, cb) {
  try {
    rejectDangerousFilename(file.originalname);
    const allowed = new Set([...GBS_CASE_DOCUMENT_MIMES, GBS_CASE_DOCUMENT_DOCX_MIME]);
    if (!allowed.has(file.mimetype)) {
      return cb(new Error('File type not allowed'), false);
    }
    cb(null, true);
  } catch (err) {
    cb(err, false);
  }
}

const upload = multer({
  storage,
  limits: { fileSize: GBS_CASE_DOCUMENT_BOUNDS.MAX_FILE_SIZE, files: 1 },
  fileFilter: gbsFileFilter,
}).single('file');

export function gbsCaseDocumentFileMiddleware(req, res, next) {
  upload(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'file_too_large' });
      }
      return res.status(400).json({ error: err.message || 'upload_error' });
    }
    if (!req.file) {
      req.gbsDocumentFile = null;
      return next();
    }
    const detected = sniffMime(req.file.buffer);
    const declared = req.file.mimetype;
    if (!detected || (declared && detected !== declared)) {
      return res.status(400).json({ error: 'file_content_mismatch' });
    }
    req.gbsDocumentFile = {
      buffer: req.file.buffer,
      mimeType: detected,
      originalname: req.file.originalname,
    };
    next();
  });
}
