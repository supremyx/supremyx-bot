const mongoose = require('mongoose');

const TournamentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  active: {
    type: Boolean,
    default: true
  },
  startedBy: {
    type: String
  },
  endedBy: {
    type: String
  },
  winner: {
    type: String,
    default: null
  },
  totalMatches: {
    type: Number,
    default: 0
  },
  totalKills: {
    type: Number,
    default: 0
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  endedAt: {
    type: Date,
    default: null
  }
});

module.exports = mongoose.model('Tournament', TournamentSchema);
