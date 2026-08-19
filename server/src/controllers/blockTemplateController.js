import { CmsBlockTemplate } from '../models/CmsBlockTemplate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { listResponse, paginate } from '../utils/apiResponse.js';
import { logAudit, auditFromRequest } from '../services/auditService.js';
import { paginateQuery } from '../utils/cmsHelpers.js';
import { getBlockDefinition } from '../../../shared/blockRegistry.js';
import { filterTemplates } from '../../../shared/pageBuilderTemplates.js';

import { onBlockTemplateMutated } from '../utils/contentIntegration.js';

function applyTemplateBody(doc, body) {
  if (body.name !== undefined) doc.name = String(body.name || '').trim();
  if (body.category !== undefined) doc.category = String(body.category || 'general').trim();
  if (body.description !== undefined) doc.description = String(body.description || '').trim();
  if (body.blockType !== undefined) doc.blockType = String(body.blockType || '').trim();
  if (body.config !== undefined) doc.config = body.config && typeof body.config === 'object' ? body.config : {};
  if (body.previewImageUrl !== undefined) doc.previewImageUrl = String(body.previewImageUrl || '').trim();
  if (body.favorite !== undefined) doc.favorite = Boolean(body.favorite);
}

function validateTemplateBody(body) {
  const blockType = String(body.blockType || '').trim();
  if (!String(body.name || '').trim()) return 'Name is required';
  if (!blockType) return 'blockType is required';
  if (!getBlockDefinition(blockType)) return `Unknown block type: ${blockType}`;
  return null;
}

export const listBlockTemplates = asyncHandler(async (req, res) => {
  const { q, category, sort } = req.query;
  const filter = {};
  if (category && category !== 'all') filter.category = String(category);

  const { page, skip, limit: lim } = paginateQuery(req, 20, 200);
  const [items, total] = await Promise.all([
    CmsBlockTemplate.find(filter).sort({ favorite: -1, name: 1 }).skip(skip).limit(lim).lean(),
    CmsBlockTemplate.countDocuments(filter),
  ]);

  const filtered = filterTemplates(items, { q, category, sort });
  res.json(listResponse(filtered, paginate(total, page, lim)));
});

export const getBlockTemplate = asyncHandler(async (req, res) => {
  const doc = await CmsBlockTemplate.findById(req.params.id).lean();
  if (!doc) return res.status(404).json({ error: 'Template not found' });
  res.json(doc);
});

export const createBlockTemplate = asyncHandler(async (req, res) => {
  const err = validateTemplateBody(req.body || {});
  if (err) return res.status(400).json({ error: err });

  const doc = new CmsBlockTemplate();
  applyTemplateBody(doc, req.body);
  doc.updatedBy = req.user?.userId;
  await doc.save();
  onBlockTemplateMutated();

  await logAudit({
    ...auditFromRequest(req),
    action: 'cms.blockTemplate.create',
    targetType: 'cmsBlockTemplate',
    targetId: doc._id,
    targetLabel: doc.name,
  });

  res.status(201).json(doc);
});

export const updateBlockTemplate = asyncHandler(async (req, res) => {
  const doc = await CmsBlockTemplate.findById(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Template not found' });

  const merged = { ...doc.toObject(), ...req.body };
  const err = validateTemplateBody(merged);
  if (err) return res.status(400).json({ error: err });

  applyTemplateBody(doc, req.body);
  doc.updatedBy = req.user?.userId;
  await doc.save();
  onBlockTemplateMutated();

  await logAudit({
    ...auditFromRequest(req),
    action: 'cms.blockTemplate.update',
    targetType: 'cmsBlockTemplate',
    targetId: doc._id,
    targetLabel: doc.name,
  });

  res.json(doc);
});

export const deleteBlockTemplate = asyncHandler(async (req, res) => {
  const doc = await CmsBlockTemplate.findByIdAndDelete(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Template not found' });
  onBlockTemplateMutated();

  await logAudit({
    ...auditFromRequest(req),
    action: 'cms.blockTemplate.delete',
    targetType: 'cmsBlockTemplate',
    targetId: doc._id,
    targetLabel: doc.name,
  });

  res.json({ ok: true });
});

export const duplicateBlockTemplate = asyncHandler(async (req, res) => {
  const source = await CmsBlockTemplate.findById(req.params.id).lean();
  if (!source) return res.status(404).json({ error: 'Template not found' });

  const doc = await CmsBlockTemplate.create({
    name: `${source.name} (copy)`,
    category: source.category,
    description: source.description,
    blockType: source.blockType,
    config: source.config,
    previewImageUrl: source.previewImageUrl,
    favorite: false,
    updatedBy: req.user?.userId,
  });

  res.status(201).json(doc);
});
