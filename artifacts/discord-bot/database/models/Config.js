const mongoose = require('mongoose');

const configSchema = new mongoose.Schema({
  pointSystem: {
    type: Map,
    of: Number,
    default: () => new Map([['1',12],['2',9],['3',7],['4',5],['5',4],['6',3],['7',2],['8',1]])
  },
  killBonus: { type: Number, default: 1 },
  motd: { type: String, default: '' },
  motdSetBy: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Config', configSchema);
