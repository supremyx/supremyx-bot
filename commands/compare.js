const Team = require('../database/models/Team');
const Match = require('../database/models/Match');
const Season = require('../database/models/Season');
const PlayerStat = require('../database/models/PlayerStat');
const { EmbedBuilder } = require('discord.js');
const { checkCooldown, replyCooldown } = require('../utils/cooldown');

function indicator(v1, v2) {
  if (v1 > v2) return ['⬆️', '⬇️'];
  if (v2 > v1) return ['⬇️', '⬆️'];
  return ['➡️', '➡️'];
}

module.exports = (client) => {
  client.on('messageCreate', async message => {
    try {
    if (!message.content.startsWith('!comparer')) return;
    const cd = checkCooldown(message.author.id, 'compare', 5);
    if (cd) return replyCooldown(message, cd, 'compare');

    const args = message.content.split(' ').slice(1);

    // ── !comparer joueur <joueur1> vs <joueur2> ─────────────────────────
    if (args[0]?.toLowerCase() === 'joueur') {
      const rest = args.slice(1);
      const vsIndex = rest.findIndex(a => a.toLowerCase() === 'vs');

      if (vsIndex < 1 || vsIndex === rest.length - 1)
        return message.reply('Usage : `!comparer joueur <joueur1> vs <joueur2>`');

      const nom1 = rest.slice(0, vsIndex).join(' ').trim();
      const nom2 = rest.slice(vsIndex + 1).join(' ').trim();

      const [p1, p2] = await Promise.all([
        PlayerStat.findOne({ guildId: message.guild.id, displayName: { $regex: new RegExp(`^${nom1}$`, 'i') } }),
        PlayerStat.findOne({ guildId: message.guild.id, displayName: { $regex: new RegExp(`^${nom2}$`, 'i') } }),
      ]);

      if (!p1) return message.reply(`❌ Joueur **${nom1}** introuvable.`);
      if (!p2) return message.reply(`❌ Joueur **${nom2}** introuvable.`);

      const avg1 = p1.totalMatches > 0 ? (p1.totalKills / p1.totalMatches).toFixed(1) : '0';
      const avg2 = p2.totalMatches > 0 ? (p2.totalKills / p2.totalMatches).toFixed(1) : '0';

      function ind(v1, v2) {
        if (v1 > v2) return ['🏆', '  '];
        if (v2 > v1) return ['  ', '🏆'];
        return ['🤝', '🤝'];
      }

      const [tk1, tk2] = ind(p1.totalKills, p2.totalKills);
      const [av1, av2] = ind(parseFloat(avg1), parseFloat(avg2));
      const [bk1, bk2] = ind(p1.bestKills, p2.bestKills);
      const [tm1, tm2] = ind(p1.totalMatches, p2.totalMatches);

      // Score global
      const cats = [
        [p1.totalKills, p2.totalKills],
        [parseFloat(avg1), parseFloat(avg2)],
        [p1.bestKills, p2.bestKills],
      ];
      const score1 = cats.filter(([a, b]) => a > b).length;
      const score2 = cats.filter(([a, b]) => b > a).length;
      const verdict = score1 > score2 ? `🏆 **${p1.displayName}** remporte la comparaison (${score1}/${cats.length} catégories)`
        : score2 > score1 ? `🏆 **${p2.displayName}** remporte la comparaison (${score2}/${cats.length} catégories)`
        : '🤝 Égalité parfaite';

      const histFmt = (p) => p.history.slice(-5).reverse()
        .map(h => `\`${new Date(h.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}\` — ${h.kills} kills`)
        .join('\n') || '—';

      const embed = new EmbedBuilder()
        .setTitle(`⚔️ Duel joueurs — ${p1.displayName} vs ${p2.displayName}`)
        .setColor(0xEB459E)
        .addFields(
          {
            name: `💀 ${p1.displayName}`,
            value: [
              `${tk1} **Kills totaux :** ${p1.totalKills.toLocaleString('fr')}`,
              `${av1} **Moy. kills :** ${avg1}`,
              `${bk1} **Meilleur kills :** ${p1.bestKills}`,
              `${tm1} **Matchs joués :** ${p1.totalMatches}`,
              `🏠 **Équipe :** ${p1.teamName}`,
            ].join('\n'),
            inline: true,
          },
          {
            name: `💀 ${p2.displayName}`,
            value: [
              `${tk2} **Kills totaux :** ${p2.totalKills.toLocaleString('fr')}`,
              `${av2} **Moy. kills :** ${avg2}`,
              `${bk2} **Meilleur kills :** ${p2.bestKills}`,
              `${tm2} **Matchs joués :** ${p2.totalMatches}`,
              `🏠 **Équipe :** ${p2.teamName}`,
            ].join('\n'),
            inline: true,
          },
          {
            name: '🎯 Verdict',
            value: verdict,
            inline: false,
          },
          {
            name: `📋 5 derniers matchs — ${p1.displayName}`,
            value: histFmt(p1),
            inline: true,
          },
          {
            name: `📋 5 derniers matchs — ${p2.displayName}`,
            value: histFmt(p2),
            inline: true,
          }
        )
        .setFooter({ text: '🏆 meilleur  |  🤝 égal' })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    // ── !comparer saison <équipe1> vs <équipe2> ──────────────────────────
    if (args[0]?.toLowerCase() === 'saison') {
      const rest = args.slice(1);
      const vsIndex = rest.findIndex(a => a.toLowerCase() === 'vs');

      if (vsIndex < 1 || vsIndex === rest.length - 1)
        return message.reply('Usage : `!comparer saison <équipe1> vs <équipe2>`');

      const name1 = rest.slice(0, vsIndex).join(' ').trim();
      const name2 = rest.slice(vsIndex + 1).join(' ').trim();

      const seasons = await Season.find({ active: false, 'snapshot.0': { $exists: true } }).sort({ endedAt: 1 });

      if (!seasons.length)
        return message.reply('❌ Aucune saison terminée avec des données.');

      // Aggregate per team
      const agg = { [name1.toLowerCase()]: null, [name2.toLowerCase()]: null };
      const blanks = () => ({
        name: '',
        totalPoints: 0,
        totalKills: 0,
        totalWins: 0,
        totalLosses: 0,
        seasons: 0,
        podiums: 0,
        wins1st: 0,
        seasonResults: []
      });

      let t1 = null, t2 = null;

      for (const season of seasons) {
        const e1 = season.snapshot.find(e => e.name?.toLowerCase() === name1.toLowerCase());
        const e2 = season.snapshot.find(e => e.name?.toLowerCase() === name2.toLowerCase());

        if (e1) {
          if (!t1) { t1 = blanks(); t1.name = e1.name; }
          t1.totalPoints  += e1.points  || 0;
          t1.totalKills   += e1.kills   || 0;
          t1.totalWins    += e1.wins    || 0;
          t1.totalLosses  += e1.losses  || 0;
          t1.seasons      += 1;
          if (e1.rank <= 3) t1.podiums += 1;
          if (e1.rank === 1) t1.wins1st += 1;
          t1.seasonResults.push({ name: season.name, rank: e1.rank, pts: e1.points });
        }

        if (e2) {
          if (!t2) { t2 = blanks(); t2.name = e2.name; }
          t2.totalPoints  += e2.points  || 0;
          t2.totalKills   += e2.kills   || 0;
          t2.totalWins    += e2.wins    || 0;
          t2.totalLosses  += e2.losses  || 0;
          t2.seasons      += 1;
          if (e2.rank <= 3) t2.podiums += 1;
          if (e2.rank === 1) t2.wins1st += 1;
          t2.seasonResults.push({ name: season.name, rank: e2.rank, pts: e2.points });
        }
      }

      if (!t1) return message.reply(`❌ **${name1}** introuvable dans les snapshots de saisons.`);
      if (!t2) return message.reply(`❌ **${name2}** introuvable dans les snapshots de saisons.`);

      const avg = (t) => t.seasons > 0
        ? `${(t.totalPoints / t.seasons).toFixed(1)} pts • ${(t.totalKills / t.seasons).toFixed(1)} kills`
        : '—';

      const recentResults = (t) => t.seasonResults.slice(-3).reverse()
        .map(r => `• ${r.name} — #${r.rank} (${r.pts} pts)`)
        .join('\n') || '—';

      const [p1, p2]  = indicator(t1.totalPoints, t2.totalPoints);
      const [k1, k2] = indicator(t1.totalKills,  t2.totalKills);
      const [s1, s2] = indicator(t1.wins1st,      t2.wins1st);
      const [d1, d2] = indicator(t1.podiums,      t2.podiums);

      const leader = t1.wins1st > t2.wins1st ? t1.name
        : t2.wins1st > t1.wins1st ? t2.name
        : t1.totalPoints > t2.totalPoints ? t1.name
        : t2.totalPoints > t1.totalPoints ? t2.name
        : null;

      const analysed = seasons.length;

      const embed = new EmbedBuilder()
        .setTitle(`📅 Comparaison saisons — ${t1.name} vs ${t2.name}`)
        .setColor(0x9B59B6)
        .setDescription(`Analyse sur **${analysed}** saison(s) terminée(s)`)
        .addFields(
          {
            name: `🔵 ${t1.name}`,
            value: [
              `${p1} **Pts totaux :** ${t1.totalPoints}`,
              `${k1} **Kills totaux :** ${t1.totalKills}`,
              `${s1} **🥇 Saisons gagnées :** ${t1.wins1st}`,
              `${d1} **Podiums (top 3) :** ${t1.podiums}`,
              `📊 **Saisons jouées :** ${t1.seasons}`,
              `⚡ **Moy./saison :** ${avg(t1)}`,
            ].join('\n'),
            inline: true
          },
          {
            name: `🔴 ${t2.name}`,
            value: [
              `${p2} **Pts totaux :** ${t2.totalPoints}`,
              `${k2} **Kills totaux :** ${t2.totalKills}`,
              `${s2} **🥇 Saisons gagnées :** ${t2.wins1st}`,
              `${d2} **Podiums (top 3) :** ${t2.podiums}`,
              `📊 **Saisons jouées :** ${t2.seasons}`,
              `⚡ **Moy./saison :** ${avg(t2)}`,
            ].join('\n'),
            inline: true
          },
          {
            name: '🏆 Avantage',
            value: leader ? `**${leader}** domine sur l'historique des saisons` : '**Égalité** sur l\'historique',
            inline: false
          },
          {
            name: `📋 3 dernières saisons — ${t1.name}`,
            value: recentResults(t1),
            inline: true
          },
          {
            name: `📋 3 dernières saisons — ${t2.name}`,
            value: recentResults(t2),
            inline: true
          }
        )
        .setFooter({ text: '⬆️ meilleur  |  ⬇️ inférieur  |  ➡️ égal' })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    // ── !compare <équipe1> vs <équipe2> (live stats) ────────────────────
    const separator = args.indexOf('vs');

    if (separator === -1 || separator === 0 || separator === args.length - 1)
      return message.reply(
        'Usage :\n' +
        '`!comparer <équipe1> vs <équipe2>` — Équipes en direct\n' +
        '`!comparer saison <équipe1> vs <équipe2>` — Historique des saisons\n' +
        '`!comparer joueur <joueur1> vs <joueur2>` — Duel entre deux joueurs'
      );

    const name1 = args.slice(0, separator).join(' ');
    const name2 = args.slice(separator + 1).join(' ');

    const [team1, team2] = await Promise.all([
      Team.findOne({ name: { $regex: new RegExp(`^${name1}$`, 'i') } }),
      Team.findOne({ name: { $regex: new RegExp(`^${name2}$`, 'i') } })
    ]);

    if (!team1) return message.reply(`❌ Équipe **${name1}** introuvable.`);
    if (!team2) return message.reply(`❌ Équipe **${name2}** introuvable.`);

    const [count1, count2] = await Promise.all([
      Match.countDocuments({ team: team1.name }),
      Match.countDocuments({ team: team2.name })
    ]);

    const avg1 = count1 > 0 ? (team1.kills / count1).toFixed(1) : '0';
    const avg2 = count2 > 0 ? (team2.kills / count2).toFixed(1) : '0';

    const winner = team1.points > team2.points ? team1.name
      : team2.points > team1.points ? team2.name
      : null;

    const [pA, pB] = indicator(team1.points, team2.points);
    const [kA, kB] = indicator(team1.kills,  team2.kills);
    const [mA, mB] = indicator(count1,       count2);
    const [aA, aB] = indicator(parseFloat(avg1), parseFloat(avg2));

    const embed = new EmbedBuilder()
      .setTitle(`⚔️ ${team1.name} vs ${team2.name}`)
      .setColor(0xEB459E)
      .addFields(
        {
          name: `🔵 ${team1.name}`,
          value: [
            `${pA} **Points :** ${team1.points}`,
            `${kA} **Kills :** ${team1.kills}`,
            `${mA} **Matchs :** ${count1}`,
            `${aA} **Kills/match :** ${avg1}`,
          ].join('\n'),
          inline: true
        },
        {
          name: `🔴 ${team2.name}`,
          value: [
            `${pB} **Points :** ${team2.points}`,
            `${kB} **Kills :** ${team2.kills}`,
            `${mB} **Matchs :** ${count2}`,
            `${aB} **Kills/match :** ${avg2}`,
          ].join('\n'),
          inline: true
        },
        {
          name: '🏆 Avantage',
          value: winner ? `**${winner}** mène au classement` : '**Égalité** au classement',
          inline: false
        }
      )
      .setFooter({ text: '⬆️ meilleur  |  ⬇️ inférieur  |  ➡️ égal' })
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
    } catch (err) {
      console.error('[compare] Erreur:', err);
      message.reply('❌ Une erreur est survenue. Réessaie dans un instant.').catch(() => {});
    }
  });
};
