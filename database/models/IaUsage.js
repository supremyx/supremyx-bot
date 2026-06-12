const mongoose = require('mongoose');

const iaUsageSchema = new mongoose.Schema({
  guildId:   { type: String, required: true },
  userId:    { type: String, required: true },
  username:  { type: String, required: true },
  modelAlias:{ type: String, required: true },
  usedAt:    { type: Date,   default: Date.now },
}, { timestamps: false });

iaUsageSchema.index({ guildId: 1 });
iaUsageSchema.index({ usedAt: -1 });

module.exports = mongoose.model('IaUsage', iaUsageSchema);
