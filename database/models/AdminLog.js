const mongoose = require('mongoose');

const adminLogSchema = new mongoose.Schema({
  guildId:   { type: String, index: true },
  guildName: { type: String, default: null },
  userId:    { type: String, default: null },
  userTag:   { type: String, default: null },
  channelId: { type: String, default: null },
  action:    { type: String, required: true },
  category:  { type: String, default: 'général' },
  detail:    { type: String, default: null },
  severity:  { type: String, enum: ['info', 'warn', 'critical'], default: 'info' },
}, { timestamps: true });

adminLogSchema.index({ guildId: 1, createdAt: -1 });
adminLogSchema.index({ category: 1, createdAt: -1 });
adminLogSchema.index({ severity: 1, createdAt: -1 });

module.exports = mongoose.model('AdminLog', adminLogSchema);
