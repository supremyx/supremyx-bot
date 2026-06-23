const mongoose = require('mongoose');

const rapportHebdoConfigSchema = new mongoose.Schema({
  guildId:   { type: String, required: true, unique: true },
  channelId: { type: String, default: '' },
  active:    { type: Boolean, default: false },
  lastSentAt:{ type: Date,   default: null },
}, { timestamps: true });

module.exports = mongoose.model('RapportHebdoConfig', rapportHebdoConfigSchema);
