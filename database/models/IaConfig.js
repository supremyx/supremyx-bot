const mongoose = require('mongoose');

const iaConfigSchema = new mongoose.Schema({
  guildId:             { type: String, required: true, unique: true },
  model:               { type: String, default: 'gpt-4o-mini' },
  dailyQuota:          { type: Number, default: 0 },
  quotaAlertChannelId: { type: String, default: null },
  debriefChannelId:    { type: String, default: null },
  bilanChannelId:      { type: String, default: null },
  bilanLastSentAt:      { type: Date,   default: null },
  perfAlertChannelId:   { type: String, default: null },
  latencyThresholdMs:   { type: Number, default: 5000 },
  failureRateThreshold: { type: Number, default: 50 },
  fallbackModels:       { type: [String], default: [] },
}, { timestamps: true });

module.exports = mongoose.model('IaConfig', iaConfigSchema);
