const mongoose = require('mongoose');

const achievementSchema = new mongoose.Schema({
  target: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  icon: { type: String, default: '🏅' },
  awardedBy: { type: String, required: true },
  autoId: { type: String, default: null }
}, { timestamps: true });

achievementSchema.index({ target: 1 });
achievementSchema.index({ target: 1, autoId: 1 });

module.exports = mongoose.models.Achievement || mongoose.model('Achievement', achievementSchema);
