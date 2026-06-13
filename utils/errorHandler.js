const { EmbedBuilder } = require('discord.js');
const ErrorLog = require('../database/models/ErrorLog');

function extractCommand(stack) {
  if (!stack) return null;
  const match = stack.match(/commands[\\/](\w+)\.js/);
  return match ? `!${match[1]}` : null;
}

async function logError({ source = 'unhandledRejection', error, context = {} }) {
  const err = error instanceof Error ? error : new Error(String(error));
  const command = context.command || extractCommand(err.stack);

  try {
    await ErrorLog.create({
      source,
      command,
      errorMessage: err.message?.slice(0, 512) || String(err).slice(0, 512),
      stack: err.stack?.slice(0, 2000) || null,
      guildId: context.guildId || null,
      guildName: context.guildName || null,
      userId: context.userId || null,
      userTag: context.userTag || null,
      channelId: context.channelId || null,
    });
  } catch (dbErr) {
    console.error('[errorHandler] Impossible de sauvegarder en DB:', dbErr.message);
  }
}

function setupErrorHandler(client) {
  async function sendDiscordAlert(title, error) {
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

  client.on('error', (error) => {
    console.error('❌ Erreur Discord client:', error);
    logError({ source: 'discordError', error });
    sendDiscordAlert('Erreur Discord Client', error);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('❌ Promesse rejetée non gérée:', reason);
    logError({ source: 'unhandledRejection', error: reason });
    sendDiscordAlert('Promesse rejetée non gérée', reason);
  });

  process.on('uncaughtException', (error) => {
    console.error('❌ Exception non capturée:', error);
    logError({ source: 'uncaughtException', error });
    sendDiscordAlert('Exception non capturée', error);
  });

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

module.exports = { setupErrorHandler, logError };
