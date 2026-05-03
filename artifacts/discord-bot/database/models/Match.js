const mongoose = require('mongoose');

const MatchSchema = new mongoose.Schema({
  team: {
    type: String,
    required: true
  },
  placement: {
    type: Number,
    required: true
  },
  kills: {
    type: Number,
    required: true
  },
  points: {
    type: Number,
    required: true
  },
  tournamentId: {
    type: String,
    default: null
  },
  tournamentName: {
    type: String,
    default: null
  },
  addedBy: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Match', MatchSchema);
