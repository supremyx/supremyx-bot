const mongoose = require('mongoose');

const automodConfigSchema = new mongoose.Schema({
  guildId:            { type: String },
  enabled:            { type: Boolean, default: true },
  autoDelete:         { type: Boolean, default: true },
  autoTimeout:        { type: Boolean, default: false },
  timeoutMinutes:     { type: Number, default: 10 },
  violationThreshold: { type: Number, default: 3 },
  exemptRoles:        { type: [String], default: [] },
  exemptChannels:     { type: [String], default: [] },
}, { timestamps: true });

module.exports = mongoose.model('AutomodConfig', automodConfigSchema);
