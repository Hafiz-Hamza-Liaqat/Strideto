import { User } from '../../models/User.js';
import { Resume } from '../../models/Resume.js';
import { TalentProfileRepository } from '../../repositories/career/TalentProfileRepository.js';
import { ResumeVersionRepository } from '../../repositories/career/ResumeVersionRepository.js';
import { DocumentRepository } from '../../repositories/career/DocumentRepository.js';
import { TalentProfileService } from './TalentProfileService.js';
import { ResumeVersionService } from './ResumeVersionService.js';
import {
  isTalentProfileReadFromCanonical,
  isTalentProfileEnabled,
} from '../../config/careerFeatureFlags.js';
import {
  talentProfileToResumeView,
  legacyResumeToResumeView,
  resumeViewToTalentProfilePayload,
  talentProfileToCandidateCard,
  talentProfileToPrefill,
} from '../../../../shared/career/resumeBridge.js';

function shouldReadCanonical() {
  return isTalentProfileEnabled() && isTalentProfileReadFromCanonical();
}

export const TalentProfileReadService = {
  shouldReadCanonical,

  async getProfileForUser(userId) {
    const profile = await TalentProfileRepository.findByUserId(userId);
    if (profile) return profile;
    if (!isTalentProfileEnabled()) return null;
    return TalentProfileService.getOrCreateForUser(userId, { type: 'system', id: null });
  },

  async getCareerTargetingContext(userId) {
    const user = await User.findById(userId).select('province interests').lean();
    if (!user) return { province: '', interests: [], source: 'none' };

    if (shouldReadCanonical()) {
      const profile = await this.getProfileForUser(userId);
      if (profile) {
        const region = profile.personal?.region || profile.market || '';
        const interests = (profile.interests?.length ? profile.interests : user.interests) || [];
        return {
          province: region || user.province || '',
          interests,
          source: 'talent-profile',
          preferredCountries: profile.preferences?.preferredCountries || [],
          preferredIndustries: profile.preferences?.preferredIndustries || [],
        };
      }
    }

    return { province: user.province || '', interests: user.interests || [], source: 'legacy-user' };
  },

  async getResumeBuilderView(userId) {
    const profile = await TalentProfileRepository.findByUserId(userId);

    if (shouldReadCanonical() && profile) {
      const version = await ResumeVersionRepository.findPrimaryByProfileId(profile._id);
      return talentProfileToResumeView(profile, version);
    }

    if (profile && isTalentProfileEnabled()) {
      const version = await ResumeVersionRepository.findPrimaryByProfileId(profile._id);
      if (version) return talentProfileToResumeView(profile, version);
    }

    const legacy = await Resume.findOne({ userId }).sort({ updatedAt: -1 }).lean();
    if (legacy) return legacyResumeToResumeView(legacy);

    if (profile) {
      const version = await ResumeVersionRepository.findPrimaryByProfileId(profile._id);
      return talentProfileToResumeView(profile, version);
    }

    return null;
  },

  async saveResumeBuilderView(userId, view, actor) {
    const payload = resumeViewToTalentProfilePayload(view);
    let profile = await TalentProfileRepository.findByUserId(userId);

    if (!profile) {
      profile = await TalentProfileService.getOrCreateForUser(userId, actor);
    }

    await TalentProfileService.update(userId, payload, actor);
    profile = await TalentProfileRepository.findByUserId(userId);

    const versionPayload = {
      title: view.title || 'My Resume',
      template: view.template || 'modern-professional',
      isPrimary: true,
      status: 'draft',
      snapshot: {
        displayName: payload.displayName,
        headline: payload.headline,
        summary: payload.summary,
        education: payload.education,
        experience: payload.experience,
        skills: payload.skills,
        languages: payload.languages,
        certifications: payload.certificationReferences,
        projects: payload.portfolioReferences,
        socialProfile: payload.socialProfile,
      },
    };

    const existingPrimary = await ResumeVersionRepository.findPrimaryByProfileId(profile._id);
    if (existingPrimary) {
      await ResumeVersionRepository.updateById(existingPrimary._id, versionPayload);
    } else {
      await ResumeVersionService.create(userId, { ...versionPayload, isPrimary: true }, actor);
    }

    return this.getResumeBuilderView(userId);
  },

  async getDashboardSummary(userId) {
    const user = await User.findById(userId).select('name email notifications').lean();
    const profile = await TalentProfileRepository.findByUserId(userId);
    const targeting = await this.getCareerTargetingContext(userId);
    const versions = profile
      ? await ResumeVersionRepository.findByProfileId(profile._id, { limit: 10 })
      : [];
    const legacyResumes = shouldReadCanonical()
      ? []
      : await Resume.find({ userId }).sort({ updatedAt: -1 }).limit(10).lean();

    return {
      source: profile ? 'talent-profile' : 'legacy',
      readCanonical: shouldReadCanonical(),
      user: {
        name: user?.name,
        email: user?.email,
        notifications: user?.notifications,
      },
      career: {
        province: targeting.province,
        interests: targeting.interests,
        headline: profile?.headline || '',
        displayName: profile?.displayName || user?.name || '',
        market: profile?.market || targeting.province || '',
        completionHints: {
          hasEducation: Boolean(profile?.education?.length),
          hasExperience: Boolean(profile?.experience?.length),
          hasSkills: Boolean(profile?.skills?.length),
        },
      },
      resumeVersions: versions.map((v) => ({
        _id: v._id,
        title: v.title,
        status: v.status,
        isPrimary: v.isPrimary,
        updatedAt: v.updatedAt,
        source: 'talent-profile',
      })),
      legacyResumes: legacyResumes.map((r) => ({
        _id: r._id,
        title: r.title,
        updatedAt: r.updatedAt,
        source: 'legacy-resume',
      })),
      talentProfileId: profile?._id || null,
    };
  },

  async getApplyKit(userId) {
    const profile = await this.getProfileForUser(userId);
    const documents = profile
      ? await DocumentRepository.findByProfileId(profile._id)
      : [];
    const primaryVersion = profile
      ? await ResumeVersionRepository.findPrimaryByProfileId(profile._id)
      : null;

    const resumeDoc = documents.find((d) => d.documentType === 'resume' && d.metadata?.fileUrl)
      || documents.find((d) => d.metadata?.fileUrl);

    return {
      talentProfileId: profile?._id || null,
      primaryResumeVersionId: primaryVersion?._id || null,
      resumeDocumentUrl: resumeDoc?.metadata?.fileUrl || null,
      resumeDocumentLabel: resumeDoc?.label || null,
      documents: documents.map((d) => ({
        _id: d._id,
        label: d.label,
        documentType: d.documentType,
        url: d.metadata?.fileUrl || null,
      })),
      candidate: talentProfileToCandidateCard(profile, primaryVersion),
    };
  },

  async getCandidateCardForUser(userId) {
    const profile = await TalentProfileRepository.findByUserId(userId);
    if (!profile && !shouldReadCanonical()) {
      const user = await User.findById(userId).select('name email').lean();
      return user ? { displayName: user.name, email: user.email, source: 'legacy-user' } : null;
    }
    const p = profile || await this.getProfileForUser(userId);
    const version = p ? await ResumeVersionRepository.findPrimaryByProfileId(p._id) : null;
    return talentProfileToCandidateCard(p, version);
  },

  async getCandidateCardsForUsers(userIds) {
    const ids = [...new Set((userIds || []).filter(Boolean).map(String))];
    if (!ids.length) return new Map();
    const profiles = await TalentProfileRepository.findByUserIds(ids);
    const versions = await ResumeVersionRepository.findPrimaryByProfileIds(profiles.map((profile) => profile._id));
    const versionByProfile = new Map(versions.map((version) => [String(version.talentProfileId), version]));
    const cards = new Map(profiles.map((profile) => [
      String(profile.userId),
      talentProfileToCandidateCard(profile, versionByProfile.get(String(profile._id)) || null),
    ]));
    if (!shouldReadCanonical()) {
      const missingIds = ids.filter((id) => !cards.has(id));
      const users = missingIds.length ? await User.find({ _id: { $in: missingIds } }).select('name email').lean() : [];
      for (const user of users) cards.set(String(user._id), { displayName: user.name, email: user.email, source: 'legacy-user' });
    }
    return cards;
  },

  async getFormPrefill(userId, authEmail = '') {
    const profile = await this.getProfileForUser(userId);
    return talentProfileToPrefill(profile, authEmail);
  },

  async resolveResumeUrlForApply(userId, { uploadedUrl, useProfileResume = true } = {}) {
    if (uploadedUrl) return { url: uploadedUrl, source: 'upload' };

    if (!useProfileResume) return { url: null, source: 'none' };

    const kit = await this.getApplyKit(userId);
    if (kit.resumeDocumentUrl) {
      return {
        url: kit.resumeDocumentUrl,
        source: 'talent-profile-document',
        talentProfileId: kit.talentProfileId,
        resumeVersionId: kit.primaryResumeVersionId,
      };
    }

    return {
      url: null,
      source: 'none',
      talentProfileId: kit.talentProfileId,
      resumeVersionId: kit.primaryResumeVersionId,
    };
  },
};
