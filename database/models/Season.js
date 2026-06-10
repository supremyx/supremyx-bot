const mongoose = require('mongoose');

const seasonSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  active: { type: Boolean, default: true },
  startedBy: { type: String, default: '' },
  endedBy: { type: String, default: '' },
  endedAt: { type: Date, default: null },
  snapshot: [
    {
      rank: Number,
      name: String,
      points: Number,
      kills: Number,
      wins: Number,
      losses: Number
    }
  ]
}, { timestamps: true });

seasonSchema.index(
  { active: 1 },
  { unique: true, partialFilterExpression: { active: true } }
);

module.exports = mongoose.model('Season', seasonSchema);
