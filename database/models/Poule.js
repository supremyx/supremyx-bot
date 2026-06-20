const mongoose = require('mongoose');
const PouleSchema = new mongoose.Schema({
  guildId:      { type: String, required: true },
  tournamentId: { type: String, default: null },
  letter:       { type: String, required: true },
  teams:        [String],
  createdAt:    { type: Date, default: Date.now },
});
PouleSchema.index({ guildId: 1, letter: 1 });
module.exports = mongoose.models.Poule || mongoose.model('Poule', PouleSchema);
