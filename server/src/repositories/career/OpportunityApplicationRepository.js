import { OpportunityApplication } from '../../models/career/OpportunityApplication.js';

export const OpportunityApplicationRepository = {
  async findById(id) {
    return OpportunityApplication.findById(id).lean();
  },

  async findByIdForUser(id, userId) {
    return OpportunityApplication.findOne({ _id: id, userId }).lean();
  },

  async findActiveByUser(userId, { limit = 50, skip = 0, stage } = {}) {
    const filter = { userId, status: 'active' };
    if (stage) filter.pipelineStage = stage;
    return OpportunityApplication.find(filter)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
  },

  async findByTalentAndOpportunity(talentProfileId, opportunityType, opportunityId) {
    return OpportunityApplication.findOne({
      talentProfileId,
      status: 'active',
      'opportunityRef.opportunityType': opportunityType,
      'opportunityRef.opportunityId': opportunityId,
    }).lean();
  },

  async create(data) {
    return OpportunityApplication.create(data);
  },

  async updateById(id, patch) {
    return OpportunityApplication.findByIdAndUpdate(id, { $set: patch }, { new: true, runValidators: true });
  },

  async pushStageHistory(id, entry) {
    return OpportunityApplication.findByIdAndUpdate(
      id,
      {
        $set: { pipelineStage: entry.toStage },
        $push: { stageHistory: entry },
      },
      { new: true, runValidators: true }
    );
  },

  async pushNote(id, note) {
    return OpportunityApplication.findByIdAndUpdate(
      id,
      { $push: { notes: note } },
      { new: true, runValidators: true }
    );
  },

  async pushDocument(id, docRef) {
    return OpportunityApplication.findByIdAndUpdate(
      id,
      { $push: { documentReferences: docRef } },
      { new: true, runValidators: true }
    );
  },

  async pullDocument(id, docRefId) {
    return OpportunityApplication.findByIdAndUpdate(
      id,
      { $pull: { documentReferences: { _id: docRefId } } },
      { new: true }
    );
  },

  async pushReminder(id, reminder) {
    return OpportunityApplication.findByIdAndUpdate(
      id,
      { $push: { reminderReferences: reminder } },
      { new: true, runValidators: true }
    );
  },

  async updateReminder(id, reminderId, patch) {
    const set = {};
    for (const [k, v] of Object.entries(patch)) {
      set[`reminderReferences.$.${k}`] = v;
    }
    return OpportunityApplication.findOneAndUpdate(
      { _id: id, 'reminderReferences._id': reminderId },
      { $set: set },
      { new: true, runValidators: true }
    );
  },

  async pullReminder(id, reminderId) {
    return OpportunityApplication.findByIdAndUpdate(
      id,
      { $pull: { reminderReferences: { _id: reminderId } } },
      { new: true }
    );
  },

  async archiveById(id) {
    return OpportunityApplication.findByIdAndUpdate(
      id,
      { $set: { status: 'archived', archivedAt: new Date() } },
      { new: true }
    );
  },

  async pushActivityReference(id, entry) {
    return OpportunityApplication.findByIdAndUpdate(
      id,
      { $push: { activityReferences: entry } },
      { new: true, runValidators: true }
    );
  },

  async pushContact(id, contact) {
    return OpportunityApplication.findByIdAndUpdate(
      id,
      { $push: { contacts: contact } },
      { new: true, runValidators: true }
    );
  },

  async pullContact(id, contactId) {
    return OpportunityApplication.findByIdAndUpdate(
      id,
      { $pull: { contacts: { _id: contactId } } },
      { new: true }
    );
  },

  async setInterview(id, interview) {
    return OpportunityApplication.findByIdAndUpdate(
      id,
      { $set: { interview } },
      { new: true, runValidators: true }
    );
  },

  async updateReminderStatus(applicationId, reminderId, status) {
    return OpportunityApplication.findOneAndUpdate(
      { _id: applicationId, 'reminderReferences._id': reminderId },
      { $set: { 'reminderReferences.$.status': status } },
      { new: true }
    );
  },

  async findActiveByUserAll(userId) {
    return OpportunityApplication.find({ userId, status: 'active' }).lean();
  },

  async countByUser(userId) {
    return OpportunityApplication.countDocuments({ userId, status: 'active' });
  },

  async findByLegacyApplicationId(legacyApplicationId) {
    return OpportunityApplication.findOne({ legacyApplicationId }).lean();
  },

  /**
   * Batch canonical-stage lookup for a set of legacy Application ids.
   * Read-only projection used by Employer-facing list views so they can show
   * the canonical hiring stage without an N+1 per-row query. Callers must
   * already have established Employer ownership of the supplied ids.
   */
  async findStagesByLegacyApplicationIds(legacyApplicationIds = []) {
    if (!legacyApplicationIds.length) return [];
    return OpportunityApplication.find({ legacyApplicationId: { $in: legacyApplicationIds } })
      .select('legacyApplicationId pipelineStage')
      .lean();
  },

  async countAll() {
    return OpportunityApplication.countDocuments({});
  },

  async countWithLegacyLink() {
    return OpportunityApplication.countDocuments({ legacyApplicationId: { $ne: null } });
  },
};
