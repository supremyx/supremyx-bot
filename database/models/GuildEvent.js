const mongoose = require('mongoose');

const guildEventSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  eventNumber: { type: Number, required: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  date: { type: String, default: '' },
  channelId: { type: String, default: '' },
  messageId: { type: String, default: '' },
  createdBy: { type: String, default: '' },
  joined: [{ type: String }],
  declined: [{ type: String }],
  cancelled: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('GuildEvent', guildEventSchema);
