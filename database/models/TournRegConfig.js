const mongoose = require('mongoose');

const TournRegConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  tournamentName: { type: String, default: null },
  isOpen: { type: Boolean, default: false },
  registrationChannelId: { type: String, default: null },
  announcementChannelId: { type: String, default: null },
  boardMessageId: { type: String, default: null },
  maxTeams: { type: Number, default: 0 },
  announcementMessageId: { type: String, default: null }
});

module.exports = mongoose.model('TournRegConfig', TournRegConfigSchema);
