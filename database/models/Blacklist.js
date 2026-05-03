const mongoose = require('mongoose');

const blacklistSchema = new mongoose.Schema({
  target: { type: String, required: true, unique: true },
  reason: { type: String, default: 'Aucune raison précisée' },
  addedBy: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Blacklist', blacklistSchema);
