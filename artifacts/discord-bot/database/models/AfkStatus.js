const mongoose = require('mongoose');

const afkStatusSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  message: { type: String, default: 'AFK' },
  since: { type: Date, default: Date.now }
}, { timestamps: true });

afkStatusSchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('AfkStatus', afkStatusSchema);
