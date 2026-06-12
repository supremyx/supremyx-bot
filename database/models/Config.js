const mongoose = require('mongoose');

const configSchema = new mongoose.Schema({
  pointSystem: {
    type: Map,
    of: Number,
    default: () => new Map([['1',10],['2',6],['3',5],['4',4],['5',3],['6',2],['7',1],['8',1]])
  },
  killBonus: { type: Number, default: 1 },
  motd: { type: String, default: '' },
  motdSetBy: { type: String, default: '' },
  announceChannelId: { type: String, default: '' },
  logChannelId: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Config', configSchema);
