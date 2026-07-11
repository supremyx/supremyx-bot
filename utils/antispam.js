const AntispamConfig   = require('../database/models/AntispamConfig');
const ViolationTracker = require('../database/models/ViolationTracker');
const { EmbedBuilder } = require('discord.js');
const { getLogChannelId } = require('./channelConfig');

// cacheKey (guildId:userId) → array of message timestamps
const tracker = new Map();
// cacheKey → last report timestamp
const reported = new Map();
const REPORT_COOLDOWN = 60 * 1000;

async function trackViolation(guildId, userId) {
  const resetAt = new Date(Date.now() + 24 * 3600 * 1000);
  const doc = await ViolationTracker.findOneAndUpdate(
    { guildId, userId, type: 'spam' },
    { $inc: { count: 1 }, $set: { lastAt: new Date(), resetAt } },
    { upsert: true, new: true }
  );
  return doc.count;
}

async function startAntispam(client) {
  client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (!message.guild) return;

    try {
      const config = await AntispamConfig.findOne();
      if (!config || !config.enabled) return;

      const { maxMessages, windowSeconds } = config;
      const now = Date.now();
      const cacheKey = `${message.guild.id}:${message.author.id}`;

      if (!tracker.has(cacheKey)) tracker.set(cacheKey, []);
      const timestamps = tracker.get(cacheKey);
      timestamps.push(now);

      const windowMs = windowSeconds * 1000;
      const recent = timestamps.filter(t => now - t < windowMs);
      tracker.set(cacheKey, recent);

      if (recent.length < maxMessages) return;

      const lastReport = reported.get(cacheKey) || 0;
      if (now - lastReport < REPORT_COOLDOWN) return;
      reported.set(cacheKey, now);
      setTimeout(() => reported.delete(cacheKey), REPORT_COOLDOWN);

      // Auto-delete spam messages
      if (config.autoDelete !== false) {
        try {
          const fetched = await message.channel.messages.fetch({ limit: 10 });
          const spamMsgs = fetched.filter(m => m.author.id === message.author.id);
          if (spamMsgs.size > 1) {
            await message.channel.bulkDelete(spamMsgs, true).catch(() => {});
          } else {
            await message.delete().catch(() => {});
          }
        } catch { /* channel may not support bulkDelete */ }
      } else {
        await message.react('⏱️').catch(() => {});
      }

      // Track violations and maybe timeout
      const guildId = message.guild.id;
      const threshold = config.violationThreshold ?? 3;
      const violationCount = await trackViolation(guildId, message.author.id);

      if (config.autoTimeout && violationCount >= threshold && message.member) {
        const minutes = config.timeoutMinutes ?? 5;
        await message.member.timeout(minutes * 60 * 1000, `AntiSpam: ${violationCount} violations de spam`)
          .catch(() => {});
      }

      tracker.set(cacheKey, []);

      // Report to staff log channel
      const logChannelId = getLogChannelId();
      if (!logChannelId) return;
      const logChannel = client.channels.cache.get(logChannelId);
      if (!logChannel) return;

      const embed = new EmbedBuilder()
        .setTitle('⏱️ Spam détecté')
        .setColor(0xFEE75C)
        .addFields(
          { name: '👤 Auteur', value: `${message.author} (${message.author.tag})`, inline: true },
          { name: '📍 Salon', value: `<#${message.channel.id}>`, inline: true },
          { name: '📊 Détection', value: `**${recent.length}** messages en moins de **${windowSeconds}s**`, inline: false },
          { name: '💬 Dernier message', value: message.content.slice(0, 500) || '*[vide]*' },
          { name: '📈 Violations (24h)', value: `${violationCount} / ${threshold}`, inline: true },
          { name: '⚡ Action', value: [config.autoDelete !== false ? '🗑️ Supprimé' : '🚩 Signalé', config.autoTimeout && violationCount >= threshold ? `⏱️ Timeout ${config.timeoutMinutes ?? 5}min` : ''].filter(Boolean).join(' · ') || '⚡ Signalé', inline: true },
        )
        .setThumbnail(message.author.displayAvatarURL())
        .setFooter({ text: `Seuil : ${maxMessages} msg / ${windowSeconds}s • ID : ${message.author.id}` })
        .setTimestamp();

      await logChannel.send({ embeds: [embed] }).catch(() => {});
    } catch (err) {
      console.error('[antispam] Erreur:', err);
    }
  });
}

module.exports = { startAntispam };
