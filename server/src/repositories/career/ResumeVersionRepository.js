import { ResumeVersion } from '../../models/career/ResumeVersion.js';

export const ResumeVersionRepository = {
  async findByProfileId(talentProfileId, { limit = 50 } = {}) {
    return ResumeVersion.find({ talentProfileId })
      .sort({ isPrimary: -1, updatedAt: -1 })
      .limit(limit)
      .lean();
  },

  async findById(id) {
    return ResumeVersion.findById(id).lean();
  },

  async findByIdForUser(id, userId) {
    return ResumeVersion.findOne({ _id: id, userId }).lean();
  },

  async findPrimaryByProfileId(talentProfileId) {
    return ResumeVersion.findOne({ talentProfileId, isPrimary: true }).lean();
  },

  async findPrimaryByProfileIds(talentProfileIds) {
    if (!talentProfileIds?.length) return [];
    return ResumeVersion.find({ talentProfileId: { $in: talentProfileIds }, isPrimary: true }).lean();
  },

  async create(data) {
    return ResumeVersion.create(data);
  },

  async updateById(id, patch) {
    return ResumeVersion.findByIdAndUpdate(id, { $set: patch }, { new: true, runValidators: true });
  },

  async clearPrimaryForProfile(talentProfileId, exceptId = null) {
    const filter = { talentProfileId, isPrimary: true };
    if (exceptId) filter._id = { $ne: exceptId };
    await ResumeVersion.updateMany(filter, { $set: { isPrimary: false } });
  },

  async deleteById(id) {
    return ResumeVersion.findByIdAndDelete(id);
  },

  async nextSourceVersion(talentProfileId) {
    const latest = await ResumeVersion.findOne({ talentProfileId })
      .sort({ sourceVersion: -1 })
      .select('sourceVersion')
      .lean();
    return (latest?.sourceVersion || 0) + 1;
  },
};
