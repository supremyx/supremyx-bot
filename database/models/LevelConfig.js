const mongoose = require('mongoose');

const levelConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  channelId: { type: String, default: '' },
  enabled: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('LevelConfig', levelConfigSchema);
