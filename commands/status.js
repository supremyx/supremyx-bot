const Team = require('../database/models/Team');
const Match = require('../database/models/Match');
const Tournament = require('../database/models/Tournament');
const Warning = require('../database/models/Warning');
const Schedule = require('../database/models/Schedule');
const { EmbedBuilder } = require('discord.js');
const { getFormatted } = require('../utils/botMonitor');
const { getAntiCrashMetrics } = require('../utils/antiCrash');
const { isEnabled: backupEnabled, getIntervalHrs } = require('../utils/autoBackup');

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
    const content = message.content.trim();
    if (content !== '!statut' && content !== '!status') return;

    const [teams, matches, tournaments, activeTournoi, warns, upcomingMatches] = await Promise.all([
      Team.countDocuments(),
      Match.countDocuments(),
      Tournament.countDocuments(),
      Tournament.findOne({ active: true }),
      Warning.countDocuments(),
      Schedule.countDocuments({ date: { $gte: new Date() } }),
    ]);

    const totalKills = await Match.aggregate([{ $group: { _id: null, total: { $sum: '$kills' } } }]);
    const kills      = totalKills[0]?.total ?? 0;

    const mon   = getFormatted();
    const crash = getAntiCrashMetrics();

    const statusIcon = mon.status === 'ok' ? '🟢' : '🟡';
    const pingColor  = mon.ping > 1000 ? '🔴' : mon.ping > 400 ? '🟡' : '🟢';
    const memColor   = mon.memoryMB > 400 ? '🔴' : mon.memoryMB > 250 ? '🟡' : '🟢';
    const crashLine  = crash.crashCount === 0
      ? '✅ Aucun crash'
      : `⚠️ ${crash.crashCount} crash(s) · dernier : ${crash.lastCrashAt ? new Date(crash.lastCrashAt).toLocaleTimeString('fr-FR') : '—'}`;
    const alertsLine = mon.alerts.length > 0 ? mon.alerts.join('\n') : '✅ Aucune alerte active';
    const guildCount  = client.guilds.cache.size;
    const memberCount = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);

    const embed = new EmbedBuilder()
      .setTitle(`${statusIcon} Tableau de bord — SUPREMYX`)
      .setColor(mon.status === 'ok' ? 0x57F287 : 0xFEE75C)
      .setThumbnail(client.user.displayAvatarURL())
      .addFields(
        { name: '🏆 Tournoi actif',    value: activeTournoi ? `**${activeTournoi.name}**` : '*Aucun en cours*', inline: false },
        { name: '👥 Équipes',          value: `${teams}`,           inline: true },
        { name: '🎮 Matchs joués',     value: `${matches}`,         inline: true },
        { name: '💀 Kills totaux',     value: `${kills}`,           inline: true },
        { name: '🏁 Tournois',         value: `${tournaments}`,     inline: true },
        { name: '⚠️ Avertissements',   value: `${warns}`,           inline: true },
        { name: '📅 Matchs planifiés', value: `${upcomingMatches}`, inline: true },
        { name: '🌐 Serveurs',         value: `${guildCount} (${memberCount} membres)`, inline: false },
        { name: '── Santé du bot ──',  value: '\u200B',             inline: false },
        { name: '⏱️ Uptime',           value: mon.uptime,           inline: true },
        { name: `${pingColor} Ping`,   value: `${mon.ping} ms`,     inline: true },
        { name: `${memColor} Mémoire`, value: `${mon.memoryMB} MB`, inline: true },
        { name: '🛡️ Anti-crash',       value: crashLine,            inline: false },
        { name: '💾 Sauvegarde auto',  value: backupEnabled() ? `✅ Activée (${getIntervalHrs()}h)` : '🔴 Désactivée', inline: true },
        { name: '🔄 Reconnexions',     value: `${crash.reconnectCount}`, inline: true },
        { name: '🚨 Alertes actives',  value: alertsLine,           inline: false },
      )
      .setFooter({ text: `SUPREMYX • ${client.user.tag}` })
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
  });
};
