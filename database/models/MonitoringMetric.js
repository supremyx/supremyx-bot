const mongoose = require('mongoose');

const monitoringMetricSchema = new mongoose.Schema({
  timestamp:        { type: Date, default: Date.now },
  memoryMB:         { type: Number },
  heapUsedMB:       { type: Number },
  uptimeSeconds:    { type: Number },
  guildCount:       { type: Number },
  commandCount24h:  { type: Number },
  wsLatency:        { type: Number },
  mongoStatus:      { type: String, enum: ['connected', 'disconnected', 'error'], default: 'connected' },
  errorCount24h:    { type: Number, default: 0 },
}, { timestamps: false });

// Auto-expire after 7 days
monitoringMetricSchema.index({ timestamp: 1 }, { expireAfterSeconds: 604800 });

module.exports = mongoose.model('MonitoringMetric', monitoringMetricSchema);
