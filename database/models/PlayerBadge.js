const mongoose = require('mongoose');

const playerBadgeSchema = new mongoose.Schema({
  guildId:     { type: String, required: true },
  displayName: { type: String, required: true },
  teamName:    { type: String, default: '' },
  badgeName:   { type: String, required: true },
  emoji:       { type: String, default: '🏅' },
  description: { type: String, default: '' },
  awardedBy:   { type: String, default: '' },
  awardedAt:   { type: Date,   default: Date.now },
});

playerBadgeSchema.index({ guildId: 1, displayName: 1 });
playerBadgeSchema.index({ guildId: 1, badgeName: 1 });

module.exports = mongoose.model('PlayerBadge', playerBadgeSchema);
