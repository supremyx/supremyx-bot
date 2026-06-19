const mongoose = require('mongoose');

const absenceSchema = new mongoose.Schema({
  guildId:   { type: String, required: true },
  userId:    { type: String, required: true },
  userTag:   { type: String, required: true },
  teamName:  { type: String, default: '' },
  raison:    { type: String, default: '' },
  until:     { type: Date,   default: null },
  active:    { type: Boolean, default: true }
}, { timestamps: true });

absenceSchema.index({ guildId: 1, userId: 1 });

module.exports = mongoose.model('Absence', absenceSchema);
