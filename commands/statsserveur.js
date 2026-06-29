/**
 * !statsserveur — Statistiques globales du serveur
 */
const { EmbedBuilder } = require('discord.js');
const Match      = require('../database/models/Match');
const Team       = require('../database/models/Team');
const PlayerStat = require('../database/models/PlayerStat');
const Warning    = require('../database/models/Warning');
const Ticket     = require('../database/models/Ticket');
const Tournament = require('../database/models/Tournament');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    try {
      if (!message.guild) return;
      if (message.author.bot) return;
      if (!message.member) return;
      if (!message.content.startsWith('!statsserveur')) return;

      await message.channel.sendTyping();
      const guildId = message.guild.id;

      const [
        totalMatches,
        totalTeams,
        totalPlayers,
        totalTournois,
        totalWarnings,
        allMatches,
      ] = await Promise.all([
        Match.countDocuments({}),
        Team.countDocuments({}),
        PlayerStat.countDocuments({ guildId }),
        Tournament.countDocuments({ guildId }),
        Warning.countDocuments({ guildId }).catch(() => 0),
        Match.find({}).lean(),
      ]);

      const totalKills    = allMatches.reduce((s, m) => s + (m.kills || 0), 0);
      const totalPoints   = allMatches.reduce((s, m) => s + (m.points || 0), 0);
      const avgKills      = totalMatches ? (totalKills / totalMatches).toFixed(1) : '0';
      const avgPoints     = totalMatches ? (totalPoints / totalMatches).toFixed(1) : '0';

      // Record kills en un match
      const recordMatch = allMatches.reduce((best, m) => (!best || m.kills > best.kills) ? m : best, null);

      // Équipe la plus active (plus de matchs)
      const teamMatchCount = {};
      for (const m of allMatches) {
        teamMatchCount[m.team] = (teamMatchCount[m.team] || 0) + 1;
      }
      const mostActiveEntry = Object.entries(teamMatchCount).sort((a, b) => b[1] - a[1])[0];
      const mostActive = mostActiveEntry ? `${mostActiveEntry[0]} (${mostActiveEntry[1]} matchs)` : '—';

      // Équipe avec le plus de kills
      const teamKills = {};
      for (const m of allMatches) {
        teamKills[m.team] = (teamKills[m.team] || 0) + (m.kills || 0);
      }
      const topKillerEntry = Object.entries(teamKills).sort((a, b) => b[1] - a[1])[0];
      const topKiller = topKillerEntry ? `${topKillerEntry[0]} (${topKillerEntry[1]} kills)` : '—';

      // Victoires par équipe
      const wins = allMatches.filter(m => m.placement === 1);
      const winMap = {};
      for (const m of wins) winMap[m.team] = (winMap[m.team] || 0) + 1;
      const topWinner = Object.entries(winMap).sort((a, b) => b[1] - a[1])[0];
      const topWinnerStr = topWinner ? `${topWinner[0]} (${topWinner[1]} victoires)` : '—';

      const embed = new EmbedBuilder()
        .setTitle(`📊 Statistiques globales — ${message.guild.name}`)
        .setColor(0x57F287)
        .addFields(
          { name: '🏟️ Matchs enregistrés',  value: totalMatches.toLocaleString('fr-FR'), inline: true },
          { name: '🎮 Équipes',              value: totalTeams.toString(),                 inline: true },
          { name: '👤 Joueurs',              value: totalPlayers.toLocaleString('fr-FR'), inline: true },
          { name: '💀 Kills totaux',         value: totalKills.toLocaleString('fr-FR'),   inline: true },
          { name: '⭐ Points distribués',    value: totalPoints.toLocaleString('fr-FR'),  inline: true },
          { name: '🏆 Tournois',             value: totalTournois.toString(),              inline: true },
          { name: '📈 Moy. kills/match',     value: avgKills,                             inline: true },
          { name: '📊 Moy. points/match',    value: avgPoints,                            inline: true },
          { name: '⚠️ Avertissements',       value: totalWarnings.toString(),             inline: true },
          { name: '🔥 Record kills (1 match)', value: recordMatch ? `${recordMatch.kills} kills — ${recordMatch.team}` : '—', inline: false },
          { name: '🏃 Équipe la plus active', value: mostActive,  inline: true },
          { name: '💀 Équipe top kills',     value: topKiller,    inline: true },
          { name: '🥇 Équipe la + victorieuse', value: topWinnerStr, inline: true },
        )
        .setFooter({ text: `${message.guild.name} · Données en temps réel` })
        .setTimestamp();

      message.channel.send({ embeds: [embed] });
    } catch (err) {
      console.error('[statsserveur] Erreur:', err);
      message.reply('❌ Une erreur est survenue.').catch(() => {});
    }
  });
};
