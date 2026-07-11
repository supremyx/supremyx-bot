const mongoose = require('mongoose');

const antiRaidConfigSchema = new mongoose.Schema({
  guildId:            { type: String, required: true, unique: true },
  enabled:            { type: Boolean, default: false },
  joinThreshold:      { type: Number, default: 10 },
  joinWindowSeconds:  { type: Number, default: 10 },
  minAccountAgeDays:  { type: Number, default: 7 },
  action:             { type: String, enum: ['alert', 'kick', 'ban', 'lockdown'], default: 'alert' },
  autoUnlockMinutes:  { type: Number, default: 30 },
  lockdownActive:     { type: Boolean, default: false },
  lockdownAt:         { type: Date, default: null },
  lastRaidAt:         { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('AntiRaidConfig', antiRaidConfigSchema);
