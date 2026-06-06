const mongoose = require('mongoose');

const TransferSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  playerName: { type: String, required: true },
  userId: { type: String, default: '' },
  fromTeam: { type: String, required: true },
  toTeam: { type: String, required: true },
  reason: { type: String, default: '' },
  transferredBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

TransferSchema.index({ guildId: 1, createdAt: -1 });
TransferSchema.index({ guildId: 1, playerName: 1 });

module.exports = mongoose.models.Transfer || mongoose.model('Transfer', TransferSchema);
