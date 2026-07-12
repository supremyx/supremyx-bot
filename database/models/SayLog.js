const mongoose = require('mongoose');

const sayLogSchema = new mongoose.Schema({
  guildId:     { type: String, required: true },
  channelId:   { type: String, required: true },
  channelName: { type: String },
  authorId:    { type: String, required: true },
  authorTag:   { type: String, required: true },
  content:     { type: String, default: '' },
  mediaUrls:   { type: [String], default: [] },
}, { timestamps: true });

sayLogSchema.index({ guildId: 1, createdAt: -1 });

module.exports = mongoose.model('SayLog', sayLogSchema);
