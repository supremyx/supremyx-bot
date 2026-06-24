const mongoose = require('mongoose');

const bilanHebdoSchema = new mongoose.Schema({
  guildId:      { type: String, required: true },
  weekFrom:     { type: Date,   required: true },
  weekTo:       { type: Date,   required: true },
  triggeredBy:  { type: String, default: 'auto' },
  modelAlias:   { type: String, default: 'gpt-4o-mini' },
  iaText:       { type: String, default: null },
  stats: {
    totalMatches:  { type: Number, default: 0 },
    totalKills:    { type: Number, default: 0 },
    avgKills:      { type: String, default: '0' },
    wins:          { type: Number, default: 0 },
    topTeams:      { type: Array,  default: [] },
    topWeekTeams:  { type: Array,  default: [] },
    topWeekPlayers:{ type: Array,  default: [] },
    bestKillMatch: { type: Object, default: null },
    activeTournament: { type: String, default: null },
  },
}, { timestamps: true });

bilanHebdoSchema.index({ guildId: 1, createdAt: -1 });

module.exports = mongoose.model('BilanHebdo', bilanHebdoSchema);
