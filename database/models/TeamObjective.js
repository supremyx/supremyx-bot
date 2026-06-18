const mongoose = require('mongoose');

const TeamObjectiveSchema = new mongoose.Schema({
  guildId:    { type: String, required: true },
  teamName:   { type: String, required: true },
  objective:  { type: String, required: true },
  setBy:      { type: String, default: '' },
  updatedAt:  { type: Date,   default: Date.now }
});

TeamObjectiveSchema.index({ guildId: 1, teamName: 1 }, { unique: true });

module.exports = mongoose.model('TeamObjective', TeamObjectiveSchema);
