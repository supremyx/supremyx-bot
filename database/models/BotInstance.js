const mongoose = require('mongoose');

const botInstanceSchema = new mongoose.Schema({
  instanceId: { type: String, required: true, unique: true },
  pid:        { type: Number, required: true },
  startedAt:  { type: Date, default: Date.now },
  heartbeat:  { type: Date, default: Date.now }
}, { timestamps: false });

botInstanceSchema.index({ heartbeat: 1 }, { expireAfterSeconds: 30 });

module.exports = mongoose.model('BotInstance', botInstanceSchema);
