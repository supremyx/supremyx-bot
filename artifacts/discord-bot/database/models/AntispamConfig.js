const mongoose = require('mongoose');

const antispamConfigSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: true },
  maxMessages: { type: Number, default: 5 },
  windowSeconds: { type: Number, default: 5 }
}, { timestamps: true });

module.exports = mongoose.model('AntispamConfig', antispamConfigSchema);
