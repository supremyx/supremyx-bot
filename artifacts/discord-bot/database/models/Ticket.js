const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  channelId: { type: String, required: true },
  userId: { type: String, required: true },
  userTag: { type: String, required: true },
  subject: { type: String, default: '' },
  category: { type: String, enum: ['support', 'signalement', 'candidature'], default: 'support' },
  status: { type: String, enum: ['ouvert', 'en_cours', 'résolu', 'fermé'], default: 'ouvert' },
  claimedBy: { type: String, default: '' },
  claimedByTag: { type: String, default: '' },
  closed: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Ticket', ticketSchema);
