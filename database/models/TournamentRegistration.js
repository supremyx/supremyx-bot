const mongoose = require('mongoose');

const TournamentRegistrationSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  tournamentName: { type: String, required: true },
  teamName: { type: String, required: true },
  players: [{ type: String }],
  contact: { type: String, required: true },
  contactId: { type: String, required: true },
  status: { type: String, enum: ['pending', 'accepted', 'refused'], default: 'pending' },
  refuseReason: { type: String, default: null },
  reviewedBy: { type: String, default: null },
  reviewedAt: { type: Date, default: null },
  embedMessageId: { type: String, default: null },
  registeredAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('TournamentRegistration', TournamentRegistrationSchema);
