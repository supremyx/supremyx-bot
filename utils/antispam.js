const AntispamConfig = require('../database/models/AntispamConfig');
const { EmbedBuilder } = require('discord.js');

// userId → array of message timestamps
const tracker = new Map();
// userId → last report timestamp (to avoid spamming staff)
const reported = new Map();
const REPORT_COOLDOWN = 60 * 1000; // 1 minute between reports per user

async function getOrCreateConfig() {
  let config = await AntispamConfig.findOne();
  if (!config) config = await AntispamConfig.create({});
  return config;
}

async function startAntispam(client) {
  client.on('messageCreate', async message => {
    if (message.author.bot) return;

    try {
      const config = await AntispamConfig.findOne();
      if (!config || !config.enabled) return;

      const { maxMessages, windowSeconds } = config;
      const now = Date.now();
      const userId = message.author.id;

      // Update tracker
      if (!tracker.has(userId)) tracker.set(userId, []);
      const timestamps = tracker.get(userId);
      timestamps.push(now);

      // Keep only timestamps within the window
      const windowMs = windowSeconds * 1000;
      const recent = timestamps.filter(t => now - t < windowMs);
      tracker.set(userId, recent);

      if (recent.length < maxMessages) return;

      // Check report cooldown
      const lastReport = reported.get(userId) || 0;
      if (now - lastReport < REPORT_COOLDOWN) return;
      reported.set(userId, now);
      setTimeout(() => reported.delete(userId), REPORT_COOLDOWN);

      // React on the message
      await message.react('⏱️').catch(() => {});

      // Report to staff log channel
      const logChannelId = process.env.LOG_CHANNEL_ID;
      if (!logChannelId) return;
      const logChannel = client.channels.cache.get(logChannelId);
      if (!logChannel) return;

      const embed = new EmbedBuilder()
        .setTitle('⏱️ Spam détecté')
        .setColor(0xFEE75C)
        .addFields(
          { name: '👤 Auteur', value: `${message.author} (${message.author.tag})`, inline: true },
          { name: '📍 Salon', value: `<#${message.channel.id}>`, inline: true },
          { name: '📊 Détection', value: `**${recent.length}** messages en moins de **${windowSeconds} seconde(s)**`, inline: false },
          { name: '💬 Dernier message', value: message.content.slice(0, 500) || '*[vide]*' }
        )
        .setThumbnail(message.author.displayAvatarURL())
        .setFooter({ text: `Seuil : ${maxMessages} msg / ${windowSeconds}s • ID : ${userId}` })
        .setTimestamp();

      logChannel.send({ embeds: [embed] });

      // Reset tracker for this user after report
      tracker.set(userId, []);
    } catch (err) {
      console.error('[antispam] Erreur:', err);
    }
  });
}

module.exports = { startAntispam };
