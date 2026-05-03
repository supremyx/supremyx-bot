const mongoose = require('mongoose');

const sectionSchema = new mongoose.Schema({
  emoji: { type: String, default: '📌' },
  title: { type: String, required: true },
  rules: [{ type: String }]
}, { _id: true });

const reglementSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  title: { type: String, default: '📖 Règlement officiel' },
  intro: { type: String, default: '' },
  sections: [sectionSchema],
  pinnedChannelId: { type: String, default: '' },
  pinnedMessageId: { type: String, default: '' },
  updatedBy: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Reglement', reglementSchema);
