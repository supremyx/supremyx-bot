const mongoose = require('mongoose');

const sanctionSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  userTag: { type: String, default: '' },
  type: { type: String, enum: ['warn', 'mute', 'kick', 'ban'], required: true },
  reason: { type: String, default: 'Aucune raison précisée' },
  duration: { type: Number, default: null }, // minutes for mute, null otherwise
  moderatorId: { type: String, default: '' },
  moderatorTag: { type: String, default: '' },
  autoEscalation: { type: Boolean, default: false }, // true if applied automatically
  active: { type: Boolean, default: true }
}, { timestamps: true });

sanctionSchema.index({ guildId: 1, userId: 1 });

module.exports = mongoose.model('Sanction', sanctionSchema);
