const mongoose = require('mongoose');

const suggestionSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  authorId: { type: String, required: true },
  authorTag: { type: String, default: '' },
  text: { type: String, required: true },
  messageId: { type: String, default: '' },
  channelId: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  staffNote: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Suggestion', suggestionSchema);
