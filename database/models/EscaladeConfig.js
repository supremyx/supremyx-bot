const mongoose = require('mongoose');

const escaladeConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: true },
  rules: [
    {
      warnCount: { type: Number, required: true },
      action: { type: String, enum: ['mute', 'kick', 'ban'], required: true },
      duration: { type: Number, default: null } // minutes (null = permanent for ban)
    }
  ]
}, { timestamps: true });

module.exports = mongoose.model('EscaladeConfig', escaladeConfigSchema);
