const BadWord = require('../database/models/BadWord');
const AutomodConfig = require('../database/models/AutomodConfig');
const { EmbedBuilder } = require('discord.js');

// Cache words in memory, refreshed every 5 min
let cachedWords = null;
let cacheTime = 0;

async function getWords() {
  if (cachedWords && Date.now() - cacheTime < 5 * 60 * 1000) return cachedWords;
  const entries = await BadWord.find();
  cachedWords = entries.map(e => e.word.toLowerCase());
  cacheTime = Date.now();
  return cachedWords;
}

function invalidateCache() {
  cachedWords = null;
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

    try {
      const config = await AutomodConfig.findOne();
      if (config && !config.enabled) return;

      const words = await getWords();
      if (!words.length) return;

      const matches = findMatches(message.content, words);
      if (!matches.length) return;

      // React to flag the message
      await message.react('🚨').catch(() => {});

      // Report to log channel
      const logChannelId = process.env.LOG_CHANNEL_ID;
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

      logChannel.send({ embeds: [embed] });
    } catch {
      // Silent fail
    }
  });
}

module.exports = { startAutomod, invalidateCache };
