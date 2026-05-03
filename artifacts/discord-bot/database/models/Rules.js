const mongoose = require('mongoose');

const rulesSchema = new mongoose.Schema({
  title: { type: String, default: 'Règles du tournoi' },
  rules: [{ type: String }],
  updatedBy: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Rules', rulesSchema);
