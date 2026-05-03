const { EmbedBuilder } = require('discord.js');

function setupErrorHandler(client) {
  async function sendErrorLog(title, error) {
    const channelId = process.env.LOG_CHANNEL_ID;
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
}

module.exports = { setupErrorHandler };
