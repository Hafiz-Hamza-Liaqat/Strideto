import mongoose from 'mongoose';

const announcementUserStateSchema = new mongoose.Schema(
  {
    announcementId: { type: mongoose.Schema.Types.ObjectId, ref: 'Announcement', required: true, index: true },
    userKey: { type: String, required: true, trim: true },
    realm: { type: String, trim: true },
    readAt: { type: Date },
    acknowledgedAt: { type: Date },
    surveyVote: { type: String, trim: true },
  },
  { timestamps: true }
);

announcementUserStateSchema.index({ announcementId: 1, userKey: 1 }, { unique: true });
announcementUserStateSchema.index({ userKey: 1, readAt: -1 });

export const AnnouncementUserState = mongoose.model('AnnouncementUserState', announcementUserStateSchema);
