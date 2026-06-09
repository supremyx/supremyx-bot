const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
  date:           { type: Date, required: true },
  teams:          [{ type: String, required: true }],
  note:           { type: String, default: '' },
  tournamentName: { type: String, default: '' },
  createdBy:      { type: String },
  reminded24h:    { type: Boolean, default: false },
  reminded1h:     { type: Boolean, default: false },
  reminded30m:    { type: Boolean, default: false },
  reminded15m:    { type: Boolean, default: false },
  completed:      { type: Boolean, default: false },
  resultPostedAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Schedule', scheduleSchema);
