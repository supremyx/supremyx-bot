const mongoose = require('mongoose');

const InscriptionConfigSchema = new mongoose.Schema({
  guildId:               { type: String, required: true, unique: true },
  registrationChannelId: { type: String, default: '' },
  waitlistChannelId:     { type: String, default: '' },
  waitlistMessageId:     { type: String, default: '' },
  roleId:                { type: String, default: '' },
  maxSlots:              { type: Number, default: 16 },
  tournamentTitle:       { type: String, default: 'INSCRIPTIONS' },
  active:                { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('InscriptionConfig', InscriptionConfigSchema);
