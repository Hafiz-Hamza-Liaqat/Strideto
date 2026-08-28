import { asyncHandler } from '../utils/asyncHandler.js';
import { parseJobDescriptionDocument } from '../services/jobDescriptionExtractService.js';

function mapParseError(err) {
  const code = err.code || 'corrupt_document';
  const status = err.status || 400;
  return { status, body: { error: err.message, code } };
}

export const extractAdminJobFromDocument = asyncHandler(async (req, res) => {
  if (!req.file?.buffer) {
    return res.status(400).json({ error: 'No file uploaded', code: 'invalid_file_content' });
  }
  try {
    const result = await parseJobDescriptionDocument(
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname,
      'admin'
    );
    res.json(result);
  } catch (err) {
    const mapped = mapParseError(err);
    res.status(mapped.status).json(mapped.body);
  }
});

export const extractEmployerJobFromDocument = asyncHandler(async (req, res) => {
  if (!req.file?.buffer) {
    return res.status(400).json({ error: 'No file uploaded', code: 'invalid_file_content' });
  }
  try {
    const result = await parseJobDescriptionDocument(
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname,
      'employer'
    );
    // Employer provenance must never be suggested
    for (const key of ['sourceWebsite', 'sourceUrl', 'externalId']) {
      delete result.suggestions[key];
    }
    res.json(result);
  } catch (err) {
    const mapped = mapParseError(err);
    res.status(mapped.status).json(mapped.body);
  }
});
