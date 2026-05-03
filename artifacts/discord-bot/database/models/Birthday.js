const mongoose = require('mongoose');

const birthdaySchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  day: { type: Number, required: true },
  month: { type: Number, required: true },
  year: { type: Number, default: null }
}, { timestamps: true });

birthdaySchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('Birthday', birthdaySchema);
