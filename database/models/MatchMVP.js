const mongoose = require('mongoose');

const matchMVPSchema = new mongoose.Schema({
  guildId:        { type: String, required: true },
  matchId:        { type: String, required: true },
  displayName:    { type: String, required: true },
  teamName:       { type: String, default: '' },
  kills:          { type: Number, default: 0 },
  tournamentName: { type: String, default: '' },
  awardedBy:      { type: String, default: '' },
  awardedAt:      { type: Date,   default: Date.now },
});

matchMVPSchema.index({ guildId: 1, matchId: 1 }, { unique: true });
matchMVPSchema.index({ guildId: 1, displayName: 1 });

module.exports = mongoose.model('MatchMVP', matchMVPSchema);
