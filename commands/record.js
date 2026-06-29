/**
 * !record <équipe>  — Records d'une équipe
 * !record joueur <nom>  — Records personnels d'un joueur
 */
const { EmbedBuilder } = require('discord.js');
const Match      = require('../database/models/Match');
const PlayerStat = require('../database/models/PlayerStat');
const Team       = require('../database/models/Team');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    try {
      if (!message.guild) return;
      if (message.author.bot) return;
      if (!message.member) return;
      if (!message.content.startsWith('!record')) return;

      const guildId = message.guild.id;
      const content = message.content.trim();
      const parts   = content.split(/\s+/);

      // !record joueur <nom>
      if (parts[1] === 'joueur') {
        const playerName = parts.slice(2).join(' ');
        if (!playerName) return message.reply('Usage : `!record joueur <nom>`');

        await message.channel.sendTyping();
        const stats = await PlayerStat.findOne({
          guildId,
          displayName: { $regex: new RegExp(playerName, 'i') },
        }).lean();
        if (!stats) return message.reply(`❌ Joueur **${playerName}** introuvable.`);

        const history = stats.history || [];
        const bestKills = Math.max(...history.map(h => h.kills), 0);
        const worstKills = history.length ? Math.min(...history.map(h => h.kills)) : 0;
        const avgKills = stats.totalMatches ? (stats.totalKills / stats.totalMatches).toFixed(1) : '0.0';

        // Meilleure série (kills > moyenne sur 3+ matchs consécutifs)
        let bestStreak = 0, streak = 0;
        const avg = stats.totalMatches ? stats.totalKills / stats.totalMatches : 0;
        for (const h of history) {
          if (h.kills >= avg) { streak++; bestStreak = Math.max(bestStreak, streak); }
          else streak = 0;
        }

        // Tournoi le plus performant
        const byTournoi = {};
        for (const h of history) {
          const t = h.tournamentName || 'Général';
          if (!byTournoi[t]) byTournoi[t] = { kills: 0, matches: 0 };
          byTournoi[t].kills += h.kills;
          byTournoi[t].matches++;
        }
        const bestTournoi = Object.entries(byTournoi)
          .map(([t, d]) => ({ t, avg: d.matches ? d.kills / d.matches : 0 }))
          .sort((a, b) => b.avg - a.avg)[0];

        const embed = new EmbedBuilder()
          .setTitle(`🏅 Records — ${stats.displayName}`)
          .setColor(0xF1C40F)
          .addFields(
            { name: '🔥 Meilleur match',    value: `${bestKills} kills`,  inline: true },
            { name: '📉 Pire match',        value: `${worstKills} kills`, inline: true },
            { name: '📊 Kills moyens',      value: avgKills,              inline: true },
            { name: '💀 Kills totaux',      value: stats.totalKills.toString(), inline: true },
            { name: '🏟️ Matchs joués',     value: stats.totalMatches.toString(), inline: true },
            { name: '🔗 Meilleure série',   value: `${bestStreak} matchs au-dessus de la moyenne`, inline: true },
            { name: '🏆 Tournoi fort',      value: bestTournoi ? `${bestTournoi.t} (${bestTournoi.avg.toFixed(1)} avg)` : '—', inline: false },
          )
          .setFooter({ text: `Équipe : ${stats.teamName}` })
          .setTimestamp();
        return message.channel.send({ embeds: [embed] });
      }

      // !record <équipe>
      const teamName = parts.slice(1).join(' ');
      if (!teamName) return message.reply('Usage : `!record <équipe>` ou `!record joueur <nom>`');

      await message.channel.sendTyping();
      const team = await Team.findOne({ name: { $regex: new RegExp(`^${teamName}$`, 'i') } }).lean();
      if (!team) return message.reply(`❌ Équipe **${teamName}** introuvable.`);

      const matches = await Match.find({ team: team.name }).sort({ createdAt: 1 }).lean();
      if (!matches.length) return message.reply(`❌ Aucun match enregistré pour **${team.name}**.`);

      const bestKills    = Math.max(...matches.map(m => m.kills));
      const worstKills   = Math.min(...matches.map(m => m.kills));
      const avgKills     = (matches.reduce((s, m) => s + m.kills, 0) / matches.length).toFixed(1);
      const bestPoints   = Math.max(...matches.map(m => m.points));
      const bestPlace    = Math.min(...matches.map(m => m.placement));
      const wins         = matches.filter(m => m.placement === 1).length;
      const top3         = matches.filter(m => m.placement <= 3).length;

      // Meilleures séries de victoires
      let bestWinStreak = 0, winStreak = 0;
      for (const m of matches) {
        if (m.placement === 1) { winStreak++; bestWinStreak = Math.max(bestWinStreak, winStreak); }
        else winStreak = 0;
      }

      // Meilleur tournoi par points
      const byT = {};
      for (const m of matches) {
        const t = m.tournamentName || 'Général';
        if (!byT[t]) byT[t] = { pts: 0, n: 0 };
        byT[t].pts += m.points; byT[t].n++;
      }
      const bestT = Object.entries(byT).sort((a, b) => b[1].pts - a[1].pts)[0];

      const embed = new EmbedBuilder()
        .setTitle(`🏅 Records — ${team.name}`)
        .setColor(0xF1C40F)
        .addFields(
          { name: '🔥 Max kills (1 match)',   value: `${bestKills}`,  inline: true },
          { name: '📉 Min kills (1 match)',   value: `${worstKills}`, inline: true },
          { name: '📊 Moy. kills/match',      value: avgKills,        inline: true },
          { name: '⭐ Max points (1 match)',  value: `${bestPoints}`, inline: true },
          { name: '🥇 Meilleur placement',    value: `#${bestPlace}`, inline: true },
          { name: '🏆 Victoires (1ère place)', value: `${wins}`,      inline: true },
          { name: '🎖️ Top 3 total',          value: `${top3}`,       inline: true },
          { name: '🔗 Série de victoires',    value: `${bestWinStreak} d'affilée`, inline: true },
          { name: '🏟️ Matchs joués',        value: `${matches.length}`, inline: true },
          { name: '📋 Meilleur tournoi',      value: bestT ? `${bestT[0]} (${bestT[1].pts} pts)` : '—', inline: false },
        )
        .setFooter({ text: `${team.wins}V · ${team.losses}D · ${team.points} pts totaux · ${team.kills} kills` })
        .setTimestamp();
      return message.channel.send({ embeds: [embed] });

    } catch (err) {
      console.error('[record] Erreur:', err);
      message.reply('❌ Une erreur est survenue.').catch(() => {});
    }
  });
};
