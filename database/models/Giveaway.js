const mongoose = require('mongoose');

const giveawaySchema = new mongoose.Schema({
  guildId:      { type: String, required: true, index: true },
  channelId:    { type: String, required: true },
  messageId:    { type: String, required: true, unique: true },
  prize:        { type: String, required: true },
  host:         { type: String, required: true },
  endsAt:       { type: Date,   required: true },
  ended:        { type: Boolean, default: false },
  winnerId:     { type: String, default: null },
  winnerTag:    { type: String, default: null },
  participants: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Giveaway', giveawaySchema);
