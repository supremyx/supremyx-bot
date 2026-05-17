const mongoose = require('mongoose');

const matchEntrySchema = new mongoose.Schema({
  date:           { type: Date,   default: Date.now },
  kills:          { type: Number, default: 0 },
  teamPlacement:  { type: Number, default: 0 },
  tournamentName: { type: String, default: '' },
  matchId:        { type: String, default: '' },
}, { _id: false });

const playerStatSchema = new mongoose.Schema({
  guildId:      { type: String, required: true },
  teamName:     { type: String, required: true },
  displayName:  { type: String, required: true },
  userId:       { type: String, default: '' },
  totalKills:   { type: Number, default: 0 },
  totalMatches: { type: Number, default: 0 },
  bestKills:    { type: Number, default: 0 },
  history:      [matchEntrySchema],
}, { timestamps: true });

playerStatSchema.index({ guildId: 1, teamName: 1, displayName: 1 }, { unique: true });

module.exports = mongoose.model('PlayerStat', playerStatSchema);
