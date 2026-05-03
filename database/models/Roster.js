const mongoose = require('mongoose');

const MemberSchema = new mongoose.Schema({
  userId: { type: String, default: '' },
  userTag: { type: String, default: '' },
  displayName: { type: String, required: true },
  role: {
    type: String,
    enum: ['IGL', 'Fragger', 'Support', 'Sniper', 'Entry', 'Flex', 'Coach', 'Remplaçant'],
    default: 'Flex'
  },
  note: { type: String, default: '' },
  joinedAt: { type: Date, default: Date.now }
});

const RosterSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  teamName: { type: String, required: true },
  members: [MemberSchema],
  updatedAt: { type: Date, default: Date.now }
});

RosterSchema.index({ guildId: 1, teamName: 1 }, { unique: true });

module.exports = mongoose.model('Roster', RosterSchema);
