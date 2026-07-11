const BadWord         = require('../database/models/BadWord');
const AutomodConfig   = require('../database/models/AutomodConfig');
const ViolationTracker= require('../database/models/ViolationTracker');
const { EmbedBuilder } = require('discord.js');
const { getLogChannelId } = require('./channelConfig');

// Per-guild word cache: guildId → { words: string[], time: number }
const wordCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 min

async function getWords(guildId) {
  const cached = wordCache.get(guildId);
  if (cached && Date.now() - cached.time < CACHE_TTL) return cached.words;
  const entries = await BadWord.find({ guildId });
  const words = entries.map(e => e.word.toLowerCase());
  wordCache.set(guildId, { words, time: Date.now() });
  return words;
}

function invalidateCache(guildId) {
  if (guildId) wordCache.delete(guildId);
  else wordCache.clear();
}

function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findMatches(text, words) {
  const normalized = normalize(text);
  return words.filter(w => {
    const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    return regex.test(normalized);
  });
}

async function trackViolation(guildId, userId, threshold) {
  const resetAt = new Date(Date.now() + 24 * 3600 * 1000);
  const doc = await ViolationTracker.findOneAndUpdate(
    { guildId, userId, type: 'badword' },
    { $inc: { count: 1 }, $set: { lastAt: new Date(), resetAt } },
    { upsert: true, new: true }
  );
  return doc.count;
}

async function startAutomod(client) {
  client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (message.author.id === client.user?.id) return;
    if (!message.guild) return;

    try {
      const guildId = message.guild.id;
      const config = await AutomodConfig.findOne({ guildId }) || await AutomodConfig.findOne({});
      if (config && !config.enabled) return;

      // Exempt channels
      if (config?.exemptChannels?.includes(message.channel.id)) return;

      // Exempt roles
      if (config?.exemptRoles?.length && message.member) {
        const hasExempt = message.member.roles.cache.some(r => config.exemptRoles.includes(r.id));
        if (hasExempt) return;
      }

      const words = await getWords(guildId);
      if (!words.length) return;

      const matches = findMatches(message.content, words);
      if (!matches.length) return;

      // Auto-delete the message
      const shouldDelete = config?.autoDelete !== false;
      if (shouldDelete) {
        await message.delete().catch(() => {});
      } else {
        await message.react('🚨').catch(() => {});
      }

      // Track violations and maybe timeout
      const threshold = config?.violationThreshold ?? 3;
      const violationCount = await trackViolation(guildId, message.author.id, threshold);

      if (config?.autoTimeout && violationCount >= threshold && message.member) {
        const minutes = config?.timeoutMinutes ?? 10;
        await message.member.timeout(minutes * 60 * 1000, `AutoMod: ${violationCount} violations (mots interdits)`)
          .catch(() => {});
      }

      // Report to log channel
      const logChannelId = getLogChannelId();
      if (!logChannelId) return;
      const logChannel = client.channels.cache.get(logChannelId);
      if (!logChannel) return;

      const maskedContent = message.content.replace(
        new RegExp(`(${matches.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi'),
        m => `**[${m}]**`
      );

      const embed = new EmbedBuilder()
        .setTitle('🚨 Mot interdit détecté')
        .setColor(0xED4245)
        .addFields(
          { name: '👤 Auteur', value: `${message.author} (${message.author.tag})`, inline: true },
          { name: '📍 Salon', value: `<#${message.channel.id}>`, inline: true },
          { name: '🔴 Mot(s) détecté(s)', value: matches.map(w => `\`${w}\``).join(', '), inline: false },
          { name: '💬 Message', value: maskedContent.slice(0, 1000) },
          { name: '📊 Violations (24h)', value: `${violationCount} / ${threshold}`, inline: true },
          { name: '⚡ Action', value: [shouldDelete ? '🗑️ Supprimé' : '🚩 Signalé', config?.autoTimeout && violationCount >= threshold ? `⏱️ Timeout ${config?.timeoutMinutes ?? 10}min` : ''].filter(Boolean).join(' · ') || '⚡ Signalé', inline: true },
        )
        .setThumbnail(message.author.displayAvatarURL())
        .setFooter({ text: `ID message : ${message.id}` })
        .setTimestamp();

      await logChannel.send({ embeds: [embed] }).catch(() => {});
    } catch (err) {
      console.error('[automod] Erreur non gérée:', err.message);
    }
  });
}

module.exports = { startAutomod, invalidateCache };
