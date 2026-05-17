const mongoose = require('mongoose');

const resultConfigSchema = new mongoose.Schema({
  guildId:   { type: String, required: true, unique: true },
  channelId: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('ResultConfig', resultConfigSchema);
