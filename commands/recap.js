const { EmbedBuilder } = require('discord.js');
const Tournament = require('../database/models/Tournament');
const Team       = require('../database/models/Team');
const Match      = require('../database/models/Match');
const PlayerStat = require('../database/models/PlayerStat');
const { checkCooldown, replyCooldown } = require('../utils/cooldown');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    try {
      if (!message.guild) return;
      if (message.author.bot) return;
      if (!message.content.startsWith('!recap')) return;
      if (!message.member) return;

      const content  = message.content.trim();
      const tournName = content.slice('!recap'.length).trim();

      const cd = checkCooldown(message.author.id, 'recap', 30);
      if (cd) return replyCooldown(message, cd, 'recap');

      const guildId = message.guild.id;

      let tourn;
      if (tournName) {
        tourn = await Tournament.findOne({ name: new RegExp(`^${tournName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
        if (!tourn) return message.reply(`❌ Tournoi **${tournName}** introuvable.`);
      } else {
        tourn = await Tournament.findOne({ active: true }) ?? await Tournament.findOne().sort({ createdAt: -1 });
        if (!tourn) return message.reply('❌ Aucun tournoi trouvé.');
      }

      const loading = await message.channel.send('📊 Génération du récap en cours...');

      const matchFilter = { tournamentId: tourn._id.toString() };
      const [allMatches, teams] = await Promise.all([
        Match.find(matchFilter).sort({ createdAt: 1 }),
        Team.find().sort({ points: -1 }),
      ]);

      if (!allMatches.length) {
        await loading.delete().catch(() => {});
        return message.reply(`❌ Aucun match enregistré pour **${tourn.name}**.`);
      }

      // Équipes ayant joué dans ce tournoi
      const teamsInTourn = [...new Set(allMatches.map(m => m.team))];

      // Classement des équipes de ce tournoi
      const teamStats = teamsInTourn.map(name => {
        const ms = allMatches.filter(m => m.team === name);
        const kills  = ms.reduce((s, m) => s + m.kills, 0);
        const points = ms.reduce((s, m) => s + m.points, 0);
        const wins   = ms.filter(m => m.placement === 1).length;
        const avgKills = ms.length ? (kills / ms.length).toFixed(1) : '0';
        return { name, kills, points, matchs: ms.length, wins, avgKills };
      }).sort((a, b) => b.points - a.points || b.kills - a.kills);

      // MVP (meilleur avgKills parmi les joueurs)
      const allPlayers = await PlayerStat.find({ guildId }).sort({ totalKills: -1 }).limit(1);
      const mvpPlayer  = allPlayers[0];

      // Meilleur match (plus de kills)
      const bestMatch = [...allMatches].sort((a, b) => b.kills - a.kills)[0];

      // Record de points en un match
      const bestPts = [...allMatches].sort((a, b) => b.points - a.points)[0];

      // Vainqueur (1re place classement)
      const winner = teamStats[0];

      const podium = teamStats.slice(0, 3).map((t, i) => {
        const medals = ['🥇', '🥈', '🥉'];
        return `${medals[i]} **${t.name}** — ${t.points} pts · ${t.kills} kills`;
      }).join('\n');

      const embed = new EmbedBuilder()
        .setColor(0xFF8C00)
        .setTitle(`🏆 Récapitulatif — ${tourn.name}`)
        .setDescription(`**${allMatches.length}** matchs joués · **${teamsInTourn.length}** équipes`)
        .addFields(
          { name: '🥇 Podium final', value: podium || '—', inline: false },
          { name: '🏆 Vainqueur', value: winner ? `**${winner.name}** avec ${winner.points} pts et ${winner.kills} kills` : '—', inline: false },
          { name: '🔥 Meilleur match (kills)', value: bestMatch ? `**${bestMatch.team}** — ${bestMatch.kills} kills (#${bestMatch.placement})` : '—', inline: true },
          { name: '⭐ Meilleur match (points)', value: bestPts ? `**${bestPts.team}** — ${bestPts.points} pts (#${bestPts.placement})` : '—', inline: true },
          { name: '🎮 MVP joueur', value: mvpPlayer ? `**${mvpPlayer.displayName}** (${mvpPlayer.totalKills} kills en ${mvpPlayer.totalMatches} matchs)` : '—', inline: false },
          {
            name: '📊 Top 5 équipes',
            value: teamStats.slice(0, 5).map((t, i) => `**${i + 1}.** ${t.name} — ${t.points} pts · ${t.kills} kills · ${t.matchs} matchs`).join('\n') || '—',
            inline: false,
          },
        )
        .setFooter({ text: `SUPREMYX Esports · Tournoi ${tourn.active ? 'en cours' : 'terminé'}` })
        .setTimestamp();

      await loading.delete().catch(() => {});
      return message.channel.send({ embeds: [embed] });

    } catch (err) {
      console.error('[recap]', err);
    }
  });
};
