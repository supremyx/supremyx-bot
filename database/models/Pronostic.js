const mongoose = require('mongoose');
const PronosticSchema = new mongoose.Schema({
  guildId:    { type: String, required: true },
  userId:     { type: String, required: true },
  username:   { type: String, required: true },
  team1:      { type: String, required: true },
  team2:      { type: String, required: true },
  prediction: { type: String, required: true },
  correct:    { type: Boolean, default: null },
  resolvedAt: { type: Date, default: null },
  createdAt:  { type: Date, default: Date.now },
});
PronosticSchema.index({ guildId: 1, userId: 1 });
PronosticSchema.index({ guildId: 1, team1: 1, team2: 1 });
module.exports = mongoose.models.Pronostic || mongoose.model('Pronostic', PronosticSchema);
