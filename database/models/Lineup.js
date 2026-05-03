const mongoose = require('mongoose');

const lineupSchema = new mongoose.Schema({
  team: { type: String, required: true, unique: true },
  players: [{ type: String }],
  updatedBy: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Lineup', lineupSchema);
