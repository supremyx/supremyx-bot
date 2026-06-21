const mongoose = require('mongoose');

const sondageProgSchema = new mongoose.Schema({
  guildId:     { type: String, required: true },
  channelId:   { type: String, required: true },
  question:    { type: String, required: true },
  options:     [{ type: String }],
  scheduledAt: { type: Date, required: true },
  durationMs:  { type: Number, default: 3600000 },
  createdBy:   { type: String, default: '' },
  launched:    { type: Boolean, default: false },
  messageId:   { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.models.SondageProg || mongoose.model('SondageProg', sondageProgSchema);
