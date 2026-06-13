const mongoose = require('mongoose');

const errorLogSchema = new mongoose.Schema({
  source: {
    type: String,
    enum: ['uncaughtException', 'unhandledRejection', 'discordError', 'command'],
    default: 'unhandledRejection'
  },
  command: { type: String, default: null },
  errorMessage: { type: String, required: true },
  stack: { type: String, default: null },
  guildId: { type: String, default: null },
  guildName: { type: String, default: null },
  userId: { type: String, default: null },
  userTag: { type: String, default: null },
  channelId: { type: String, default: null },
  resolved: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('ErrorLog', errorLogSchema);
