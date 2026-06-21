const mongoose = require('mongoose');

const ScheduledEmbedSchema = new mongoose.Schema({
  guildId:     { type: String, required: true },
  channelId:   { type: String, required: true },
  title:       { type: String, default: '' },
  description: { type: String, required: true },
  color:       { type: Number, default: 0x5865F2 },
  imageUrl:    { type: String, default: '' },
  footer:      { type: String, default: '' },
  scheduledAt: { type: Date, required: true },
  createdBy:   { type: String, default: '' },
  sent:        { type: Boolean, default: false },
}, { timestamps: true });

ScheduledEmbedSchema.index({ guildId: 1, sent: 1, scheduledAt: 1 });

module.exports = mongoose.model('ScheduledEmbed', ScheduledEmbedSchema);
