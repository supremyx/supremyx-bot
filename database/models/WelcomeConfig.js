const mongoose = require('mongoose');

const welcomeConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  channelId: { type: String, default: '' },
  message: { type: String, default: 'Bienvenue {user} sur **{server}** ! 🎉 Tu es notre **{count}e** membre.' },
  enabled: { type: Boolean, default: true },
  cardTitle: { type: String, default: 'BIENVENUE' },
  cardSubtitle: { type: String, default: 'WELCOME — BIENVENIDO — WILLKOMMEN — مرحباً — 欢迎' },
  cardColor: { type: String, default: '#0A0A0A' },
  cardAccentColor: { type: String, default: '#F5C518' }
}, { timestamps: true });

module.exports = mongoose.model('WelcomeConfig', welcomeConfigSchema);
