const mongoose = require('mongoose');

const iaLatencySchema = new mongoose.Schema({
  model:     { type: String, required: true },
  latencyMs: { type: Number, required: true },
  success:   { type: Boolean, default: true },
  isFallback:{ type: Boolean, default: false },
  status:    { type: Number, default: null },
  guildId:   { type: String, default: null },
  measuredAt:{ type: Date, default: Date.now },
}, { timestamps: false });

iaLatencySchema.index({ model: 1, measuredAt: -1 });
iaLatencySchema.index({ measuredAt: -1 });

module.exports = mongoose.model('IaLatency', iaLatencySchema);
