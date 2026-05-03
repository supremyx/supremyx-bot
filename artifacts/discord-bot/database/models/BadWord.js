const mongoose = require('mongoose');

const badWordSchema = new mongoose.Schema({
  word: { type: String, required: true, unique: true, lowercase: true },
  addedBy: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('BadWord', badWordSchema);
