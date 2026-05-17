const mongoose = require('mongoose');

const scheduleConfigSchema = new mongoose.Schema({
  guildId:   { type: String, required: true, unique: true },
  channelId: { type: String, default: '' },
  remind24h: { type: Boolean, default: true },
  remind1h:  { type: Boolean, default: true },
  remind15m: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('ScheduleConfig', scheduleConfigSchema);
