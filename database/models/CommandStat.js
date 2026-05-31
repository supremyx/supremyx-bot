const mongoose = require('mongoose');

const commandStatSchema = new mongoose.Schema({
  command:     { type: String, required: true },
  userId:      { type: String, required: true },
  username:    { type: String, default: 'Inconnu' },
  guildId:     { type: String },
  channelId:   { type: String },
  channelName: { type: String, default: 'inconnu' },
  usedAt:      { type: Date, default: Date.now },
});

commandStatSchema.index({ command: 1 });
commandStatSchema.index({ userId: 1 });
commandStatSchema.index({ usedAt: -1 });

module.exports = mongoose.models.CommandStat || mongoose.model('CommandStat', commandStatSchema);
