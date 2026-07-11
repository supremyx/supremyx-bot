const mongoose = require('mongoose');

const serverBackupSchema = new mongoose.Schema({
  guildId:    { type: String, required: true },
  name:       { type: String, required: true },
  createdBy:  { type: String, default: 'system' },
  data:       { type: mongoose.Schema.Types.Mixed, required: true },
  restoredAt: { type: Date, default: null },
}, { timestamps: true });

serverBackupSchema.index({ guildId: 1, createdAt: -1 });

module.exports = mongoose.model('ServerBackup', serverBackupSchema);
