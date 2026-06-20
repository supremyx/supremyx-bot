const mongoose = require('mongoose');
const ChannelMultiplierSchema = new mongoose.Schema({
  guildId:    { type: String, required: true },
  channelId:  { type: String, required: true },
  multiplier: { type: Number, default: 1, min: 0, max: 10 },
});
ChannelMultiplierSchema.index({ guildId: 1, channelId: 1 }, { unique: true });
module.exports = mongoose.models.ChannelMultiplier || mongoose.model('ChannelMultiplier', ChannelMultiplierSchema);
