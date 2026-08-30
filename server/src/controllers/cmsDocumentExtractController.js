import { asyncHandler } from '../utils/asyncHandler.js';
import { parseCmsImportDocument, mapParseError } from '../services/cmsDocumentExtractService.js';

async function handleExtract(req, res, contentType) {
  if (!req.file?.buffer) {
    return res.status(400).json({ error: 'No file uploaded', code: 'invalid_file_content' });
  }
  try {
    const result = await parseCmsImportDocument(
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname,
      contentType,
    );
    res.json(result);
  } catch (err) {
    const mapped = mapParseError(err);
    res.status(mapped.status).json(mapped.body);
  }
}

export const extractBlogFromDocument = asyncHandler(async (req, res) => {
  await handleExtract(req, res, 'blog');
});

export const extractCareerArticleFromDocument = asyncHandler(async (req, res) => {
  await handleExtract(req, res, 'career-article');
});
