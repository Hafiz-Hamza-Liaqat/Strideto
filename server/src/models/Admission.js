import mongoose from 'mongoose';
import { admissionSlug } from '../utils/slugify.js';
import { translationFieldDefinition, applySlugLocaleIndex, ensureTranslationGroupHook } from './mixins/translationFields.js';
import { FIXTURE_FIELD_DEFINITION } from '../../../shared/publicDiscovery/fixtureExclusion.js';

const admissionSchema = new mongoose.Schema(
  {
    program: { type: String, required: true },
    slug: { type: String, required: true },
    institution: { type: String, required: true },
    university: { type: String }, // alias for institution / display
    department: { type: String },
    province: { type: String },
    city: { type: String },
    session: { type: String },
    deadline: { type: Date },
    lastDate: { type: Date }, // alias for deadline
    applyLink: { type: String }, // application URL
    description: { type: String },
    eligibility: [{ type: String }],
    applicationInstructions: { type: String },
    link: { type: String },
    status: { type: String, enum: ['draft', 'active', 'closed'], default: 'active' },
    logoUrl: { type: String },
    fee: { type: String },
    duration: { type: String },
    degree: { type: String },
    brochureUrl: { type: String },
    seoTitle: { type: String },
    metaDescription: { type: String },
    isFeatured: { type: Boolean, default: false },
    views: { type: Number, default: 0 },
    source: { type: String, enum: ['manual', 'scraper'], default: 'manual' },
    scrapedAt: { type: Date },
    sourceUrl: { type: String },
    ...FIXTURE_FIELD_DEFINITION,
    launchEligible: { type: Boolean, default: false, index: true },
    ...translationFieldDefinition,
  },
  { timestamps: true }
);

admissionSchema.index({ deadline: 1, status: 1 });
admissionSchema.index({ institution: 1, status: 1 });
admissionSchema.index({ program: 'text', institution: 'text', department: 'text' });
applySlugLocaleIndex(admissionSchema);
ensureTranslationGroupHook(admissionSchema);

admissionSchema.pre('save', function (next) {
  if (!this.slug && this.program) {
    this.slug = admissionSlug(this.program, this.institution);
  }
  next();
});

export const Admission = mongoose.model('Admission', admissionSchema);
