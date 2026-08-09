/**
 * Multer configuration for vault file uploads.
 * Server-authoritative validation: MIME sniffing, extension checks, size limit.
 */
import multer from 'multer';
import {
  VAULT_MAX_FILE_SIZE,
  VAULT_ALLOWED_MIMES,
} from '../../../shared/vault/constants.js';
import { rejectDangerousFilename, sniffMime } from '../utils/fileValidation.js';

const storage = multer.memoryStorage();

function vaultFileFilter(req, file, cb) {
  try {
    rejectDangerousFilename(file.originalname);
    if (!VAULT_ALLOWED_MIMES.has(file.mimetype)) {
      return cb(new Error('File type not allowed for vault upload'), false);
    }
    cb(null, true);
  } catch (err) {
    cb(err, false);
  }
}

export const vaultUpload = multer({
  storage,
  limits: { fileSize: VAULT_MAX_FILE_SIZE, files: 1 },
  fileFilter: vaultFileFilter,
}).single('file');

/**
 * Express middleware that wraps vaultUpload and performs magic-byte MIME validation.
 * Attaches validated { buffer, mimeType, originalname } to req.vaultFile on success.
 */
export function vaultFileMiddleware(req, res, next) {
  vaultUpload(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File too large (max 20 MB)' });
        }
        return res.status(400).json({ error: err.message });
      }
      return res.status(400).json({ error: err.message || 'Upload error' });
    }

    if (!req.file) {
      // File is optional on some routes (create without file)
      req.vaultFile = null;
      return next();
    }

    const { buffer, mimetype, originalname } = req.file;

    // Magic-byte sniff
    const detected = sniffMime(buffer);
    const effectiveMime = detected || mimetype;

    if (!VAULT_ALLOWED_MIMES.has(effectiveMime)) {
      return res.status(400).json({ error: 'File content type not permitted' });
    }

    if (detected && mimetype && detected !== mimetype) {
      return res.status(400).json({ error: 'File content does not match declared type' });
    }

    req.vaultFile = { buffer, mimeType: effectiveMime, originalname };
    next();
  });
}
