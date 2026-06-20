const mongoose = require('mongoose');
const DispoSchema = new mongoose.Schema({
  guildId:    { type: String, required: true },
  userId:     { type: String, required: true },
  username:   { type: String, required: true },
  teamName:   { type: String, default: null },
  scheduleId: { type: String, default: null },
  status:     { type: String, enum: ['oui', 'non', 'incertain'], required: true },
  raison:     { type: String, default: '' },
  createdAt:  { type: Date, default: Date.now },
});
DispoSchema.index({ guildId: 1, userId: 1 });
DispoSchema.index({ guildId: 1, scheduleId: 1 });
module.exports = mongoose.models.Disponibilite || mongoose.model('Disponibilite', DispoSchema);
