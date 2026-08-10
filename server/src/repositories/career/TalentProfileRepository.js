import { TalentProfile } from '../../models/career/TalentProfile.js';

export const TalentProfileRepository = {
  async findByUserId(userId) {
    return TalentProfile.findOne({ userId }).lean();
  },

  async findByUserIds(userIds) {
    if (!userIds?.length) return [];
    return TalentProfile.find({ userId: { $in: userIds } }).lean();
  },

  async findById(id) {
    return TalentProfile.findById(id).lean();
  },

  async findByPublicSlug(slug) {
    return TalentProfile.findOne({ publicSlug: slug, visibility: 'public' }).lean();
  },

  async create(data) {
    return TalentProfile.create(data);
  },

  async updateById(id, patch) {
    return TalentProfile.findByIdAndUpdate(id, { $set: patch }, { new: true, runValidators: true });
  },

  async archiveByUserId(userId) {
    return TalentProfile.findOneAndUpdate(
      { userId },
      { $set: { status: 'archived' } },
      { new: true }
    );
  },

  async countAll() {
    return TalentProfile.countDocuments();
  },

  async countByStatus(status) {
    return TalentProfile.countDocuments({ status });
  },
};
