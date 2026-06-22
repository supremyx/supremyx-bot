const mongoose = require('mongoose');

const RegistrationSchema = new mongoose.Schema({
  guildId:      { type: String, required: true },
  teamName:     { type: String, required: true },
  tag:          { type: String, required: true },
  captainId:    { type: String, required: true },
  captainTag:   { type: String, default: '' },
  position:     { type: Number, required: true },
  status:       { type: String, enum: ['pending', 'confirmed', 'rejected'], default: 'pending' },
  vip:          { type: Boolean, default: false },
  registeredBy: { type: String, default: '' },
  messageId:    { type: String, default: '' },
}, { timestamps: true });

RegistrationSchema.index({ guildId: 1, status: 1 });
RegistrationSchema.index({ guildId: 1, tag: 1 });

module.exports = mongoose.model('Registration', RegistrationSchema);
