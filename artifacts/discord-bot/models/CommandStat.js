const mongoose = require('mongoose');

const commandStatSchema = new mongoose.Schema({
  command:   { type: String, required: true, index: true },
  userId:    { type: String, required: true, index: true },
  username:  { type: String, required: true },
  channelId: { type: String, required: true, index: true },
  channelName: { type: String, default: '?' },
  guildId:   { type: String, required: true },
  usedAt:    { type: Date, default: Date.now, index: true }
});

module.exports = mongoose.model('CommandStat', commandStatSchema);
