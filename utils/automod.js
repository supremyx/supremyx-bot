const BadWord = require('../database/models/BadWord');
const AutomodConfig = require('../database/models/AutomodConfig');
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
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9\s]/g, ' ')                    // remove special chars
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

async function startAutomod(client) {
  client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (message.author.id === client.user?.id) return;
    if (!message.guild) return;

    try {
      const guildId = message.guild.id;
      const config = await AutomodConfig.findOne({ guildId });
      if (config && !config.enabled) return;

      const words = await getWords(guildId);
      if (!words.length) return;

      const matches = findMatches(message.content, words);
      if (!matches.length) return;

      // React to flag the message
      await message.react('🚨').catch(() => {});

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
          { name: '💬 Message', value: maskedContent.slice(0, 1000) }
        )
        .setThumbnail(message.author.displayAvatarURL())
        .setFooter({ text: `ID message : ${message.id}` })
        .setTimestamp();

      await logChannel.send({ embeds: [embed] }).catch(() => {});
    } catch {
      // Silent fail
    }
  });
}

module.exports = { startAutomod, invalidateCache };
