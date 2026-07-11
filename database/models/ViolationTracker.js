const mongoose = require('mongoose');

const violationTrackerSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  userId:  { type: String, required: true },
  type:    { type: String, enum: ['badword', 'spam', 'link'], required: true },
  count:   { type: Number, default: 1 },
  lastAt:  { type: Date, default: Date.now },
  resetAt: { type: Date },
}, { timestamps: false });

violationTrackerSchema.index({ guildId: 1, userId: 1, type: 1 }, { unique: true });
violationTrackerSchema.index({ resetAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('ViolationTracker', violationTrackerSchema);
