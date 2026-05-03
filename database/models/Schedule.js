const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  teams: [{ type: String, required: true }],
  note: { type: String, default: '' },
  tournamentName: { type: String, default: '' },
  createdBy: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Schedule', scheduleSchema);
