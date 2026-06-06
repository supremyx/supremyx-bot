const mongoose = require('mongoose');

const DraftSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  messageId: { type: String, default: '' },
  channelId: { type: String, default: '' },
  teams: [{ type: String }],
  pool: [{ type: String }],
  picks: [{
    team: { type: String },
    player: { type: String },
    round: { type: Number }
  }],
  currentTeamIndex: { type: Number, default: 0 },
  currentRound: { type: Number, default: 1 },
  snakeReversed: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

DraftSchema.index({ guildId: 1, active: 1 });

module.exports = mongoose.models.Draft || mongoose.model('Draft', DraftSchema);
