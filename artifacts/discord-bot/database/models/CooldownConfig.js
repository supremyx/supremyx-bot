const mongoose = require('mongoose');

const cooldownConfigSchema = new mongoose.Schema({
  command: { type: String, required: true, unique: true },
  seconds: { type: Number, required: true, min: 0 },
  updatedBy: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('CooldownConfig', cooldownConfigSchema);
