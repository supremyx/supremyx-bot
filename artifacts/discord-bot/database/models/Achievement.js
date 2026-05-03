const mongoose = require('mongoose');

const achievementSchema = new mongoose.Schema({
  target: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  icon: { type: String, default: '🏅' },
  awardedBy: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Achievement', achievementSchema);
