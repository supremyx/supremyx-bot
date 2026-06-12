const Season = require('../database/models/Season');
const { EmbedBuilder } = require('discord.js');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    try {
    const content = message.content.trim();
    if (content !== '!mvpsaison' && !content.startsWith('!mvpsaison ')) return;

    const seasons = await Season.find({ active: false, 'snapshot.0': { $exists: true } }).sort({ endedAt: -1 });

    if (!seasons.length) {
      return message.reply('❌ Aucune saison terminée avec des données enregistrées.');
    }

    // Aggregate stats per team across all closed seasons
    const totals = {};

    for (const season of seasons) {
      for (const entry of season.snapshot) {
        if (!entry.name) continue;
        if (!totals[entry.name]) {
          totals[entry.name] = {
            name: entry.name,
            totalPoints: 0,
            totalKills: 0,
            totalWins: 0,
            totalLosses: 0,
            seasons: 0,
            podiums: 0,    // top 3 finishes
            wins1st: 0     // 1st place finishes
          };
        }
        const t = totals[entry.name];
        t.totalPoints += entry.points || 0;
        t.totalKills  += entry.kills  || 0;
        t.totalWins   += entry.wins   || 0;
        t.totalLosses += entry.losses || 0;
        t.seasons     += 1;
        if (entry.rank <= 3) t.podiums += 1;
        if (entry.rank === 1) t.wins1st += 1;
      }
    }

    const teams = Object.values(totals);
    if (!teams.length) return message.reply('❌ Aucune donnée d\'équipe dans les snapshots.');

    // Rank by: 1st place finishes → total points → total kills
    teams.sort((a, b) =>
      b.wins1st - a.wins1st ||
      b.totalPoints - a.totalPoints ||
      b.totalKills - a.totalKills
    );

    const mvp = teams[0];
    const medals = ['🥇', '🥈', '🥉'];

    const podiumLines = teams.slice(0, 5).map((t, i) => {
      const icon = medals[i] ?? `**${i + 1}.**`;
      return (
        `${icon} **${t.name}** — ${t.totalPoints} pts • ${t.totalKills} kills` +
        ` • ${t.wins1st}x🥇 • ${t.podiums} podium(s) • ${t.seasons} saison(s)`
      );
    });

    const avgPts = mvp.seasons > 0 ? (mvp.totalPoints / mvp.seasons).toFixed(1) : '0';
    const avgKills = mvp.seasons > 0 ? (mvp.totalKills / mvp.seasons).toFixed(1) : '0';

    const embed = new EmbedBuilder()
      .setTitle('🏆 MVP All-Time — Meilleure équipe toutes saisons')
      .setColor(0xFFD700)
      .addFields(
        { name: '👑 MVP', value: `**${mvp.name}**`, inline: true },
        { name: '🏅 Saisons jouées', value: `${mvp.seasons}`, inline: true },
        { name: '🥇 Victoires de saison', value: `${mvp.wins1st}`, inline: true },
        { name: '🏆 Points totaux', value: `${mvp.totalPoints}`, inline: true },
        { name: '💀 Kills totaux', value: `${mvp.totalKills}`, inline: true },
        { name: '🎯 Podiums (top 3)', value: `${mvp.podiums}`, inline: true },
        { name: '📊 Moy. pts/saison', value: `${avgPts}`, inline: true },
        { name: '⚔️ Moy. kills/saison', value: `${avgKills}`, inline: true },
        { name: '\u200b', value: '\u200b', inline: true },
        {
          name: `🏅 Classement All-Time (${seasons.length} saison(s) analysée(s))`,
          value: podiumLines.join('\n')
        }
      )
      .setFooter({ text: `Basé sur ${seasons.length} saison(s) terminée(s)` })
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
    } catch (err) {
      console.error('[mvpseason] Erreur:', err);
      message.reply('❌ Une erreur est survenue. Réessaie dans un instant.').catch(() => {});
    }
  });
};
