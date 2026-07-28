import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  createTranslationFromSource,
  findTranslationEquivalent,
  listTranslationVariants,
  isTranslatableEntityType,
} from '../../services/localization/TranslationService.js';
import { normalizeLocale } from '../../../../shared/localization/localeResolver.js';
import { computeTranslationCompleteness } from '../../../../shared/localization/translationStatus.js';
import {
  hasSanitizedBodyEvidence,
  validateJobTranslationOverrides,
} from '../../services/jobWriteBoundary.js';

const JOB_TRANSLATION_OVERRIDE_ERROR = Object.freeze({
  error: 'One or more translation override fields are not allowed.',
  code: 'TRANSLATION_OVERRIDE_FIELDS_FORBIDDEN',
});

export const getTranslationGroup = asyncHandler(async (req, res) => {
  const { entityType, id } = req.params;
  if (!isTranslatableEntityType(entityType)) {
    return res.status(400).json({ error: 'Entity type does not support translations' });
  }
  const { getModelForEntityType } = await import('../../services/localization/TranslationService.js');
  const Model = getModelForEntityType(entityType);
  const doc = await Model?.findById(id).select('translationGroupId locale translationStatus status').lean();
  const groupId = doc?.translationGroupId;
  const variants = groupId
    ? await listTranslationVariants(entityType, groupId)
    : (doc ? [doc] : []);
  res.json({
    variants,
    completeness: computeTranslationCompleteness(variants),
  });
});

export const findEquivalent = asyncHandler(async (req, res) => {
  const { entityType, id } = req.params;
  const targetLocale = normalizeLocale(req.query.locale);
  const doc = await findTranslationEquivalent(entityType, id, targetLocale);
  if (!doc) return res.status(404).json({ error: 'Translation not found', fallback: true });
  res.json({ doc, locale: targetLocale });
});

export function resolveTranslationOverrides(req, entityType) {
  if (entityType !== 'job') {
    return {
      ok: true,
      overrides: req.body?.overrides || {},
      forbiddenFields: [],
    };
  }
  const suppliedOverrides = Object.prototype.hasOwnProperty.call(
    req.body || {},
    'overrides'
  )
    ? req.body.overrides
    : undefined;
  const validation = validateJobTranslationOverrides(
    suppliedOverrides,
    hasSanitizedBodyEvidence(req)
  );
  return {
    ok: validation.ok,
    overrides: validation.safeOverrides,
    forbiddenFields: validation.forbiddenFields,
  };
}

export const createTranslation = asyncHandler(async (req, res) => {
  const { entityType, id } = req.params;
  const targetLocale = normalizeLocale(req.body?.locale || req.query?.locale);
  if (!isTranslatableEntityType(entityType)) {
    return res.status(400).json({ error: 'Entity type does not support translations' });
  }
  const overrideResolution = resolveTranslationOverrides(req, entityType);
  if (!overrideResolution.ok) {
    return res.status(400).json({
      ...JOB_TRANSLATION_OVERRIDE_ERROR,
      details: { fields: overrideResolution.forbiddenFields },
    });
  }
  const result = await createTranslationFromSource({
    entityType,
    sourceId: id,
    targetLocale,
    userId: req.user?._id,
    overrides: overrideResolution.overrides,
  });
  if (!result.ok) return res.status(409).json({ error: result.error, doc: result.doc });
  res.status(201).json({ doc: result.doc });
});
