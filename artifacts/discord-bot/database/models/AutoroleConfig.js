const mongoose = require('mongoose');

const autoroleConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  roleId: { type: String, required: true },
  enabled: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('AutoroleConfig', autoroleConfigSchema);
