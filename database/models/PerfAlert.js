const mongoose = require('mongoose');
const PerfAlertSchema = new mongoose.Schema({
  guildId:   { type: String, required: true },
  teamName:  { type: String, required: true },
  type:      { type: String, enum: ['points', 'podium'], default: 'points' },
  seuil:     { type: Number, default: 0 },
  channelId: { type: String, required: true },
  lastValue: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});
PerfAlertSchema.index({ guildId: 1, teamName: 1 });
module.exports = mongoose.models.PerfAlert || mongoose.model('PerfAlert', PerfAlertSchema);
