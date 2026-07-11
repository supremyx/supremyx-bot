const AntiLinkConfig   = require('../database/models/AntiLinkConfig');
const ViolationTracker = require('../database/models/ViolationTracker');
const { EmbedBuilder } = require('discord.js');
const { getLogChannelId } = require('./channelConfig');

const DISCORD_INVITE_RE = /discord\.(gg|com\/invite)\/[a-zA-Z0-9-]+/i;
const URL_RE = /https?:\/\/[^\s]+/gi;

// Per-guild config cache
const configCache = new Map();
const CONFIG_TTL  = 60 * 1000;

async function getConfig(guildId) {
  const cached = configCache.get(guildId);
  if (cached && Date.now() - cached.time < CONFIG_TTL) return cached.cfg;
  const cfg = await AntiLinkConfig.findOne({ guildId });
  configCache.set(guildId, { cfg, time: Date.now() });
  return cfg;
}

function invalidateConfigCache(guildId) {
  if (guildId) configCache.delete(guildId);
  else configCache.clear();
}

function extractUrls(content) {
  return content.match(URL_RE) || [];
}

function isAllowed(url, allowedDomains) {
  if (!allowedDomains.length) return false;
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    return allowedDomains.some(d => hostname === d || hostname.endsWith('.' + d));
  } catch { return false; }
}

async function trackViolation(guildId, userId, threshold) {
  const resetAt = new Date(Date.now() + 24 * 3600 * 1000);
  const doc = await ViolationTracker.findOneAndUpdate(
    { guildId, userId, type: 'link' },
    { $inc: { count: 1 }, $set: { lastAt: new Date(), resetAt } },
    { upsert: true, new: true }
  );
  return doc.count;
}

async function startAntiLink(client) {
  client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (message.author.id === client.user?.id) return;
    if (!message.guild) return;

    try {
      const guildId = message.guild.id;
      const config  = await getConfig(guildId);
      if (!config || !config.enabled) return;

      // Exempt channels
      if (config.exemptChannels.includes(message.channel.id)) return;

      // Exempt roles
      if (config.exemptRoles.length && message.member) {
        const hasExempt = message.member.roles.cache.some(r => config.exemptRoles.includes(r.id));
        if (hasExempt) return;
      }

      const content = message.content;
      let detected = false;
      let detectionType = '';

      // Check Discord invites
      if (config.blockDiscordInvites && DISCORD_INVITE_RE.test(content)) {
        detected    = true;
        detectionType = 'Lien d\'invitation Discord';
      }

      // Check external links
      if (!detected && config.blockExternalLinks) {
        const urls = extractUrls(content);
        const blocked = urls.filter(u => !DISCORD_INVITE_RE.test(u) && !isAllowed(u, config.allowedDomains));
        if (blocked.length) {
          detected      = true;
          detectionType = 'Lien externe';
        }
      }

      if (!detected) return;

      // Delete message
      await message.delete().catch(() => {});

      // Track violations
      const threshold      = config.violationThreshold ?? 3;
      const violationCount = await trackViolation(guildId, message.author.id, threshold);

      // Warn via temp DM or temp channel message
      if (config.action === 'delete_warn' || config.action === 'delete_timeout') {
        const warn = await message.channel.send(
          `⚠️ ${message.author} — Les liens ne sont pas autorisés ici. (violation ${violationCount}/${threshold})`
        ).catch(() => null);
        if (warn) setTimeout(() => warn.delete().catch(() => {}), 6000);
      }

      // Timeout if action is delete_timeout AND threshold reached
      if (config.action === 'delete_timeout' && violationCount >= threshold && message.member) {
        await message.member.timeout(
          config.timeoutSeconds * 1000,
          `AntiLink: ${violationCount} violations de liens`
        ).catch(() => {});
      }

      // Log to staff channel
      const logChannelId = getLogChannelId();
      if (!logChannelId) return;
      const logChannel = client.channels.cache.get(logChannelId);
      if (!logChannel) return;

      const embed = new EmbedBuilder()
        .setTitle('🔗 Lien bloqué')
        .setColor(0xF97316)
        .addFields(
          { name: '👤 Auteur',    value: `${message.author} (${message.author.tag})`, inline: true },
          { name: '📍 Salon',     value: `<#${message.channel.id}>`, inline: true },
          { name: '🔍 Type',      value: detectionType, inline: true },
          { name: '💬 Contenu',   value: content.slice(0, 500) || '*[vide]*' },
          { name: '📊 Violations', value: `${violationCount} / ${threshold}`, inline: true },
          { name: '⚡ Action',    value: config.action === 'delete_timeout' && violationCount >= threshold ? `🗑️ Supprimé + ⏱️ Timeout ${config.timeoutSeconds}s` : config.action === 'delete_warn' ? '🗑️ Supprimé + ⚠️ Averti' : '🗑️ Supprimé', inline: true },
        )
        .setThumbnail(message.author.displayAvatarURL())
        .setTimestamp();

      await logChannel.send({ embeds: [embed] }).catch(() => {});
    } catch (err) {
      console.error('[antilink] Erreur:', err.message);
    }
  });
}

module.exports = { startAntiLink, invalidateConfigCache };
