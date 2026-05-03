const mongoose = require('mongoose');

const welcomeConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  channelId: { type: String, default: '' },
  message: { type: String, default: 'Bienvenue {user} sur **{server}** ! 🎉 Tu es notre **{count}e** membre.' },
  enabled: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('WelcomeConfig', welcomeConfigSchema);
