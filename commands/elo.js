/**
 * !elo <équipe>   — ELO d'une équipe
 * !classementelo  — Classement ELO de toutes les équipes
 */
const { EmbedBuilder } = require('discord.js');
const Match = require('../database/models/Match');
const Team  = require('../database/models/Team');
const Config = require('../database/models/Config');

/**
 * Calcule un score ELO simplifié depuis l'historique de matchs.
 * Chaque match contribue :  (points_match * facteur_recence)
 * Les matchs les plus récents ont un poids plus élevé.
 */
async function computeElo(teamName) {
  const matches = await Match.find({ team: teamName }).sort({ createdAt: 1 }).lean();
  if (!matches.length) return { elo: 1000, matches: 0, trend: 0 };

  let elo = 1000;
  const K = 32;
  const n = matches.length;

  for (let i = 0; i < n; i++) {
    const m = matches[i];
    // Score réel selon placement (1=1.0, 2-3=0.75, 4-5=0.5, 6-7=0.25, 8+=0.0)
    let actual;
    if (m.placement === 1)      actual = 1.0;
    else if (m.placement <= 3)  actual = 0.75;
    else if (m.placement <= 5)  actual = 0.5;
    else if (m.placement <= 7)  actual = 0.25;
    else                         actual = 0.1;

    // Bonus kills normalisé (supposons max ~20 kills = +0.15)
    const killBonus = Math.min((m.kills || 0) / 20, 1) * 0.15;
    actual = Math.min(actual + killBonus, 1.0);

    // Score attendu depuis ELO de base (adversaire = 1000 = baseline)
    const expected = 1 / (1 + Math.pow(10, (1000 - elo) / 400));
    elo = Math.round(elo + K * (actual - expected));
  }

  // Tendance sur les 5 derniers matchs
  const recent = matches.slice(-5);
  let eloRecent = elo;
  for (let i = recent.length - 1; i >= 0; i--) {
    const m = recent[i];
    let actual;
    if (m.placement === 1)      actual = 1.0;
    else if (m.placement <= 3)  actual = 0.75;
    else if (m.placement <= 5)  actual = 0.5;
    else if (m.placement <= 7)  actual = 0.25;
    else                         actual = 0.1;
    const expected = 1 / (1 + Math.pow(10, (1000 - eloRecent) / 400));
    eloRecent = Math.round(eloRecent + K * (actual - expected));
  }
  const trend = eloRecent - elo;

  return { elo, matches: n, trend };
}

module.exports = (client) => {
  client.on('messageCreate', async message => {
    try {
      if (!message.guild) return;
      if (message.author.bot) return;
      if (!message.member) return;

      const content = message.content.trim();

      // !classementelo
      if (content === '!classementelo') {
        await message.channel.sendTyping();
        const teams = await Team.find().lean();
        if (!teams.length) return message.reply('❌ Aucune équipe enregistrée.');

        const results = await Promise.all(teams.map(async t => ({
          name: t.name,
          ...(await computeElo(t.name)),
        })));
        results.sort((a, b) => b.elo - a.elo);

        const medals = ['🥇', '🥈', '🥉'];
        const rows = results.map((r, i) => {
          const medal = medals[i] || `**#${i + 1}**`;
          const trendStr = r.trend > 0 ? `📈 +${r.trend}` : r.trend < 0 ? `📉 ${r.trend}` : `➡️ =`;
          return `${medal} **${r.name}** — \`${r.elo}\` ELO  ${trendStr}  _(${r.matches} matchs)_`;
        }).join('\n');

        const embed = new EmbedBuilder()
          .setTitle('📊 Classement ELO')
          .setDescription(rows || 'Aucune donnée.')
          .setColor(0x5865F2)
          .setFooter({ text: 'ELO calculé depuis l\'historique de placements et kills · Tendance sur 5 derniers matchs' })
          .setTimestamp();
        return message.channel.send({ embeds: [embed] });
      }

      // !elo <équipe>
      if (content.startsWith('!elo')) {
        const teamName = content.slice(4).trim();
        if (!teamName) {
          return message.reply('Usage : `!elo <équipe>` ou `!classementelo`');
        }
        await message.channel.sendTyping();
        const escapedTeamName = teamName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const team = await Team.findOne({ name: { $regex: new RegExp(`^${escapedTeamName}$`, 'i') } }).lean();
        if (!team) return message.reply(`❌ Équipe **${teamName}** introuvable.`);

        const { elo, matches, trend } = await computeElo(team.name);
        const trendEmoji = trend > 10 ? '📈' : trend < -10 ? '📉' : '➡️';
        const trendStr   = trend > 0 ? `+${trend}` : `${trend}`;
        const grade =
          elo >= 1200 ? 'S — Élite' :
          elo >= 1100 ? 'A — Excellent' :
          elo >= 1000 ? 'B — Bon' :
          elo >= 900  ? 'C — Moyen' :
          'D — En difficulté';

        const embed = new EmbedBuilder()
          .setTitle(`📊 ELO — ${team.name}`)
          .setColor(0x5865F2)
          .addFields(
            { name: '🎯 Score ELO', value: `\`${elo}\``, inline: true },
            { name: `${trendEmoji} Tendance (5 derniers)`, value: `\`${trendStr}\``, inline: true },
            { name: '🏅 Niveau', value: grade, inline: true },
            { name: '📋 Matchs joués', value: `${matches}`, inline: true },
            { name: '🏆 Points', value: `${team.points}`, inline: true },
            { name: '💀 Kills', value: `${team.kills}`, inline: true },
          )
          .setFooter({ text: 'ELO Battle Royale — placement + kills · Base 1000' })
          .setTimestamp();
        return message.channel.send({ embeds: [embed] });
      }

    } catch (err) {
      console.error('[elo] Erreur:', err);
      message.reply('❌ Une erreur est survenue.').catch(() => {});
    }
  });
};
