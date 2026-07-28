/**
 * Translation relationship service (C.7.0.8).
 */
import { randomUUID } from 'crypto';
import { TRANSLATABLE_ENTITY_TYPES } from '../../../../shared/localization/localeConfig.js';
import { normalizeLocale } from '../../../../shared/localization/localeResolver.js';
import { defaultTranslationStatusForLocale } from '../../../../shared/localization/translationStatus.js';
import { mongoLocaleFilter } from '../../../../shared/localization/localeFallback.js';
import { Blog } from '../../models/Blog.js';
import { Job } from '../../models/Job.js';
import { Scholarship } from '../../models/Scholarship.js';
import { Admission } from '../../models/Admission.js';
import { University } from '../../models/University.js';
import { CareerArticle } from '../../models/CareerArticle.js';
import { CmsStaticPage } from '../../models/CmsStaticPage.js';
import { CmsPageLayout } from '../../models/CmsPageLayout.js';
import { FormDefinition } from '../../models/FormDefinition.js';
import {
  buildJobTranslationProjection,
  validateJobTranslationOverrides,
} from '../jobWriteBoundary.js';

const ENTITY_MODEL_MAP = {
  blog: Blog,
  job: Job,
  scholarship: Scholarship,
  admission: Admission,
  university: University,
  'career-guidance': CareerArticle,
  'cms-page': CmsStaticPage,
  'page-builder-page': CmsPageLayout,
  form: FormDefinition,
};

export function getModelForEntityType(entityType) {
  return ENTITY_MODEL_MAP[entityType] || null;
}

export function isTranslatableEntityType(entityType) {
  return TRANSLATABLE_ENTITY_TYPES.includes(entityType);
}

/**
 * List all variants in a translation group.
 */
export async function listTranslationVariants(entityType, translationGroupId) {
  const Model = getModelForEntityType(entityType);
  if (!Model || !translationGroupId) return [];
  return Model.find({ translationGroupId: String(translationGroupId) })
    .select('_id locale slug title name pageKey translationStatus status translationOf')
    .lean();
}

/**
 * Find equivalent document in target locale.
 */
export async function findTranslationEquivalent(entityType, sourceId, targetLocale) {
  const Model = getModelForEntityType(entityType);
  if (!Model) return null;
  const source = await Model.findById(sourceId).lean();
  if (!source?.translationGroupId) return null;
  const loc = normalizeLocale(targetLocale);
  return Model.findOne({
    translationGroupId: source.translationGroupId,
    ...mongoLocaleFilter(loc),
  }).lean();
}

/**
 * Create a draft translation from a source document.
 */
export async function createTranslationFromSource({
  entityType,
  sourceId,
  targetLocale,
  userId,
  overrides = {},
}) {
  const Model = getModelForEntityType(entityType);
  if (!Model) throw new Error(`Unknown entity type: ${entityType}`);

  const source = await Model.findById(sourceId);
  if (!source) throw new Error('Source document not found');

  const loc = normalizeLocale(targetLocale);
  const groupId = source.translationGroupId || String(source._id);

  const existing = await Model.findOne({
    translationGroupId: groupId,
    locale: loc,
  });
  if (existing) return { ok: false, error: 'Translation already exists', doc: existing };

  const plain = source.toObject();
  delete plain._id;
  delete plain.createdAt;
  delete plain.updatedAt;
  delete plain.slug;
  delete plain.publishedAt;

  let documentInput;
  if (entityType === 'job') {
    const validation = validateJobTranslationOverrides(overrides);
    if (!validation.ok) {
      const error = new Error(
        'One or more translation override fields are not allowed.'
      );
      error.status = 400;
      error.code = 'TRANSLATION_OVERRIDE_FIELDS_FORBIDDEN';
      error.details = { fields: validation.forbiddenFields };
      throw error;
    }
    documentInput = {
      ...buildJobTranslationProjection(plain, validation.safeOverrides),
      locale: loc,
      translationGroupId: groupId,
      translationOf: source._id,
      translationStatus: defaultTranslationStatusForLocale(loc),
      status: 'draft',
      approvalStatus: 'pending',
    };
  } else {
    documentInput = {
      ...plain,
      ...overrides,
      locale: loc,
      translationGroupId: groupId,
      translationOf: source._id,
      translationStatus: defaultTranslationStatusForLocale(loc),
      status: plain.status === 'published' ? 'draft' : plain.status,
    };
  }

  const doc = new Model(documentInput);

  if (doc.title) doc.title = `${doc.title} (${loc.toUpperCase()})`;
  if (doc.name) doc.name = `${doc.name} (${loc.toUpperCase()})`;
  if (entityType === 'page-builder-page' && doc.pageKey) {
    // pageKey stays shared; locale differentiates layout
  }

  doc.updatedBy = userId;
  await doc.save();

  if (!source.translationGroupId) {
    source.translationGroupId = groupId;
    await source.save();
  }

  return { ok: true, doc };
}

/**
 * Mark translations as needing update when source locale changes.
 */
export async function markTranslationsNeedsUpdate(entityType, sourceDoc) {
  const Model = getModelForEntityType(entityType);
  if (!Model || !sourceDoc?.translationGroupId) return 0;
  const result = await Model.updateMany(
    {
      translationGroupId: sourceDoc.translationGroupId,
      _id: { $ne: sourceDoc._id },
      translationStatus: 'published',
    },
    { $set: { translationStatus: 'needs_update' } },
  );
  return result.modifiedCount || 0;
}

export function newTranslationGroupId() {
  return randomUUID();
}
