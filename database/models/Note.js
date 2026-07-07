const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  guildId: { type: String, default: null },
  target: { type: String, required: true },
  content: { type: String, required: true },
  author: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Note', noteSchema);
