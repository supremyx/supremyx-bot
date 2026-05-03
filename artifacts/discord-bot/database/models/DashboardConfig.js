const mongoose = require('mongoose');

const dashboardConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  channelId: { type: String, default: '' },
  autoEnabled: { type: Boolean, default: false },
  postHour: { type: Number, default: 8 } // 0-23 UTC
}, { timestamps: true });

module.exports = mongoose.model('DashboardConfig', dashboardConfigSchema);
