const mongoose = require('mongoose');

const maintenanceConfigSchema = new mongoose.Schema({
  guildId:    { type: String, required: true, unique: true },
  active:     { type: Boolean, default: false },
  message:    { type: String, default: '🛠️ Le bot est en maintenance. Revenez plus tard !' },
  startedBy:  { type: String, default: null },
  startedTag: { type: String, default: null },
  startedAt:  { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('MaintenanceConfig', maintenanceConfigSchema);
