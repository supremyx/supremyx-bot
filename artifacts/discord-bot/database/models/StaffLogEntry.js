const mongoose = require('mongoose');

const staffLogEntrySchema = new mongoose.Schema({
  message: { type: String, required: true },
  category: { type: String, default: 'général' }
}, { timestamps: true });

module.exports = mongoose.model('StaffLogEntry', staffLogEntrySchema);
