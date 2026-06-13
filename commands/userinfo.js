const Warning = require('../database/models/Warning');
const XpEntry = require('../database/models/XpEntry');
const { EmbedBuilder } = require('discord.js');

function xpToLevel(xp) {
  return Math.floor(Math.sqrt(xp / 50));
}

module.exports = (client) => {
  client.on('messageCreate', async message => {
    const content = message.content.trim();
    if (!content.startsWith('!infouser')) return;
    if (!message.guild) return;
    if (message.author.bot) return;
    if (!message.member) return;

    const target = message.mentions.members.first() || message.member;
    const user = target.user;

    const joinedAt = target.joinedAt ? `<t:${Math.floor(target.joinedAt.getTime() / 1000)}:R>` : 'Inconnu';
    const createdAt = `<t:${Math.floor(user.createdAt.getTime() / 1000)}:R>`;

    // Roles (excluding @everyone)
    const roles = target.roles.cache
      .filter(r => r.id !== message.guild.id)
      .sort((a, b) => b.position - a.position)
      .map(r => `<@&${r.id}>`);
    const rolesDisplay = roles.length ? roles.slice(0, 10).join(' ') + (roles.length > 10 ? ` +${roles.length - 10}` : '') : '*Aucun*';

    // Warnings
    let warnCount = 0;
    try {
      warnCount = await Warning.countDocuments({ guildId: message.guild.id, userId: user.id });
    } catch {}

    // XP/Level
    let xp = 0, level = 0;
    try {
      const xpEntry = await XpEntry.findOne({ guildId: message.guild.id, userId: user.id });
      if (xpEntry) { xp = xpEntry.xp; level = xpEntry.level; }
    } catch {}

    const embed = new EmbedBuilder()
      .setTitle(`👤 ${user.username}`)
      .setColor(target.displayHexColor || '#5865F2')
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: '🆔 ID', value: user.id, inline: true },
        { name: '🤖 Bot', value: user.bot ? 'Oui' : 'Non', inline: true },
        { name: '📅 Compte créé', value: createdAt, inline: true },
        { name: '📥 A rejoint', value: joinedAt, inline: true },
        { name: '⚠️ Avertissements', value: `${warnCount}`, inline: true },
        { name: '📈 Niveau / XP', value: `Niv. **${level}** — **${xp}** XP`, inline: true },
        { name: `🏷️ Rôles (${roles.length})`, value: rolesDisplay }
      )
      .setFooter({ text: `Pseudo serveur : ${target.displayName}` })
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
  });
};
