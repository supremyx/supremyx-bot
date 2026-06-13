const mongoose = require('mongoose');

const diffuseurConfigSchema = new mongoose.Schema({
  guildId:  { type: String, required: true, unique: true },
  canaux:   { type: [String], default: [] }
}, { timestamps: true });

module.exports = mongoose.model('DiffuseurConfig', diffuseurConfigSchema);
