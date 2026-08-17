import { coerceCountryCode } from '../../../../shared/international/country.js';
import { canonicalizeStoredPhone } from '../../../../shared/international/phone.js';
import { GbsProviderProfessionalProfile } from '../../models/gbs/GbsProviderProfessionalProfile.js';
import { logAudit } from '../auditService.js';

function sanitizeOfficeLocation(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return {
    addressLine1: String(value.addressLine1 || '').trim(),
    city: String(value.city || '').trim(),
    region: String(value.region || '').trim(),
    postalCode: String(value.postalCode || '').trim(),
    countryCode: coerceCountryCode(value.countryCode) || '',
  };
}

function emptyProjection(subject) {
  return {
    subjectType: subject.subjectType,
    subjectId: String(subject.subjectId),
    displayName: '',
    publicEmail: '',
    phone: '',
    website: '',
    officeLocation: {
      addressLine1: '',
      city: '',
      region: '',
      postalCode: '',
      countryCode: '',
    },
    serviceCountries: [],
    languages: [],
    professionalSummary: '',
    recordVersion: 0,
    exists: false,
  };
}

function project(doc, subject) {
  if (!doc) return emptyProjection(subject);
  return {
    subjectType: doc.subjectType,
    subjectId: String(doc.subjectId),
    displayName: doc.displayName || '',
    publicEmail: doc.publicEmail || '',
    phone: doc.phone || '',
    website: doc.website || '',
    officeLocation: {
      addressLine1: doc.officeLocation?.addressLine1 || '',
      city: doc.officeLocation?.city || '',
      region: doc.officeLocation?.region || '',
      postalCode: doc.officeLocation?.postalCode || '',
      countryCode: doc.officeLocation?.countryCode || '',
    },
    serviceCountries: Array.isArray(doc.serviceCountries) ? doc.serviceCountries : [],
    languages: Array.isArray(doc.languages) ? doc.languages : [],
    professionalSummary: doc.professionalSummary || '',
    recordVersion: doc.recordVersion || 0,
    exists: true,
  };
}

export async function getBusinessProfessionalProfile(subject) {
  const doc = await GbsProviderProfessionalProfile.findOne({
    subjectType: subject.subjectType,
    subjectId: String(subject.subjectId),
  }).lean();
  return project(doc, subject);
}

export async function updateBusinessProfessionalProfile(subject, updates, actor) {
  updates = updates && typeof updates === 'object' ? updates : {};
  const subjectType = subject.subjectType;
  const subjectId = String(subject.subjectId);

  let doc = await GbsProviderProfessionalProfile.findOne({ subjectType, subjectId });
  if (!doc) {
    doc = new GbsProviderProfessionalProfile({ subjectType, subjectId });
  }

  if ('displayName' in updates) {
    doc.displayName = String(updates.displayName || '').trim();
  }
  if ('publicEmail' in updates) {
    doc.publicEmail = String(updates.publicEmail || '').trim().toLowerCase();
  }
  if ('website' in updates) {
    doc.website = String(updates.website || '').trim();
  }
  if ('professionalSummary' in updates) {
    const text = String(updates.professionalSummary || '');
    if (text.length > 2000) {
      const err = new Error('Validation failed');
      err.status = 400;
      err.code = 'validation_failed';
      throw err;
    }
    doc.professionalSummary = text;
  }
  if ('phone' in updates) {
    const result = canonicalizeStoredPhone(updates.phone);
    if (!result.ok) {
      const err = new Error(result.error);
      err.status = 400;
      err.code = 'invalid_phone';
      throw err;
    }
    doc.phone = result.value;
  }
  if ('officeLocation' in updates) {
    doc.officeLocation = sanitizeOfficeLocation(updates.officeLocation);
  }
  if ('serviceCountries' in updates) {
    const list = Array.isArray(updates.serviceCountries) ? updates.serviceCountries : [];
    doc.serviceCountries = list.map((value) => coerceCountryCode(value)).filter(Boolean);
  }
  if ('languages' in updates) {
    const list = Array.isArray(updates.languages) ? updates.languages : [];
    doc.languages = list.map((item) => String(item || '').trim()).filter(Boolean);
  }

  // Explicitly reject Education-only fields if clients send them.
  if ('specialties' in updates || 'destinationCountries' in updates) {
    const err = new Error('Education professional fields are not writable on Business profile');
    err.status = 400;
    err.code = 'education_fields_rejected';
    throw err;
  }

  doc.recordVersion = (doc.recordVersion || 0) + 1;
  await doc.save();

  await logAudit({
    action: 'gbs_provider_professional_profile_updated',
    actor: {
      userId: actor?.agentAccountId || actor?.id,
      role: 'agent',
    },
    metadata: {
      subjectType,
      subjectId,
      domainId: 'business_services',
    },
  });

  return project(doc.toObject(), subject);
}
