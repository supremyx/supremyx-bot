const AntiRaidConfig = require('../database/models/AntiRaidConfig');
const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const { getLogChannelId } = require('./channelConfig');

// Per-guild join timestamps: guildId → [timestamp, ...]
const joinTracker = new Map();
// Auto-unlock timers: guildId → timeoutId
const unlockTimers = new Map();

async function lockdownGuild(guild, config, client) {
  const everyoneRole = guild.roles.everyone;
  const locked = [];

  for (const [, channel] of guild.channels.cache) {
    if (!channel.isTextBased()) continue;
    try {
      const current = channel.permissionOverwrites.cache.get(everyoneRole.id);
      const wasDenied = current?.deny?.has(PermissionsBitField.Flags.SendMessages);
      if (!wasDenied) {
        await channel.permissionOverwrites.edit(everyoneRole, { SendMessages: false });
        locked.push(channel.id);
      }
    } catch { /* may not have permission */ }
  }

  await AntiRaidConfig.findOneAndUpdate(
    { guildId: guild.id },
    { lockdownActive: true, lockdownAt: new Date() }
  );

  // Schedule auto-unlock
  const minutes = config.autoUnlockMinutes ?? 30;
  const existing = unlockTimers.get(guild.id);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => unlockGuild(guild, client), minutes * 60 * 1000);
  unlockTimers.set(guild.id, timer);

  return locked.length;
}

async function unlockGuild(guild, client) {
  const everyoneRole = guild.roles.everyone;

  for (const [, channel] of guild.channels.cache) {
    if (!channel.isTextBased()) continue;
    try {
      await channel.permissionOverwrites.edit(everyoneRole, { SendMessages: null });
    } catch { /* ignore */ }
  }

  await AntiRaidConfig.findOneAndUpdate(
    { guildId: guild.id },
    { lockdownActive: false }
  );

  unlockTimers.delete(guild.id);

  // Notify log channel
  const logChannelId = getLogChannelId();
  if (logChannelId) {
    const logChannel = client?.channels.cache.get(logChannelId);
    if (logChannel) {
      const embed = new EmbedBuilder()
        .setTitle('🔓 Serveur déverrouillé')
        .setColor(0x34D399)
        .setDescription('Le serveur est à nouveau ouvert après le lockdown anti-raid.')
        .setTimestamp();
      await logChannel.send({ embeds: [embed] }).catch(() => {});
    }
  }
}

async function startAntiRaid(client) {
  // On startup: check if a lockdown is active and restore unlock timer
  client.once('clientReady', async () => {
    try {
      const activeRaids = await AntiRaidConfig.find({ lockdownActive: true });
      for (const cfg of activeRaids) {
        const guild = client.guilds.cache.get(cfg.guildId);
        if (!guild) continue;
        const elapsed = Date.now() - (cfg.lockdownAt?.getTime() || 0);
        const remaining = (cfg.autoUnlockMinutes * 60 * 1000) - elapsed;
        if (remaining <= 0) {
          await unlockGuild(guild, client);
        } else {
          const timer = setTimeout(() => unlockGuild(guild, client), remaining);
          unlockTimers.set(cfg.guildId, timer);
        }
      }
    } catch (err) {
      console.error('[antiraid] Erreur restauration lockdown:', err.message);
    }
  });

  client.on('guildMemberAdd', async member => {
    const guild   = member.guild;
    const guildId = guild.id;

    try {
      const config = await AntiRaidConfig.findOne({ guildId });
      if (!config || !config.enabled) return;

      // Check account age
      const accountAgeDays = (Date.now() - member.user.createdTimestamp) / 86400000;
      if (accountAgeDays < config.minAccountAgeDays) {
        await member.kick(`AntiRaid: compte trop récent (${Math.floor(accountAgeDays)}j < ${config.minAccountAgeDays}j requis)`).catch(() => {});
        const logChannelId = getLogChannelId();
        if (logChannelId) {
          const logChannel = client.channels.cache.get(logChannelId);
          if (logChannel) {
            const embed = new EmbedBuilder()
              .setTitle('🚫 Compte trop récent — expulsé')
              .setColor(0xF97316)
              .addFields(
                { name: '👤 Utilisateur', value: `${member.user.tag} (${member.user.id})`, inline: true },
                { name: '📅 Âge du compte', value: `${Math.floor(accountAgeDays)} jour(s)`, inline: true },
                { name: '📏 Minimum requis', value: `${config.minAccountAgeDays} jour(s)`, inline: true },
              )
              .setTimestamp();
            await logChannel.send({ embeds: [embed] }).catch(() => {});
          }
        }
        return;
      }

      // Track joins
      const now = Date.now();
      if (!joinTracker.has(guildId)) joinTracker.set(guildId, []);
      const timestamps = joinTracker.get(guildId);
      timestamps.push({ userId: member.id, ts: now });

      const windowMs = config.joinWindowSeconds * 1000;
      const recent   = timestamps.filter(e => now - e.ts < windowMs);
      joinTracker.set(guildId, recent);

      if (recent.length < config.joinThreshold) return;

      // RAID DETECTED
      await AntiRaidConfig.findOneAndUpdate({ guildId }, { lastRaidAt: new Date() });
      joinTracker.set(guildId, []); // reset to avoid repeated triggers

      const logChannelId = getLogChannelId();
      const logChannel   = logChannelId ? client.channels.cache.get(logChannelId) : null;

      const raidEmbed = new EmbedBuilder()
        .setTitle('🚨 RAID DÉTECTÉ')
        .setColor(0xED4245)
        .addFields(
          { name: '📊 Déclencheur', value: `**${recent.length}** arrivées en **${config.joinWindowSeconds}s**`, inline: true },
          { name: '⚡ Action', value: config.action.toUpperCase(), inline: true },
          { name: '👥 Nouveaux membres', value: recent.map(e => `<@${e.userId}>`).slice(0, 10).join(', ') + (recent.length > 10 ? ` +${recent.length - 10}` : '') },
        )
        .setTimestamp();

      if (logChannel) await logChannel.send({ embeds: [raidEmbed] }).catch(() => {});

      // Execute action
      if (config.action === 'kick' || config.action === 'ban') {
        for (const entry of recent) {
          const raidMember = guild.members.cache.get(entry.userId);
          if (!raidMember) continue;
          if (config.action === 'kick') {
            await raidMember.kick('AntiRaid: raid détecté').catch(() => {});
          } else {
            await guild.bans.create(entry.userId, { reason: 'AntiRaid: raid détecté' }).catch(() => {});
          }
        }
      } else if (config.action === 'lockdown') {
        const lockedCount = await lockdownGuild(guild, config, client);
        if (logChannel) {
          const lockEmbed = new EmbedBuilder()
            .setTitle('🔒 Serveur verrouillé (Anti-Raid)')
            .setColor(0xED4245)
            .setDescription(`**${lockedCount}** salons verrouillés. Déverrouillage automatique dans **${config.autoUnlockMinutes} min**.`)
            .setTimestamp();
          await logChannel.send({ embeds: [lockEmbed] }).catch(() => {});
        }
      }
    } catch (err) {
      console.error('[antiraid] Erreur:', err.message);
    }
  });
}

module.exports = { startAntiRaid, unlockGuild };
