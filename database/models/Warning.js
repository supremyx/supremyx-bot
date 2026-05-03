const mongoose = require('mongoose');

const warningSchema = new mongoose.Schema({
  target: { type: String, required: true },
  targetId: { type: String, default: '' },
  reason: { type: String, required: true },
  warnedBy: { type: String, required: true },
  warnedById: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Warning', warningSchema);
