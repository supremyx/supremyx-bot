const mongoose = require('mongoose');

const iaConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  model:   { type: String, default: 'gpt-4o-mini' },
}, { timestamps: true });

module.exports = mongoose.model('IaConfig', iaConfigSchema);
