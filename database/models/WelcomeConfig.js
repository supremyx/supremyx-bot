const mongoose = require('mongoose');

const welcomeConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  channelId: { type: String, default: '' },
  message: { type: String, default: 'Bienvenue {user} sur **{server}** ! 🎉 Tu es notre **{count}e** membre.' },
  enabled: { type: Boolean, default: true },
  cardTitle: { type: String, default: 'WELCOME' },
  cardSubtitle: { type: String, default: 'HELLO AND WELCOME TO {server}' },
  cardColor: { type: String, default: '#5B2A86' },
  cardAccentColor: { type: String, default: '#F5C518' }
}, { timestamps: true });

module.exports = mongoose.model('WelcomeConfig', welcomeConfigSchema);
