const mongoose = require('mongoose');

const antiLinkConfigSchema = new mongoose.Schema({
  guildId:            { type: String, required: true, unique: true },
  enabled:            { type: Boolean, default: false },
  blockDiscordInvites:{ type: Boolean, default: true },
  blockExternalLinks: { type: Boolean, default: false },
  allowedDomains:     { type: [String], default: [] },
  exemptRoles:        { type: [String], default: [] },
  exemptChannels:     { type: [String], default: [] },
  action:             { type: String, enum: ['delete', 'delete_warn', 'delete_timeout'], default: 'delete_warn' },
  timeoutSeconds:     { type: Number, default: 300 },
  violationThreshold: { type: Number, default: 3 },
}, { timestamps: true });

module.exports = mongoose.model('AntiLinkConfig', antiLinkConfigSchema);
