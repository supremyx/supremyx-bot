const mongoose = require('mongoose');

const RoundSchema = new mongoose.Schema({
  round: { type: Number, required: true },
  scores: [{
    team: { type: String },
    kills: { type: Number, default: 0 },
    placement: { type: Number, default: 0 },
    points: { type: Number, default: 0 }
  }],
  addedAt: { type: Date, default: Date.now }
});

const LiveScoreSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  channelId: { type: String, required: true },
  messageId: { type: String, default: '' },
  matchTitle: { type: String, required: true },
  teams: [{ type: String }],
  rounds: [RoundSchema],
  active: { type: Boolean, default: true },
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  endedAt: { type: Date, default: null }
});

LiveScoreSchema.index({ guildId: 1, active: 1 });

module.exports = mongoose.models.LiveScore || mongoose.model('LiveScore', LiveScoreSchema);
