const Tournament = require('../database/models/Tournament');
const Team = require('../database/models/Team');
const Match = require('../database/models/Match');
const { EmbedBuilder } = require('discord.js');
const { staffLog } = require('../utils/staffLog');

const medals = ['🥇', '🥈', '🥉'];

module.exports = (client) => {
  client.on('messageCreate', async message => {
    try {
    if (message.content !== '!finirtournoi') return;
    if (!message.guild) return;

    if (!message.member.permissions.has('Administrator'))
      return message.reply('Staff uniquement');

    const tournament = await Tournament.findOne({ active: true });
    if (!tournament)
      return message.reply('❌ Aucun tournoi en cours. Lance-en un avec `!newtournoi <nom>`.');

    // Use tournament-specific match data to compute standings
    const matches = await Match.find({ tournamentId: tournament._id.toString() });
    const matchCount = matches.length;

    const statsMap = {};
    for (const m of matches) {
      if (!statsMap[m.team]) statsMap[m.team] = { points: 0, kills: 0 };
      statsMap[m.team].points += m.points;
      statsMap[m.team].kills  += m.kills;
    }
    const sorted = Object.entries(statsMap).sort((a, b) => b[1].points - a[1].points);
    const totalKills = sorted.reduce((sum, [, s]) => sum + s.kills, 0);

    const winnerName = sorted.length > 0 ? sorted[0][0] : null;
    const winnerPts  = winnerName ? sorted[0][1].points : 0;
    const duration   = Math.floor((Date.now() - tournament.startedAt) / (1000 * 60 * 60));

    tournament.active       = false;
    tournament.endedBy      = message.author.tag;
    tournament.winner       = winnerName;
    tournament.totalMatches = matchCount;
    tournament.totalKills   = totalKills;
    tournament.endedAt      = new Date();
    await tournament.save();

    const podium = sorted.slice(0, 3).map(([name, s], i) =>
      `${medals[i] || `#${i + 1}`} **${name}** — ${s.points} pts | ${s.kills} kills`
    ).join('\n') || 'Aucune équipe';

    const embed = new EmbedBuilder()
      .setTitle(`🏆 Fin du tournoi — ${tournament.name}`)
      .setColor(0xF1C40F)
      .addFields(
        { name: '🥇 Vainqueur', value: winnerName ? `**${winnerName}** avec ${winnerPts} pts` : 'Aucun', inline: false },
        { name: '🎖️ Podium final', value: podium, inline: false },
        { name: '🎮 Matchs joués', value: `${matchCount}`, inline: true },
        { name: '💀 Kills totaux', value: `${totalKills}`, inline: true },
        { name: '⏱️ Durée', value: `${duration}h`, inline: true }
      )
      .setFooter({ text: `Terminé par ${message.author.tag}` })
      .setTimestamp();

    message.channel.send({ embeds: [embed] });

    await staffLog(client, {
      action: 'resetmatch',
      details: `**Tournoi terminé :** ${tournament.name}\n**Vainqueur :** ${winnerName ?? 'Aucun'}\n**Matchs :** ${matchCount}`,
      author: message.author.tag
    });
    } catch (err) {
      console.error('[endtournoi] Erreur:', err);
      message.reply('❌ Une erreur est survenue. Réessaie dans un instant.').catch(() => {});
    }
  });
};
