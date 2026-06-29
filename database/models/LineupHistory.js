const mongoose = require('mongoose');

const lineupHistorySchema = new mongoose.Schema({
  guildId:    { type: String, required: true },
  teamName:   { type: String, required: true },
  players:    [{ type: String }],
  setBy:      { type: String, default: '' },
  setAt:      { type: Date,   default: Date.now },
  matchNote:  { type: String, default: '' },
});

lineupHistorySchema.index({ guildId: 1, teamName: 1, setAt: -1 });

module.exports = mongoose.model('LineupHistory', lineupHistorySchema);
