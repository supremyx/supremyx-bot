const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  guildId:   { type: String, required: true },
  type:      { type: String, required: true },
  category:  { type: String, default: 'general' },
  actorId:   { type: String },
  actorTag:  { type: String },
  targetId:  { type: String },
  targetTag: { type: String },
  channelId: { type: String },
  details:   { type: mongoose.Schema.Types.Mixed, default: {} },
  severity:  { type: String, enum: ['info', 'warn', 'critical'], default: 'info' },
}, { timestamps: true });

auditLogSchema.index({ guildId: 1, createdAt: -1 });
auditLogSchema.index({ guildId: 1, type: 1 });
auditLogSchema.index({ guildId: 1, category: 1 });
// Auto-expire after 30 days
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
