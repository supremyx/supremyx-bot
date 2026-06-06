const mongoose = require('mongoose');

const VoteSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  userTag: { type: String, required: true },
  choice: { type: String, required: true },
  votedAt: { type: Date, default: Date.now }
});

const PredictionSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  messageId: { type: String, default: '' },
  channelId: { type: String, default: '' },
  teamA: { type: String, required: true },
  teamB: { type: String, required: true },
  description: { type: String, default: '' },
  votes: [VoteSchema],
  result: { type: String, default: null },
  closed: { type: Boolean, default: false },
  createdBy: { type: String, required: true },
  closedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

PredictionSchema.index({ guildId: 1, closed: 1 });

module.exports = mongoose.models.Prediction || mongoose.model('Prediction', PredictionSchema);
