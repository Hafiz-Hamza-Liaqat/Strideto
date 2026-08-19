import { CmsGlobalBlock } from '../models/CmsGlobalBlock.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { listResponse, paginate } from '../utils/apiResponse.js';
import { logAudit, auditFromRequest } from '../services/auditService.js';
import { paginateQuery } from '../utils/cmsHelpers.js';
import { getBlockDefinition } from '../../../shared/blockRegistry.js';
import { validateGlobalBlockDocument } from '../../../shared/pageBuilderGlobalBlocks.js';
import {
  countGlobalBlockUsage,
  findGlobalBlockUsage,
} from '../services/globalBlockUsageService.js';
import { onGlobalBlockMutated } from '../utils/contentIntegration.js';

function applyGlobalBody(doc, body) {
  if (body.name !== undefined) doc.name = String(body.name || '').trim();
  if (body.description !== undefined) doc.description = String(body.description || '').trim();
  if (body.blockType !== undefined) doc.blockType = String(body.blockType || '').trim();
  if (body.config !== undefined) doc.config = body.config && typeof body.config === 'object' ? body.config : {};
  if (body.enabled !== undefined) doc.enabled = Boolean(body.enabled);
}

function validateGlobalBody(body) {
  if (!String(body.name || '').trim()) return 'Name is required';
  const blockType = String(body.blockType || '').trim();
  if (!blockType) return 'blockType is required';
  if (!getBlockDefinition(blockType)) return `Unknown block type: ${blockType}`;
  const configErrors = validateGlobalBlockDocument(body);
  if (configErrors.length) return configErrors.join('; ');
  return null;
}

export const listGlobalBlocks = asyncHandler(async (req, res) => {
  const { q, blockType } = req.query;
  const filter = {};
  if (blockType) filter.blockType = String(blockType);

  const { page, skip, limit: lim } = paginateQuery(req, 20, 200);
  let items = await CmsGlobalBlock.find(filter).sort({ name: 1 }).skip(skip).limit(lim).lean();
  const total = await CmsGlobalBlock.countDocuments(filter);

  const query = String(q || '').trim().toLowerCase();
  if (query) {
    items = items.filter((g) =>
      String(g.name || '').toLowerCase().includes(query)
      || String(g.description || '').toLowerCase().includes(query)
      || String(g.blockType || '').toLowerCase().includes(query),
    );
  }

  const ids = items.map((g) => String(g._id));
  const usageCounts = await countGlobalBlockUsage(ids);
  const rows = items.map((g) => ({
    ...g,
    usageCount: usageCounts.get(String(g._id)) || 0,
  }));

  res.json(listResponse(rows, paginate(total, page, lim)));
});

export const getGlobalBlock = asyncHandler(async (req, res) => {
  const doc = await CmsGlobalBlock.findById(req.params.id).lean();
  if (!doc) return res.status(404).json({ error: 'Global block not found' });
  const usage = await findGlobalBlockUsage(doc._id);
  res.json({ ...doc, usageCount: usage.length, usage });
});

export const getGlobalBlockUsage = asyncHandler(async (req, res) => {
  const doc = await CmsGlobalBlock.findById(req.params.id).lean();
  if (!doc) return res.status(404).json({ error: 'Global block not found' });
  const usage = await findGlobalBlockUsage(doc._id);
  res.json({ globalBlockId: doc._id, usageCount: usage.length, usage });
});

export const createGlobalBlock = asyncHandler(async (req, res) => {
  const err = validateGlobalBody(req.body || {});
  if (err) return res.status(400).json({ error: err });

  const doc = new CmsGlobalBlock();
  applyGlobalBody(doc, req.body);
  doc.updatedBy = req.user?.userId;
  await doc.save();
  void onGlobalBlockMutated(String(doc._id)).catch(() => {});

  await logAudit({
    ...auditFromRequest(req),
    action: 'cms.globalBlock.create',
    targetType: 'cmsGlobalBlock',
    targetId: doc._id,
    targetLabel: doc.name,
  });

  res.status(201).json(doc);
});

export const updateGlobalBlock = asyncHandler(async (req, res) => {
  const doc = await CmsGlobalBlock.findById(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Global block not found' });

  const merged = { ...doc.toObject(), ...req.body };
  const err = validateGlobalBody(merged);
  if (err) return res.status(400).json({ error: err });

  applyGlobalBody(doc, req.body);
  doc.updatedBy = req.user?.userId;
  await doc.save();
  void onGlobalBlockMutated(String(doc._id)).catch(() => {});

  await logAudit({
    ...auditFromRequest(req),
    action: 'cms.globalBlock.update',
    targetType: 'cmsGlobalBlock',
    targetId: doc._id,
    targetLabel: doc.name,
  });

  res.json(doc);
});

export const deleteGlobalBlock = asyncHandler(async (req, res) => {
  const usage = await findGlobalBlockUsage(req.params.id);
  const force = req.query.force === '1' || req.query.force === 'true';
  if (usage.length && !force) {
    return res.status(409).json({
      error: 'Global block is in use',
      usageCount: usage.length,
      usage,
    });
  }

  const doc = await CmsGlobalBlock.findByIdAndDelete(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Global block not found' });
  void onGlobalBlockMutated(String(doc._id)).catch(() => {});

  await logAudit({
    ...auditFromRequest(req),
    action: 'cms.globalBlock.delete',
    targetType: 'cmsGlobalBlock',
    targetId: doc._id,
    targetLabel: doc.name,
  });

  res.json({ ok: true, usageCount: usage.length });
});

export const duplicateGlobalBlock = asyncHandler(async (req, res) => {
  const source = await CmsGlobalBlock.findById(req.params.id).lean();
  if (!source) return res.status(404).json({ error: 'Global block not found' });

  const doc = await CmsGlobalBlock.create({
    name: `${source.name} (copy)`,
    description: source.description,
    blockType: source.blockType,
    config: source.config,
    enabled: source.enabled,
    updatedBy: req.user?.userId,
  });

  res.status(201).json(doc);
});

export const getGlobalBlocksPublic = asyncHandler(async (req, res) => {
  const raw = String(req.query.ids || '').trim();
  if (!raw) return res.json({ items: [] });

  const ids = raw.split(',').map((s) => s.trim()).filter(Boolean);
  const items = await CmsGlobalBlock.find({
    _id: { $in: ids },
    enabled: true,
  }).lean();

  res.json({
    items: items.map((g) => ({
      id: String(g._id),
      name: g.name,
      blockType: g.blockType,
      config: g.config || {},
      enabled: g.enabled,
    })),
  });
});

export const getGlobalBlocksAdminBatch = asyncHandler(async (req, res) => {
  const raw = String(req.query.ids || '').trim();
  if (!raw) return res.json({ items: [] });

  const ids = raw.split(',').map((s) => s.trim()).filter(Boolean);
  const items = await CmsGlobalBlock.find({ _id: { $in: ids } }).lean();
  res.json({ items });
});
