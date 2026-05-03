const mongoose = require('mongoose');

const rankRewardSchema = new mongoose.Schema({
  rank: { type: Number, required: true, unique: true },
  roleId: { type: String, required: true },
  label: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('RankReward', rankRewardSchema);
