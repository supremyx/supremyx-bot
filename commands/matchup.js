const { EmbedBuilder } = require('discord.js');
const Match = require('../database/models/Match');
const Team = require('../database/models/Team');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (!message.guild) return;
    const content = message.content.trim();
    if (!content.toLowerCase().startsWith('!matchup')) return;

    const raw = content.slice('!matchup'.length).trim();
    const sep = raw.toLowerCase().indexOf(' vs ');
    if (sep === -1) return message.reply('Usage : `!matchup <équipe1> vs <équipe2>`');

    const nameA = raw.slice(0, sep).trim();
    const nameB = raw.slice(sep + 4).trim();

    const [teamA, teamB] = await Promise.all([
      Team.findOne({ name: { $regex: new RegExp(`^${nameA}$`, 'i') } }),
      Team.findOne({ name: { $regex: new RegExp(`^${nameB}$`, 'i') } }),
    ]);

    if (!teamA) return message.reply(`❌ Équipe **${nameA}** introuvable.`);
    if (!teamB) return message.reply(`❌ Équipe **${nameB}** introuvable.`);

    const [matchesA, matchesB] = await Promise.all([
      Match.find({ team: teamA.name }).sort({ createdAt: -1 }).lean(),
      Match.find({ team: teamB.name }).sort({ createdAt: -1 }).lean(),
    ]);

    function teamStats(matches) {
      if (!matches.length) return null;
      const wins = matches.filter(m => m.placement === 1).length;
      const top3 = matches.filter(m => m.placement <= 3).length;
      const avgKills = matches.reduce((s, m) => s + m.kills, 0) / matches.length;
      const avgPts = matches.reduce((s, m) => s + m.points, 0) / matches.length;
      const avgPlacement = matches.filter(m => m.placement > 0).reduce((s, m) => s + m.placement, 0) / (matches.filter(m => m.placement > 0).length || 1);
      const best = matches.reduce((b, m) => m.points > b.points ? m : b, matches[0]);
      const last5 = matches.slice(0, 5).map(m => m.placement === 1 ? '🥇' : m.placement <= 3 ? '🟢' : m.placement <= 5 ? '🟡' : '🔴').join('');
      return { wins, top3, avgKills: avgKills.toFixed(1), avgPts: avgPts.toFixed(1), avgPlacement: avgPlacement.toFixed(1), total: matches.length, best, last5 };
    }

    const sA = teamStats(matchesA);
    const sB = teamStats(matchesB);

    if (!sA) return message.reply(`❌ Aucun match enregistré pour **${teamA.name}**.`);
    if (!sB) return message.reply(`❌ Aucun match enregistré pour **${teamB.name}**.`);

    // Find shared tournament games
    const tournIdsA = new Set(matchesA.filter(m => m.tournamentId).map(m => m.tournamentId));
    const sharedTournaments = matchesB.filter(m => m.tournamentId && tournIdsA.has(m.tournamentId));
    const h2hTournaments = [...new Set(sharedTournaments.map(m => m.tournamentName).filter(Boolean))];

    function winnerStat(valA, valB, higherIsBetter = true) {
      const a = parseFloat(valA), b = parseFloat(valB);
      if (a === b) return '⚖️';
      return (higherIsBetter ? a > b : a < b) ? '🟢' : '🔴';
    }

    const embed = new EmbedBuilder()
      .setTitle(`⚔️ Matchup — ${teamA.name} vs ${teamB.name}`)
      .setColor(0x5865F2)
      .setDescription(h2hTournaments.length
        ? `Tournois communs : **${h2hTournaments.join(', ')}**`
        : '*Aucun tournoi commun trouvé*')
      .addFields(
        {
          name: `📊 ${teamA.name}`,
          value: [
            `Matchs joués : **${sA.total}**`,
            `Victoires : **${sA.wins}** (${((sA.wins / sA.total) * 100).toFixed(0)}%)`,
            `Top 3 : **${sA.top3}**`,
            `Kills/match : **${sA.avgKills}**`,
            `Pts/match : **${sA.avgPts}**`,
            `Placement moyen : **${sA.avgPlacement}**`,
            `Forme : ${sA.last5}`,
            `Total : **${teamA.points} pts** · **${teamA.kills} kills**`,
          ].join('\n'),
          inline: true
        },
        {
          name: `📊 ${teamB.name}`,
          value: [
            `Matchs joués : **${sB.total}**`,
            `Victoires : **${sB.wins}** (${((sB.wins / sB.total) * 100).toFixed(0)}%)`,
            `Top 3 : **${sB.top3}**`,
            `Kills/match : **${sB.avgKills}**`,
            `Pts/match : **${sB.avgPts}**`,
            `Placement moyen : **${sB.avgPlacement}**`,
            `Forme : ${sB.last5}`,
            `Total : **${teamB.points} pts** · **${teamB.kills} kills**`,
          ].join('\n'),
          inline: true
        },
        {
          name: '⚖️ Comparaison rapide',
          value: [
            `Victoires : ${winnerStat(sA.wins, sB.wins)} ${teamA.name} vs ${teamB.name} ${winnerStat(sB.wins, sA.wins)}`,
            `Kills/m : ${winnerStat(sA.avgKills, sB.avgKills)} vs ${winnerStat(sB.avgKills, sA.avgKills)}`,
            `Pts/m : ${winnerStat(sA.avgPts, sB.avgPts)} vs ${winnerStat(sB.avgPts, sA.avgPts)}`,
            `Placement moy. : ${winnerStat(sA.avgPlacement, sB.avgPlacement, false)} vs ${winnerStat(sB.avgPlacement, sA.avgPlacement, false)}`,
            `Points totaux : ${winnerStat(teamA.points, teamB.points)} vs ${winnerStat(teamB.points, teamA.points)}`,
          ].join('\n'),
          inline: false
        }
      )
      .setFooter({ text: '🟢 Avantage  🔴 Désavantage  ⚖️ Égalité' })
      .setTimestamp();

    return message.channel.send({ embeds: [embed] });
  });
};
