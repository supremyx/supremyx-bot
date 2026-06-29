const mongoose = require('mongoose');

const matchPlanSchema = new mongoose.Schema({
  guildId:       { type: String, required: true },
  team1:         { type: String, required: true },
  team2:         { type: String, default: '' },
  note:          { type: String, default: '' },
  scheduledAt:   { type: Date,   required: true },
  createdBy:     { type: String, default: '' },
  channelId:     { type: String, default: '' },
  status:        { type: String, enum: ['pending', 'done', 'cancelled'], default: 'pending' },
  reminder60:    { type: Boolean, default: false },
  reminder15:    { type: Boolean, default: false },
  createdAt:     { type: Date,   default: Date.now },
});

matchPlanSchema.index({ guildId: 1, scheduledAt: 1 });

module.exports = mongoose.model('MatchPlan', matchPlanSchema);
