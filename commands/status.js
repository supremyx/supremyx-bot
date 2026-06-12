const Team = require('../database/models/Team');
const Match = require('../database/models/Match');
const Tournament = require('../database/models/Tournament');
const Warning = require('../database/models/Warning');
const Schedule = require('../database/models/Schedule');
const { EmbedBuilder } = require('discord.js');

function formatUptime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [];
  if (days) parts.push(`${days}j`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(' ');
}

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (message.content.trim() !== '!statut') return;

    const [teams, matches, tournaments, activeTournoi, warns, upcomingMatches] = await Promise.all([
      Team.countDocuments(),
      Match.countDocuments(),
      Tournament.countDocuments(),
      Tournament.findOne({ active: true }),
      Warning.countDocuments(),
      Schedule.countDocuments({ date: { $gte: new Date() } })
    ]);

    const totalKills = await Match.aggregate([{ $group: { _id: null, total: { $sum: '$kills' } } }]);
    const kills = totalKills[0]?.total ?? 0;

    const uptime = formatUptime(client.uptime);
    const ping = client.ws.ping;
    const guildCount = client.guilds.cache.size;
    const memberCount = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);

    const embed = new EmbedBuilder()
      .setTitle('📊 Tableau de bord — SUPREMYX')
      .setColor(0x5865F2)
      .setThumbnail(client.user.displayAvatarURL())
      .addFields(
        {
          name: '🏆 Tournoi actif',
          value: activeTournoi ? `**${activeTournoi.name}**` : '*Aucun en cours*',
          inline: false
        },
        { name: '👥 Équipes', value: `${teams}`, inline: true },
        { name: '🎮 Matchs joués', value: `${matches}`, inline: true },
        { name: '💀 Kills totaux', value: `${kills}`, inline: true },
        { name: '🏁 Tournois', value: `${tournaments}`, inline: true },
        { name: '⚠️ Avertissements', value: `${warns}`, inline: true },
        { name: '📅 Matchs planifiés', value: `${upcomingMatches}`, inline: true },
        { name: '⏱️ Uptime', value: uptime, inline: true },
        { name: '📡 Ping', value: `${ping} ms`, inline: true },
        { name: '🌐 Serveurs', value: `${guildCount} (${memberCount} membres)`, inline: true }
      )
      .setFooter({ text: `SUPREMYX • ${client.user.tag}` })
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
  });
};
