const XpEntry = require('../database/models/XpEntry');
const LevelConfig = require('../database/models/LevelConfig');
const { EmbedBuilder } = require('discord.js');
const { logStaffAction } = require('../utils/staffLog');
const { checkCooldown } = require('../utils/cooldown');

function xpToLevel(xp) {
  return Math.floor(Math.sqrt(xp / 50));
}

function xpForNextLevel(level) {
  return Math.pow(level + 1, 2) * 50;
}

module.exports = (client) => {
  client.on('messageCreate', async message => {
    try {
    const content = message.content.trim();
    if (!message.guild) return;
    if (message.author.bot) return;
    const isStaff = message.member?.permissions.has('Administrator');

    // --- !setlevelchannel #channel ---
    if (content.startsWith('!salonniveaux')) {
      if (!isStaff) return message.reply('Staff uniquement');
      const channel = message.mentions.channels.first();
      if (!channel) return message.reply('Usage : `!salonniveaux #salon`');
      await LevelConfig.findOneAndUpdate(
        { guildId: message.guild.id },
        { channelId: channel.id, enabled: true },
        { upsert: true, new: true }
      );
      logStaffAction(client, `📈 **Salon niveaux** → <#${channel.id}> | Par : ${message.author.tag}`);
      return message.reply(`✅ Annonces de niveau dans <#${channel.id}>.`);
    }

    // --- !levelboard / !xpleaderboard ---
    if (content === '!classniveau' || content === '!classxp') {
      const cd = checkCooldown(message.author.id, 'classniveau', 15, message.guild?.id);
      if (cd) return message.reply(`⏳ Attends encore **${cd}s**.`);

      const top = await XpEntry.find({ guildId: message.guild.id }).sort({ xp: -1 }).limit(10);
      if (!top.length) return message.reply('Aucune donnée XP encore. Écris des messages pour gagner de l\'XP !');

      const embed = new EmbedBuilder()
        .setTitle('📈 Classement XP — Top 10')
        .setColor(0x5865F2)
        .setTimestamp();

      const medals = ['🥇', '🥈', '🥉'];
      const rows = top.map((e, i) => {
        const prefix = medals[i] || `**${i + 1}.**`;
        return `${prefix} <@${e.userId}> — Niv. **${e.level}** | **${e.xp}** XP`;
      });
      embed.setDescription(rows.join('\n'));
      return message.channel.send({ embeds: [embed] });
    }

    // --- !niveau reinitialiser @membre (staff) ---
    if (content.startsWith('!niveau reinitialiser') || content.startsWith('!niveau réinitialiser')) {
      if (!isStaff) return message.reply('⛔ Staff uniquement.');
      const target = message.mentions.members.first();
      if (!target) return message.reply('Usage : `!niveau reinitialiser @membre`');

      await XpEntry.findOneAndUpdate(
        { guildId: message.guild.id, userId: target.user.id },
        { xp: 0, level: 0 },
        { upsert: true }
      );
      logStaffAction(client, `📈 **XP réinitialisé** — \`${target.user.tag}\` | Par : ${message.author.tag}`);
      return message.reply(`✅ XP et niveau de <@${target.id}> remis à zéro.`);
    }

    // --- !level [@user] ---
    if (content.startsWith('!niveau')) {
      const cd = checkCooldown(message.author.id, 'level', 5, message.guild?.id);
      if (cd) return message.reply(`⏳ Attends encore **${cd}s**.`);

      const target = message.mentions.members.first() || message.member;
      const entry = await XpEntry.findOne({ guildId: message.guild.id, userId: target.user.id });
      const xp = entry?.xp || 0;
      const level = entry?.level || 0;
      const nextLevelXp = xpForNextLevel(level);
      const progress = Math.min(Math.round((xp / nextLevelXp) * 10), 10);
      const bar = '█'.repeat(progress) + '░'.repeat(10 - progress);

      const embed = new EmbedBuilder()
        .setTitle(`📈 ${target.displayName}`)
        .setColor(target.displayHexColor || '#5865F2')
        .setThumbnail(target.user.displayAvatarURL())
        .addFields(
          { name: '🏆 Niveau', value: `**${level}**`, inline: true },
          { name: '⭐ XP total', value: `**${xp}**`, inline: true },
          { name: '🎯 Prochain niveau', value: `**${nextLevelXp}** XP`, inline: true },
          { name: '📊 Progression', value: `\`${bar}\` ${xp}/${nextLevelXp}` }
        )
        .setTimestamp();
      return message.channel.send({ embeds: [embed] });
    }
    } catch (err) {
      console.error('[level] Erreur:', err);
      message.reply('❌ Une erreur est survenue. Réessaie dans un instant.').catch(() => {});
    }
  });
};
