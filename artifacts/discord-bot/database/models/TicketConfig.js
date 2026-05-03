const mongoose = require('mongoose');

const ticketConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  staffRoleId: { type: String, default: '' },
  transcriptChannelId: { type: String, default: '' },
  ticketCategoryId: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('TicketConfig', ticketConfigSchema);
