const mongoose = require('mongoose');

const xpEntrySchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  username: { type: String, default: '' },
  xp: { type: Number, default: 0 },
  level: { type: Number, default: 0 },
  lastXpAt: { type: Date, default: null }
}, { timestamps: true });

xpEntrySchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('XpEntry', xpEntrySchema);
