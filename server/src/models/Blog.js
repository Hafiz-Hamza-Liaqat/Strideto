import mongoose from 'mongoose';
import { blogSlug } from '../utils/slugify.js';
import { translationFieldDefinition, applySlugLocaleIndex, ensureTranslationGroupHook } from './mixins/translationFields.js';

const blogSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true },
    excerpt: { type: String },
    content: { type: String },
    tags: [{ type: String }],
    category: { type: String },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    authorName: { type: String, trim: true },
    views: { type: Number, default: 0 },
    status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft' },
    publishedAt: { type: Date },
    scheduledAt: { type: Date },
    imageUrl: { type: String },
    gallery: [{ type: String }],
    isFeatured: { type: Boolean, default: false },
    readingTime: { type: Number },
    seoTitle: { type: String },
    metaDescription: { type: String },
    canonicalUrl: { type: String },
    ogImageUrl: { type: String },
    relatedArticleIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Blog' }],
    ...translationFieldDefinition,
  },
  { timestamps: true }
);

blogSchema.index({ status: 1, publishedAt: -1 });
blogSchema.index({ tags: 1, status: 1 });
blogSchema.index({ category: 1, status: 1 });
blogSchema.index({ title: 'text', content: 'text', tags: 'text' });
applySlugLocaleIndex(blogSchema);
ensureTranslationGroupHook(blogSchema);

blogSchema.pre('save', function (next) {
  if (!this.slug && this.title) {
    this.slug = blogSlug(this.title);
  }
  next();
});

export const Blog = mongoose.model('Blog', blogSchema);
