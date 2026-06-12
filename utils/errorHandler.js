const { EmbedBuilder } = require('discord.js');
const { getLogChannelId } = require('./channelConfig');

function setupErrorHandler(client) {
  async function sendErrorLog(title, error) {
    const channelId = getLogChannelId();
    if (!channelId) return;

    const channel = client.channels.cache.get(channelId);
    if (!channel) return;

    const message = error?.message || String(error);
    const stack = error?.stack ? error.stack.slice(0, 1000) : 'Pas de stack disponible';

    const embed = new EmbedBuilder()
      .setTitle(`🚨 ${title}`)
      .setColor(0xED4245)
      .addFields(
        { name: '❌ Erreur', value: `\`\`\`${message}\`\`\`` },
        { name: '📋 Stack trace', value: `\`\`\`${stack}\`\`\`` }
      )
      .setTimestamp();

    await channel.send({ embeds: [embed] }).catch(() => {});
  }

  // Erreur Discord (ex: permissions manquantes, message supprimé, etc.)
  client.on('error', (error) => {
    console.error('❌ Erreur Discord client:', error);
    sendErrorLog('Erreur Discord Client', error);
  });

  // Promesse rejetée non gérée (ex: DB timeout, fetch échoué)
  process.on('unhandledRejection', (reason) => {
    console.error('❌ Promesse rejetée non gérée:', reason);
    sendErrorLog('Promesse rejetée non gérée', reason);
  });

  // Exception non capturée (ex: bug inattendu dans une commande)
  process.on('uncaughtException', (error) => {
    console.error('❌ Exception non capturée:', error);
    sendErrorLog('Exception non capturée', error);
  });

  // Arrêt propre — ferme la connexion MongoDB avant de quitter
  async function gracefulShutdown(signal) {
    console.log(`⚠️ Signal ${signal} reçu — arrêt propre en cours...`);
    try {
      const mongoose = require('mongoose');
      await mongoose.connection.close();
      console.log('✅ MongoDB déconnecté proprement.');
    } catch (e) {
      console.error('❌ Erreur lors de la déconnexion MongoDB:', e);
    }
    process.exit(0);
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
}

module.exports = { setupErrorHandler };
