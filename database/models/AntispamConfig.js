const mongoose = require('mongoose');

const antispamConfigSchema = new mongoose.Schema({
  guildId:            { type: String },
  enabled:            { type: Boolean, default: true },
  maxMessages:        { type: Number, default: 5 },
  windowSeconds:      { type: Number, default: 5 },
  autoDelete:         { type: Boolean, default: true },
  autoTimeout:        { type: Boolean, default: false },
  timeoutMinutes:     { type: Number, default: 5 },
  violationThreshold: { type: Number, default: 3 },
}, { timestamps: true });

module.exports = mongoose.model('AntispamConfig', antispamConfigSchema);
