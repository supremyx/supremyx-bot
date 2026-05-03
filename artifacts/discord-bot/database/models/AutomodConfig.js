const mongoose = require('mongoose');

const automodConfigSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('AutomodConfig', automodConfigSchema);
